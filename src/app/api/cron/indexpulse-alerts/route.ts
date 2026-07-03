/**
 * IndexPulse alert cron. Evaluates every enabled price alert against the
 * latest AMFI/Yahoo quotes and delivers on a fresh threshold crossing.
 *
 * Protected by CRON_SECRET (same pattern as /api/cron/reminders). Wire it
 * up in vercel.json and/or a GitHub Actions schedule (see INDEXPULSE.md) —
 * Indian markets trade 09:15–15:30 IST, and AMFI NAVs refresh once daily.
 *
 * Edge-triggered, not level-triggered: an alert fires only when the
 * instrument value crosses from not-meeting to meeting the condition
 * (tracked via last_value), so a price parked above the threshold doesn't
 * re-notify on every run. Delivery fans out over the alert's channels:
 *   - push    → the user's Web Push subscriptions (bypasses the EasySplits
 *               balance-reminder opt-out; this is a distinct feature)
 *   - email   → Resend, to the user's auth email (service-role lookup)
 *   - in_app  → recorded via last_triggered_at; the dashboard surfaces it
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { indexFundAlerts, pushSubscriptions } from "@/lib/db/schema";
import { getQuotes } from "@/lib/indexpulse/quotes";
import { ensureVapidConfigured, sendToSubscription } from "@/lib/push";
import { sendAlertEmail } from "@/lib/indexpulse/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Does `value` satisfy the alert condition? */
function meets(condition: string, value: number, threshold: number): boolean {
  return condition === "above" ? value >= threshold : value <= threshold;
}

/** Cache email lookups within a single run — a user with N alerts firing
 *  shouldn't trigger N identical service-role calls. */
async function makeEmailResolver() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fallback = process.env.INDEXPULSE_ALERT_EMAIL ?? null;
  const admin =
    url && serviceKey
      ? createClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;
  const cache = new Map<string, string | null>();
  return async (userId: string): Promise<string | null> => {
    if (cache.has(userId)) return cache.get(userId)!;
    let email: string | null = fallback;
    if (admin) {
      try {
        const { data } = await admin.auth.admin.getUserById(userId);
        email = data.user?.email ?? fallback;
      } catch {
        email = fallback;
      }
    }
    cache.set(userId, email);
    return email;
  };
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const alerts = await db
    .select()
    .from(indexFundAlerts)
    .where(eq(indexFundAlerts.enabled, true));

  if (alerts.length === 0) {
    return NextResponse.json({ evaluated: 0, fired: 0 });
  }

  // One quote fetch for the distinct instruments referenced by alerts.
  const keys = Array.from(new Set(alerts.map((a) => a.instrumentKey)));
  const quotes = await getQuotes(keys);
  const priceByKey = new Map(quotes.map((q) => [q.key, q.price]));

  const vapidReady = ensureVapidConfigured();
  const resolveEmail = await makeEmailResolver();

  let fired = 0;
  let pushSent = 0;
  let emailSent = 0;
  let skippedStale = 0;

  for (const alert of alerts) {
    const price = priceByKey.get(alert.instrumentKey) ?? null;
    if (price == null) {
      skippedStale++;
      continue;
    }
    const threshold = Number(alert.threshold);
    const prev = alert.lastValue != null ? Number(alert.lastValue) : null;
    const meetsNow = meets(alert.condition, price, threshold);
    const meetsPrev = prev != null && meets(alert.condition, prev, threshold);
    const isFreshCrossing = meetsNow && !meetsPrev;

    // Always record the observed value so the next run has a baseline.
    const patch: Record<string, unknown> = {
      lastValue: price.toString(),
      updatedAt: new Date(),
    };

    if (isFreshCrossing) {
      fired++;
      patch.lastTriggeredAt = new Date();

      let channels: string[] = [];
      try {
        const parsed = JSON.parse(alert.channels);
        if (Array.isArray(parsed)) channels = parsed;
      } catch {
        channels = ["in_app"];
      }

      const arrow = alert.condition === "above" ? "↑" : "↓";
      const title = `${arrow} ${alert.name}`;
      const body = `Now ₹${price.toLocaleString("en-IN", {
        maximumFractionDigits: 2,
      })} — ${alert.condition} your ₹${threshold.toLocaleString("en-IN")} alert.`;

      // Push
      if (channels.includes("push") && vapidReady) {
        const subs = await db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.userId, alert.userId));
        for (const sub of subs) {
          const result = await sendToSubscription(sub, {
            title,
            body,
            url: "/app/indexpulse",
            tag: `indexpulse-${alert.id}`,
          });
          if (result === "sent") pushSent++;
          else if (result === "expired") {
            await db
              .delete(pushSubscriptions)
              .where(eq(pushSubscriptions.id, sub.id));
          }
        }
      }

      // Email
      if (channels.includes("email")) {
        const to = await resolveEmail(alert.userId);
        if (to) {
          const ok = await sendAlertEmail({
            to,
            subject: `IndexPulse: ${title}`,
            text: `${body}\n\nView on IndexPulse: https://easysplits.in/app/indexpulse\n\n— This is an automated price alert, not investment advice.`,
          });
          if (ok) emailSent++;
        }
      }
      // in_app needs no send — last_triggered_at drives the dashboard badge.
    }

    await db
      .update(indexFundAlerts)
      .set(patch)
      .where(eq(indexFundAlerts.id, alert.id));
  }

  return NextResponse.json({
    evaluated: alerts.length,
    fired,
    pushSent,
    emailSent,
    skippedStale,
  });
}
