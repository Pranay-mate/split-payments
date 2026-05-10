/**
 * Shared web-push helpers — used by both the daily cron and the tRPC
 * mutations that fire real-time notifications (settlements, etc).
 *
 * Centralised so that:
 *   - VAPID setup happens in exactly one place
 *   - Expired subscription pruning is consistent
 *   - Preferences gate is uniform: prefs.balanceReminders === false
 *     blocks both kinds of pushes
 */

import webpush from "web-push";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/** Reads VAPID keys from env. Returns null if not configured (e.g. local
 *  dev without push). Caller decides whether to fail or no-op. */
export function getVapid(): {
  publicKey: string;
  privateKey: string;
  subject: string;
} | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@easysplits.in";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

/** Sets web-push's global VAPID details. Idempotent — safe to call on
 *  every request. Returns false if keys aren't configured. */
export function ensureVapidConfigured(): boolean {
  const v = getVapid();
  if (!v) return false;
  webpush.setVapidDetails(v.subject, v.publicKey, v.privateKey);
  return true;
}

type Sub = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  preferences: string;
};

/** Single-subscription send. Mirrors the cron's sendOne but exported. */
export async function sendToSubscription(
  sub: Sub,
  payload: PushPayload,
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

/**
 * Send a push to every subscription belonging to a single user.
 * Honours the user's prefs.balanceReminders toggle (treated as a
 * user-wide opt-out for non-anomaly notifications). Prunes 410-Gone
 * subscriptions inline. Best-effort: failures are swallowed so callers
 * can fire-and-forget from a tRPC mutation.
 *
 * Returns the count of successfully delivered pushes. 0 means either
 * no subscriptions, all opt-out, or all failed.
 */
export async function pushToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!ensureVapidConfigured()) return 0;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  let sent = 0;
  for (const sub of subs) {
    let prefs: { balanceReminders?: boolean } = {};
    try {
      prefs = JSON.parse(sub.preferences);
    } catch {
      // empty prefs = default-on
    }
    if (prefs.balanceReminders === false) continue;

    const result = await sendToSubscription(sub, payload);
    if (result === "sent") {
      sent++;
      // Don't touch lastNotifiedAt here — the cron's 7-day throttle is
      // for SCHEDULED reminders only. Real-time event notifications
      // (settlements, recurrences) shouldn't reset that timer.
    } else if (result === "expired") {
      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.id, sub.id),
            eq(pushSubscriptions.userId, userId),
          ),
        );
    }
  }
  return sent;
}
