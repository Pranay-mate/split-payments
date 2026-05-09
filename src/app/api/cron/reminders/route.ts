/**
 * Daily reminder cron endpoint. Configured in vercel.json to run once
 * a day; protected by CRON_SECRET so random hits can't trigger pushes.
 *
 * Sends a single notification per user-with-subscription whose group(s)
 * have an unsettled balance owed *by them* older than 7 days. We pick
 * "owed by", not "owed to" — we want to nudge the debtor, not pile on
 * the creditor.
 *
 * Anomaly alerts (Phase 2.5 v3.5) will piggyback on this same endpoint
 * once Personal Finance Tracker ships — second pass after the balance
 * pass.
 */

import { NextResponse } from "next/server";
import webpush from "web-push";
import { and, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  expenseSplits,
  expenses,
  groupMembers,
  groups,
  personalEntries,
  pushSubscriptions,
  settlements,
} from "@/lib/db/schema";
import { decryptAmount } from "@/lib/encryption";
import { detectAnomalies } from "@/lib/anomaly-detect";
import { CATEGORIES, toCategoryKey } from "@/lib/categories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@easysplits.in";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

type SubscriptionRow = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  preferences: string;
  lastNotifiedAt: Date | null;
};

async function sendOne(
  sub: SubscriptionRow,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<"sent" | "expired" | "error"> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 },
    );
    return "sent";
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "statusCode" in err
        ? (err as { statusCode: number }).statusCode
        : 0;
    if (status === 404 || status === 410) return "expired";
    return "error";
  }
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const vapid = getVapid();
  if (!vapid) {
    return NextResponse.json(
      {
        error:
          "VAPID keys not configured — set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in env",
      },
      { status: 500 },
    );
  }
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const subs = (await db.select().from(pushSubscriptions)) as SubscriptionRow[];

  let sent = 0;
  let expired = 0;
  let errors = 0;
  let skipped = 0;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const personalRangeStart = new Date(
    now.getFullYear(),
    now.getMonth() - 6,
    1,
  );
  const personalRangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  for (const sub of subs) {
    let prefs: {
      balanceReminders?: boolean;
      spendingAnomalies?: boolean;
    } = {};
    try {
      prefs = JSON.parse(sub.preferences);
    } catch {
      // empty preferences = default-on for both
    }

    // Throttle: at most one push per subscription per 7 days. Keeps the
    // promise of "we won't spam" — applies across both alert types.
    if (
      sub.lastNotifiedAt &&
      now.getTime() - new Date(sub.lastNotifiedAt).getTime() <
        7 * 24 * 60 * 60 * 1000
    ) {
      skipped++;
      continue;
    }

    // ── Anomaly pass (runs first; more time-sensitive than balance reminders) ──
    if (prefs.spendingAnomalies !== false) {
      const personalRows = await db
        .select({
          category: personalEntries.category,
          amount: personalEntries.amount,
          occurredAt: personalEntries.occurredAt,
        })
        .from(personalEntries)
        .where(
          and(
            eq(personalEntries.userId, sub.userId),
            isNull(personalEntries.deletedAt),
            eq(personalEntries.type, "expense"),
            gte(personalEntries.occurredAt, personalRangeStart),
            lt(personalEntries.occurredAt, personalRangeEnd),
          ),
        );
      if (personalRows.length > 0) {
        const decrypted = personalRows.map((r) => {
          const d = new Date(r.occurredAt);
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          let amount = 0;
          try {
            amount = decryptAmount(r.amount);
          } catch {
            // Ciphertext from a different key (key rotation, etc) — skip.
          }
          return { monthKey, category: r.category, amount };
        });
        const anomalies = detectAnomalies(decrypted, currentMonthKey);
        if (anomalies.length > 0) {
          const top = anomalies[0];
          const meta = CATEGORIES[toCategoryKey(top.category)];
          const pct = Math.round(top.severity * 100);
          const result = await sendOne(sub, {
            title: `${meta.emoji} ${meta.label} up ${pct}% this month`,
            body: `Currently ₹${Math.round(top.current).toLocaleString("en-IN")} (usual: ₹${Math.round(top.baseline).toLocaleString("en-IN")}). Anything off?`,
            url: "/app/personal",
            tag: "easysplits-anomaly",
          });
          if (result === "sent") {
            sent++;
            await db
              .update(pushSubscriptions)
              .set({ lastNotifiedAt: new Date() })
              .where(eq(pushSubscriptions.id, sub.id));
            continue; // don't also send the balance reminder
          } else if (result === "expired") {
            expired++;
            await db
              .delete(pushSubscriptions)
              .where(eq(pushSubscriptions.id, sub.id));
            continue;
          } else {
            errors++;
          }
        }
      }
    }

    // ── Balance-reminder pass ──
    if (prefs.balanceReminders === false) {
      skipped++;
      continue;
    }

    // Aggregate amount owed across all groups (in primary currencies — rough,
    // we just use the converted amount as a single "score" since most users
    // have a single primary currency anyway).
    const owedRows = await db
      .select({
        groupId: expenses.groupId,
        groupName: groups.name,
        amount: sql<number>`SUM(${expenseSplits.amount})::numeric`,
      })
      .from(expenseSplits)
      .innerJoin(expenses, eq(expenses.id, expenseSplits.expenseId))
      .innerJoin(groups, eq(groups.id, expenses.groupId))
      .innerJoin(
        groupMembers,
        and(
          eq(groupMembers.groupId, expenses.groupId),
          eq(groupMembers.userId, sub.userId),
        ),
      )
      .where(
        and(
          eq(expenseSplits.userId, sub.userId),
          lte(expenses.occurredAt, sevenDaysAgo),
        ),
      )
      .groupBy(expenses.groupId, groups.name);

    if (owedRows.length === 0) {
      skipped++;
      continue;
    }

    // Subtract recorded settlements where the user paid out.
    const paidRows = await db
      .select({
        groupId: settlements.groupId,
        amount: sql<number>`SUM(${settlements.amount})::numeric`,
      })
      .from(settlements)
      .where(eq(settlements.fromUserId, sub.userId))
      .groupBy(settlements.groupId);
    const paidByGroup = new Map<string, number>();
    for (const p of paidRows) paidByGroup.set(p.groupId, Number(p.amount));

    let totalNet = 0;
    let topGroup: { name: string; amount: number } | null = null;
    for (const r of owedRows) {
      const owed = Number(r.amount);
      const paid = paidByGroup.get(r.groupId) ?? 0;
      const net = owed - paid;
      if (net <= 0) continue;
      totalNet += net;
      if (!topGroup || net > topGroup.amount) {
        topGroup = { name: r.groupName, amount: net };
      }
    }

    if (totalNet < 50 || !topGroup) {
      // Don't ping for trivial sub-₹50 carry-overs.
      skipped++;
      continue;
    }

    const result = await sendOne(sub, {
      title: `You owe ₹${Math.round(totalNet)} across your groups`,
      body: `Mostly to ${topGroup.name}. Tap to settle up.`,
      url: "/app/groups",
    });

    if (result === "sent") {
      sent++;
      await db
        .update(pushSubscriptions)
        .set({ lastNotifiedAt: new Date() })
        .where(eq(pushSubscriptions.id, sub.id));
    } else if (result === "expired") {
      expired++;
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.id, sub.id));
    } else {
      errors++;
    }
  }

  return NextResponse.json({ sent, expired, errors, skipped, total: subs.length });
}
