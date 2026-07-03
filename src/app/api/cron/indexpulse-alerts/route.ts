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
import { and, eq } from "drizzle-orm";
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

/** True if `asOf` falls on today's date in IST. Used as a self-maintaining
 *  market-closed guard for ETF alerts — a holiday/pre-open leaves ETF quotes
 *  timestamped on the previous trading day. */
function isFreshTodayIST(asOf: string | null): boolean {
  if (!asOf) return false;
  const d = new Date(asOf);
  if (Number.isNaN(d.getTime())) return false;
  const opts = { timeZone: "Asia/Kolkata" } as const;
  return d.toLocaleDateString("en-CA", opts) === new Date().toLocaleDateString("en-CA", opts);
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

  // scope=etf → only ETF alerts (the every-30-min market-hours run, live
  // Yahoo prices, skips AMFI). scope=mf → only index-fund alerts (the
  // nightly run after AMFI publishes NAV). Omitted/anything else → all.
  const scope = new URL(request.url).searchParams.get("scope");
  const filters = [eq(indexFundAlerts.enabled, true)];
  if (scope === "etf") filters.push(eq(indexFundAlerts.instrumentType, "etf"));
  else if (scope === "mf")
    filters.push(eq(indexFundAlerts.instrumentType, "mf"));

  const alerts = await db
    .select()
    .from(indexFundAlerts)
    .where(and(...filters));

  if (alerts.length === 0) {
    return NextResponse.json({ evaluated: 0, fired: 0, scope: scope ?? "all" });
  }

  // One quote fetch for the distinct instruments referenced by alerts.
  const keys = Array.from(new Set(alerts.map((a) => a.instrumentKey)));
  const quotes = await getQuotes(keys);
  const quoteByKey = new Map(quotes.map((q) => [q.key, q]));

  const vapidReady = ensureVapidConfigured();
  const resolveEmail = await makeEmailResolver();

  let fired = 0;
  let pushSent = 0;
  let emailSent = 0;
  let skippedStale = 0;
  let skippedClosed = 0;

  for (const alert of alerts) {
    const quote = quoteByKey.get(alert.instrumentKey);
    const price = quote?.price ?? null;
    if (price == null) {
      skippedStale++;
      continue;
    }
    // Self-maintaining market-closed guard: on NSE holidays/pre-open, Yahoo
    // returns the previous trading day's ETF price with an old `asOf`. Skip
    // without touching last_value so the next live crossing is still detected.
    // (mf/NAV alerts are once-daily + edge-triggered, so they're exempt.)
    if (alert.instrumentType === "etf" && !isFreshTodayIST(quote?.asOf ?? null)) {
      skippedClosed++;
      continue;
    }
    // The comparison runs on a "measured" value that depends on the mode:
    // amount → the raw price; percent → the % move from a stored base price.
    let measured: number;
    const thresholdValue = Number(alert.threshold);
    if (alert.mode === "percent") {
      const base = alert.basePrice != null ? Number(alert.basePrice) : null;
      if (base == null || base === 0) {
        // No usable reference price → can't measure the % move.
        skippedStale++;
        continue;
      }
      measured = ((price - base) / base) * 100;
    } else {
      measured = price;
    }

    const prev = alert.lastValue != null ? Number(alert.lastValue) : null;
    const meetsNow = meets(alert.condition, measured, thresholdValue);
    const meetsPrev =
      prev != null && meets(alert.condition, prev, thresholdValue);
    const isFreshCrossing = meetsNow && !meetsPrev;

    // Always record the measured value so the next run has a baseline
    // (a % for percent alerts, a price for amount alerts).
    const patch: Record<string, unknown> = {
      lastValue: measured.toString(),
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
      const priceText = price.toLocaleString("en-IN", {
        maximumFractionDigits: 2,
      });
      let body: string;
      if (alert.mode === "percent") {
        const moveSign = measured >= 0 ? "+" : "-";
        const moveText = Math.abs(measured).toLocaleString("en-IN", {
          maximumFractionDigits: 2,
        });
        const thrSign = thresholdValue >= 0 ? "+" : "-";
        const thrText = Math.abs(thresholdValue).toLocaleString("en-IN");
        body = `Now ₹${priceText} (${moveSign}${moveText}% since set) — crossed your ${thrSign}${thrText}% alert.`;
      } else {
        body = `Now ₹${priceText} — ${alert.condition} your ₹${thresholdValue.toLocaleString(
          "en-IN"
        )} alert.`;
      }

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
    scope: scope ?? "all",
    evaluated: alerts.length,
    fired,
    pushSent,
    emailSent,
    skippedStale,
    skippedClosed,
  });
}
