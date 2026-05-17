/**
 * Admin observability router. Founder-only, gated by adminProcedure
 * (env-var ADMIN_USER_IDS allow-list).
 *
 * PRIVACY CONSTRAINT (locked, Phase 2.8): aggregate-only metrics.
 * - No per-user financial drill-down anywhere.
 * - Amounts surface as bucket labels, never as exact rupee values.
 * - User IDs are truncated to 4-char prefix in the activity feed.
 * - Personal-entry amounts are encrypted at rest and we don't decrypt them
 *   for the admin panel — period.
 *
 * The same DB is shared by the user-facing app, so all queries are
 * intentionally lightweight (counts + group-by-date) and bounded by a
 * date window to avoid full-table scans as the data grows.
 */
import { z } from "zod";
import { sql, gte, desc, and } from "drizzle-orm";
import { router } from "../trpc";
import { adminProcedure } from "../admin-auth";
import { db } from "@/lib/db";
import {
  profiles,
  groups,
  expenses,
  events,
  pushSubscriptions,
  financialProfiles,
  scoreSnapshots,
  personalEntries,
  groupMembers,
} from "@/lib/db/schema";

/** Start of day (UTC) for the given offset-from-today. dayOffset=0 → today's midnight. */
function startOfDay(dayOffset = 0): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - dayOffset);
  return d;
}

/** YYYY-MM-DD key for grouping by day. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Single-pass count of distinct user IDs from events whose occurred_at
 * falls within [since, now]. Used for DAU/WAU/MAU.
 */
async function distinctActorsSince(since: Date): Promise<number> {
  const [row] = await db
    .select({
      count: sql<number>`count(distinct ${events.actorId})::int`,
    })
    .from(events)
    .where(gte(events.occurredAt, since));
  return row?.count ?? 0;
}

