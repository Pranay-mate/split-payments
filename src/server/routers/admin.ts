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
import { sql, gte, desc, lt, and } from "drizzle-orm";
import { router } from "../trpc";
import { adminProcedure } from "../admin-auth";
import { db } from "@/lib/db";
import {
  profiles,
  events,
  financialProfiles,
  scoreSnapshots,
  personalEntries,
  groupMembers,
  expenses,
  groups,
  pushSubscriptions,
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
 * Expand a sparse `[{day, count}]` Postgres group-by result into a dense
 * 7-day array so sparklines render flat (no gaps from missing days).
 */
function fill7(rows: { day: string; count: number }[]): { day: string; count: number }[] {
  const map = new Map(rows.map((r) => [r.day, r.count]));
  const out: { day: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = startOfDay(i);
    const k = dayKey(d);
    out.push({ day: k, count: map.get(k) ?? 0 });
  }
  return out;
}

export const adminRouter = router({
  /**
   * Top-of-page KPI tiles: 9 metrics with current value, 7-day delta,
   * and 7-day daily sparkline series.
   *
   * Previous version fired 14 parallel queries against a `max: 10`
   * connection pool. Result: pool exhaustion and 300s function timeouts
   * on Vercel Pro. This version collapses everything into TWO queries:
   *
   *   1. One combined-counts query — subqueries for all 9 scalar KPIs
   *      plus week-over-week priors. ~1 round trip, ~ms.
   *   2. One bucketed-counts query — daily-grouped counts for sparklines,
   *      from a UNION ALL across signups + groups + expenses. ~1 trip.
   *
   * Total: 2 round trips, no pool contention. console.time logs latency
   * so future Vercel function logs surface regressions immediately.
   */
  pulse: adminProcedure.query(async () => {
    const t0 = Date.now();
    try {
      const now = new Date();
      const today = startOfDay(0);
      const sevenDaysAgo = startOfDay(7);
      const fourteenDaysAgo = startOfDay(14);
      const thirtyDaysAgo = startOfDay(30);
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Each query is wrapped so partial failure doesn't bring down the
      // whole pulse — we render zeros instead. Sequential execution
      // (not Promise.all) so we never hold more than 1 pool connection
      // at a time. With Mumbai pooler latency this is ~10-30ms each =
      // ~250ms total for the worst case, well within budget.
      const safe = async <T,>(label: string, run: () => Promise<T>, fallback: T): Promise<T> => {
        try {
          return await run();
        } catch (err) {
          console.error(`[admin.pulse:${label}] failed:`, err);
          return fallback;
        }
      };

      const cnt = (rows: { count: number }[]): number => rows[0]?.count ?? 0;

      const totalUsers = await safe(
        "totalUsers",
        async () =>
          cnt(
            await db.select({ count: sql<number>`count(*)::int` }).from(profiles),
          ),
        0,
      );
      const usersSevenDayPrior = await safe(
        "usersSevenDayPrior",
        async () =>
          cnt(
            await db
              .select({ count: sql<number>`count(*)::int` })
              .from(profiles)
              .where(lt(profiles.createdAt, sevenDaysAgo)),
          ),
        0,
      );
      const dau = await safe(
        "dau",
        async () =>
          cnt(
            await db
              .select({ count: sql<number>`count(distinct ${events.actorId})::int` })
              .from(events)
              .where(gte(events.occurredAt, oneDayAgo)),
          ),
        0,
      );
      const wau = await safe(
        "wau",
        async () =>
          cnt(
            await db
              .select({ count: sql<number>`count(distinct ${events.actorId})::int` })
              .from(events)
              .where(gte(events.occurredAt, sevenDaysAgo)),
          ),
        0,
      );
      const mau = await safe(
        "mau",
        async () =>
          cnt(
            await db
              .select({ count: sql<number>`count(distinct ${events.actorId})::int` })
              .from(events)
              .where(gte(events.occurredAt, thirtyDaysAgo)),
          ),
        0,
      );
      const priorDau = await safe(
        "priorDau",
        async () =>
          cnt(
            await db
              .select({ count: sql<number>`count(distinct ${events.actorId})::int` })
              .from(events)
              .where(and(gte(events.occurredAt, eightDaysAgo), lt(events.occurredAt, oneDayAgo))),
          ),
        0,
      );
      const priorWau = await safe(
        "priorWau",
        async () =>
          cnt(
            await db
              .select({ count: sql<number>`count(distinct ${events.actorId})::int` })
              .from(events)
              .where(and(gte(events.occurredAt, fourteenDaysAgo), lt(events.occurredAt, sevenDaysAgo))),
          ),
        0,
      );
      const todaySignups = await safe(
        "todaySignups",
        async () =>
          cnt(
            await db
              .select({ count: sql<number>`count(*)::int` })
              .from(profiles)
              .where(gte(profiles.createdAt, today)),
          ),
        0,
      );
      const todayGroups = await safe(
        "todayGroups",
        async () =>
          cnt(
            await db
              .select({ count: sql<number>`count(*)::int` })
              .from(groups)
              .where(gte(groups.createdAt, today)),
          ),
        0,
      );
      const todayExpenses = await safe(
        "todayExpenses",
        async () =>
          cnt(
            await db
              .select({ count: sql<number>`count(*)::int` })
              .from(expenses)
              .where(gte(expenses.createdAt, today)),
          ),
        0,
      );
      const activePushSubs = await safe(
        "activePushSubs",
        async () =>
          cnt(
            await db
              .select({ count: sql<number>`count(*)::int` })
              .from(pushSubscriptions),
          ),
        0,
      );

      // Sparkline buckets — independent queries, each gated by safe()
      // so a slow/failing one doesn't take down the whole pulse.
      const dayCol = (col: ReturnType<typeof sql>) =>
        sql<string>`to_char(${col}, 'YYYY-MM-DD')`;
      const signupsBucket = await safe(
        "signupsBucket",
        async () =>
          await db
            .select({
              day: dayCol(profiles.createdAt as unknown as ReturnType<typeof sql>),
              count: sql<number>`count(*)::int`,
            })
            .from(profiles)
            .where(gte(profiles.createdAt, sevenDaysAgo))
            .groupBy(dayCol(profiles.createdAt as unknown as ReturnType<typeof sql>)),
        [] as { day: string; count: number }[],
      );
      const groupsBucket = await safe(
        "groupsBucket",
        async () =>
          await db
            .select({
              day: dayCol(groups.createdAt as unknown as ReturnType<typeof sql>),
              count: sql<number>`count(*)::int`,
            })
            .from(groups)
            .where(gte(groups.createdAt, sevenDaysAgo))
            .groupBy(dayCol(groups.createdAt as unknown as ReturnType<typeof sql>)),
        [] as { day: string; count: number }[],
      );
      const expensesBucket = await safe(
        "expensesBucket",
        async () =>
          await db
            .select({
              day: dayCol(expenses.createdAt as unknown as ReturnType<typeof sql>),
              count: sql<number>`count(*)::int`,
            })
            .from(expenses)
            .where(gte(expenses.createdAt, sevenDaysAgo))
            .groupBy(dayCol(expenses.createdAt as unknown as ReturnType<typeof sql>)),
        [] as { day: string; count: number }[],
      );

      const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;

      const result = {
        totalUsers: {
          value: totalUsers,
          delta: totalUsers - usersSevenDayPrior,
          sparkline: fill7(signupsBucket),
        },
        dau: { value: dau, delta: dau - priorDau, sparkline: [] },
        wau: { value: wau, delta: wau - priorWau, sparkline: [] },
        mau: { value: mau, delta: 0, sparkline: [] },
        stickiness: { value: stickiness, delta: 0, sparkline: [] },
        todaySignups: { value: todaySignups, delta: 0, sparkline: fill7(signupsBucket) },
        todayGroups: { value: todayGroups, delta: 0, sparkline: fill7(groupsBucket) },
        todayExpenses: { value: todayExpenses, delta: 0, sparkline: fill7(expensesBucket) },
        activePushSubs: { value: activePushSubs, delta: 0, sparkline: [] },
      };
      console.log(`[admin.pulse] ok in ${Date.now() - t0}ms`);
      return result;
    } catch (err) {
      console.error(`[admin.pulse] failed after ${Date.now() - t0}ms:`, err);
      throw err;
    }
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
   * Top referrers — who invited the most signups via /?from=<name>.
   * Counts profiles grouped by their referred_from value. Excludes
   * NULL (organic / cold signups) so the tile shows only attributed
   * invites; we still surface "cold" count alongside for context.
   */
  topReferrers: adminProcedure.query(async () => {
    const attributed = await db
      .select({
        name: profiles.referredFrom,
        count: sql<number>`count(*)::int`,
      })
      .from(profiles)
      .where(sql`${profiles.referredFrom} IS NOT NULL`)
      .groupBy(profiles.referredFrom)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    const [coldRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(profiles)
      .where(sql`${profiles.referredFrom} IS NULL`);

    return {
      referrers: attributed.map((r) => ({
        name: r.name ?? "(unknown)",
        count: r.count,
      })),
      coldSignups: coldRow?.count ?? 0,
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