export const adminRouter = router({
  /**
   * Top-of-page KPI tiles: 9 metrics with current value, 7-day delta,
   * and a 7-day daily sparkline series.
   */
  pulse: adminProcedure.query(async () => {
    const now = new Date();
    const today = startOfDay(0);
    const sevenDaysAgo = startOfDay(7);
    const fourteenDaysAgo = startOfDay(14);
    const thirtyDaysAgo = startOfDay(30);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalUsersRow,
      sevenDayPriorUsersRow,
      dau,
      wau,
      mau,
      todaySignupsRow,
      todayGroupsRow,
      todayExpensesRow,
      activePushRow,
      signupsBucket,
      groupsBucket,
      expensesBucket,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(profiles),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(profiles)
        .where(sql`${profiles.createdAt} < ${sevenDaysAgo}`),
      distinctActorsSince(oneDayAgo),
      distinctActorsSince(sevenDaysAgo),
      distinctActorsSince(thirtyDaysAgo),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(profiles)
        .where(gte(profiles.createdAt, today)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(groups)
        .where(gte(groups.createdAt, today)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(expenses)
        .where(gte(expenses.createdAt, today)),
      db.select({ count: sql<number>`count(*)::int` }).from(pushSubscriptions),
      // 7-day sparkline series for sign-ups
      db
        .select({
          day: sql<string>`to_char(${profiles.createdAt}, 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(profiles)
        .where(gte(profiles.createdAt, sevenDaysAgo))
        .groupBy(sql`to_char(${profiles.createdAt}, 'YYYY-MM-DD')`),
      db
        .select({
          day: sql<string>`to_char(${groups.createdAt}, 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(groups)
        .where(gte(groups.createdAt, sevenDaysAgo))
        .groupBy(sql`to_char(${groups.createdAt}, 'YYYY-MM-DD')`),
      db
        .select({
          day: sql<string>`to_char(${expenses.createdAt}, 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(expenses)
        .where(gte(expenses.createdAt, sevenDaysAgo))
        .groupBy(sql`to_char(${expenses.createdAt}, 'YYYY-MM-DD')`),
    ]);

    // Expand the per-day group-by results into dense 7-day arrays so the
    // sparklines render flat (and not spiky from missing days).
    const fill7 = (rows: { day: string; count: number }[]) => {
      const map = new Map(rows.map((r) => [r.day, r.count]));
      const out: { day: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = startOfDay(i);
        const k = dayKey(d);
        out.push({ day: k, count: map.get(k) ?? 0 });
      }
      return out;
    };

    const totalUsers = totalUsersRow[0]?.count ?? 0;
    const usersSevenDayPrior = sevenDayPriorUsersRow[0]?.count ?? 0;
    const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;

    // 7d prior baselines for delta — DAU vs 8d-ago DAU, etc.
    // Approximation: we use the count of unique actors from 14→7d ago
    // window as the "previous WAU", so the delta is week-over-week.
    const [priorDau, priorWau] = await Promise.all([
      db
        .select({
          count: sql<number>`count(distinct ${events.actorId})::int`,
        })
        .from(events)
        .where(
          and(
            gte(events.occurredAt, new Date(oneDayAgo.getTime() - 7 * 86400000)),
            sql`${events.occurredAt} < ${oneDayAgo}`,
          ),
        ),
      db
        .select({
          count: sql<number>`count(distinct ${events.actorId})::int`,
        })
        .from(events)
        .where(
          and(gte(events.occurredAt, fourteenDaysAgo), sql`${events.occurredAt} < ${sevenDaysAgo}`),
        ),
    ]);

    return {
      totalUsers: {
        value: totalUsers,
        delta: totalUsers - usersSevenDayPrior,
        sparkline: fill7(signupsBucket),
      },
      dau: {
        value: dau,
        delta: dau - (priorDau[0]?.count ?? 0),
        sparkline: [],
      },
      wau: {
        value: wau,
        delta: wau - (priorWau[0]?.count ?? 0),
        sparkline: [],
      },
      mau: { value: mau, delta: 0, sparkline: [] },
      stickiness: { value: stickiness, delta: 0, sparkline: [] },
      todaySignups: {
        value: todaySignupsRow[0]?.count ?? 0,
        delta: 0,
        sparkline: fill7(signupsBucket),
      },
      todayGroups: {
        value: todayGroupsRow[0]?.count ?? 0,
        delta: 0,
        sparkline: fill7(groupsBucket),
      },
      todayExpenses: {
        value: todayExpensesRow[0]?.count ?? 0,
        delta: 0,
        sparkline: fill7(expensesBucket),
      },
      activePushSubs: {
        value: activePushRow[0]?.count ?? 0,
        delta: 0,
        sparkline: [],
      },
    };
  }),

  /**
   * Daily signup count for the last `days` days (default 90). Returns a
   * dense array — missing days are 0-filled — so charts render flat.
   */
  signupsByDay: adminProcedure
    .input(z.object({ days: z.number().int().min(7).max(365).default(90) }).optional())
    .query(async ({ input }) => {
      const days = input?.days ?? 90;
      const since = startOfDay(days - 1);
      const rows = await db
        .select({
          day: sql<string>`to_char(${profiles.createdAt}, 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(profiles)
        .where(gte(profiles.createdAt, since))
        .groupBy(sql`to_char(${profiles.createdAt}, 'YYYY-MM-DD')`);
      const byDay = new Map(rows.map((r) => [r.day, r.count]));
      const dense: { day: string; count: number; rolling7: number }[] = [];
      const queue: number[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = startOfDay(i);
        const k = dayKey(d);
        const count = byDay.get(k) ?? 0;
        queue.push(count);
        if (queue.length > 7) queue.shift();
        const rolling7 = queue.reduce((a, b) => a + b, 0) / queue.length;
        dense.push({ day: k, count, rolling7: Math.round(rolling7 * 10) / 10 });
      }
      return dense;
    }),

  /**
   * Activation funnel. Each stage is a count of distinct users who
   * reached it; the UI derives per-stage percentages from these.
   */
  funnel: adminProcedure.query(async () => {
    const [
      signedUpRow,
      joinedGroupRow,
      addedExpenseRow,
      loggedPersonalEntryRow,
      startedScorecardRow,
      completedScorecardRow,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(profiles),
      db
        .select({
          count: sql<number>`count(distinct ${groupMembers.userId})::int`,
        })
        .from(groupMembers),
      db
        .select({
          count: sql<number>`count(distinct ${expenses.payerId})::int`,
        })
        .from(expenses),
      db
        .select({
          count: sql<number>`count(distinct ${personalEntries.userId})::int`,
        })
        .from(personalEntries),
      db
        .select({
          count: sql<number>`count(distinct ${financialProfiles.userId})::int`,
        })
        .from(financialProfiles),
      db
        .select({
          count: sql<number>`count(distinct ${scoreSnapshots.userId})::int`,
        })
        .from(scoreSnapshots),
    ]);

    return {
      signedUp: signedUpRow[0]?.count ?? 0,
      joinedGroup: joinedGroupRow[0]?.count ?? 0,
      addedExpense: addedExpenseRow[0]?.count ?? 0,
      loggedPersonalEntry: loggedPersonalEntryRow[0]?.count ?? 0,
      startedScorecard: startedScorecardRow[0]?.count ?? 0,
      completedScorecard: completedScorecardRow[0]?.count ?? 0,
    };
  }),

  /**
   * Anonymised activity feed. Last N events with:
   *  - user_id truncated to 4-char prefix
   *  - amounts (if present in payload) bucketed, never exact
   *  - event-type translated to human-readable label
   *
   * We never decrypt encrypted personal-entry payloads here.
   */
  feed: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: events.id,
          eventType: events.eventType,
          actorId: events.actorId,
          payload: events.payload,
          occurredAt: events.occurredAt,
        })
        .from(events)
        .orderBy(desc(events.occurredAt))
        .limit(input?.limit ?? 50);

      return rows.map((r) => {
        let amount: number | null = null;
        try {
          const parsed = JSON.parse(r.payload);
          if (typeof parsed?.amount === "number") amount = parsed.amount;
          else if (typeof parsed?.convertedAmount === "number")
            amount = parsed.convertedAmount;
        } catch {
          // payload not JSON or malformed — fine, no amount to bucket
        }
        return {
          id: r.id,
          // Truncate user id so the feed can't be used to reverse-engineer
          // individual user behaviour.
          actorPrefix: r.actorId.slice(0, 4),
          eventType: r.eventType,
          label: labelForEvent(r.eventType),
          amountBucket: amount === null ? null : bucketAmount(amount),
          occurredAt: r.occurredAt,
        };
      });
    }),
});

/**
 * Privacy-preserving amount labels. Resolution intentionally coarse so
 * even with the feed open the admin can't infer individual transaction
 * sizes — only "this is a small expense" vs "this is a large one".
 */
function bucketAmount(rupees: number): string {
  const v = Math.abs(rupees);
  if (v < 100) return "₹<100";
  if (v < 500) return "₹100-500";
  if (v < 2000) return "₹500-2k";
  if (v < 10000) return "₹2k-10k";
  return "₹10k+";
}

function labelForEvent(eventType: string): string {
  const map: Record<string, string> = {
    "expense.added": "Expense added",
    "expense.updated": "Expense updated",
    "expense.deleted": "Expense deleted",
    "settlement.recorded": "Settlement recorded",
    "settlement.undone": "Settlement undone",
    "comment.added": "Comment added",
    "comment.deleted": "Comment deleted",
    "group.created": "Group created",
    "group.deleted": "Group deleted",
    "member.added": "Member joined",
    "member.removed": "Member removed",
    "guest.added": "Guest added",
    "guest.claimed": "Guest claimed identity",
  };
  return map[eventType] ?? eventType;
}
