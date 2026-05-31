import { z } from "zod";
import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import {
  anomalyMutes,
  financialGoals,
  financialProfiles,
  personalDebts,
  personalEntries,
  personalHoldings,
  personalNetWorthSnapshots,
  personalRecurrences,
  scoreSnapshots,
} from "@/lib/db/schema";
import { computeNextDue } from "@/lib/recurrence";
import { CATEGORY_KEYS } from "@/lib/categories";
import {
  decryptAmount,
  decryptValue,
  encryptAmount,
  encryptValue,
} from "@/lib/encryption";
import { computeScore, type ScoreInputs } from "@/lib/financial-score";
import { detectAnomalies } from "@/lib/anomaly-detect";
import {
  outstandingAt,
  totalOutstandingAt,
  monthsToFreedom,
  freedomDate,
  debtTrajectory,
  type LoanSnapshot,
} from "@/lib/amortise";

/** Decrypt + shape every active debt for a user into the LoanSnapshot
 *  type used by the amortisation library. Centralised so all the net-worth
 *  / debt queries below stay in sync. */
async function loadActiveLoans(userId: string): Promise<
  (LoanSnapshot & { id: string; name: string; debtType: string })[]
> {
  const rows = await db
    .select()
    .from(personalDebts)
    .where(
      and(eq(personalDebts.userId, userId), isNull(personalDebts.archivedAt)),
    );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    debtType: r.debtType,
    principal: decryptAmount(r.principal),
    emi: decryptAmount(r.emi),
    annualRatePct: Number(r.annualRatePct),
    startDate: new Date(r.startDate),
  }));
}

const typeSchema = z.enum(["income", "expense", "investment"]);
const categorySchema = z.enum(CATEGORY_KEYS);

const currencySchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, "3-letter ISO 4217 currency");

/** Today's calendar date in 'YYYY-MM-DD' (UTC). Snapshots use UTC so two
 *  edits on the same calendar day collapse no matter where the user is. */
function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Recompute net worth from current state and upsert today's snapshot.
 * Called from any mutation that changes the underlying inputs (holdings
 * CRUD or financial-profile liquid_savings update). Fire-and-forget at
 * the call sites — failures shouldn't block the user mutation.
 */
async function recordNetWorthSnapshot(userId: string): Promise<void> {
  try {
    const [profile] = await db
      .select()
      .from(financialProfiles)
      .where(eq(financialProfiles.userId, userId))
      .limit(1);
    const liquidSavings =
      profile?.liquidSavings !== null && profile?.liquidSavings !== undefined
        ? decryptAmount(profile.liquidSavings)
        : 0;
    const holdingsRows = await db
      .select()
      .from(personalHoldings)
      .where(
        and(
          eq(personalHoldings.userId, userId),
          isNull(personalHoldings.archivedAt),
        ),
      );
    let holdingsValue = 0;
    for (const h of holdingsRows) {
      holdingsValue += decryptAmount(h.currentValue);
    }
    // Subtract active loans' outstanding balance from net worth so the
    // trajectory chart shows the true number, not just assets.
    const loans = await loadActiveLoans(userId);
    const debtsValue = totalOutstandingAt(loans, new Date());
    const totalValue = liquidSavings + holdingsValue - debtsValue;
    const snapshotDate = todayISODate();

    // Upsert: same (user, date) collapses to one row — last write wins.
    await db
      .insert(personalNetWorthSnapshots)
      .values({
        userId,
        snapshotDate,
        totalValue: encryptAmount(totalValue),
        liquidSavings: encryptAmount(liquidSavings),
        holdingsValue: encryptAmount(holdingsValue),
      })
      .onConflictDoUpdate({
        target: [
          personalNetWorthSnapshots.userId,
          personalNetWorthSnapshots.snapshotDate,
        ],
        set: {
          totalValue: encryptAmount(totalValue),
          liquidSavings: encryptAmount(liquidSavings),
          holdingsValue: encryptAmount(holdingsValue),
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    // Snapshot failures shouldn't break user mutations — log + swallow.
    console.error("[netWorthSnapshot] failed", err);
  }
}

/** Parse "2026-05" into the [start, nextMonthStart) bounds for a SQL range. */
function monthBounds(monthKey: string | undefined): {
  start: Date;
  end: Date;
  label: string;
} {
  const now = new Date();
  let year: number;
  let month: number; // 0-indexed
  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
    const [y, m] = monthKey.split("-").map(Number);
    year = y;
    month = m - 1;
  } else {
    year = now.getFullYear();
    month = now.getMonth();
  }
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  const label = start.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  return { start, end, label };
}

export const personalRouter = router({
  /** List the calling user's entries, optionally filtered by month/type. */
  list: protectedProcedure
    .input(
      z
        .object({
          month: z
            .string()
            .regex(/^\d{4}-\d{2}$/)
            .optional(),
          type: typeSchema.optional(),
          limit: z.number().int().min(1).max(500).default(100),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const filters = [
        eq(personalEntries.userId, ctx.user.id),
        isNull(personalEntries.deletedAt),
      ];
      if (input?.month) {
        const { start, end } = monthBounds(input.month);
        filters.push(gte(personalEntries.occurredAt, start));
        filters.push(lt(personalEntries.occurredAt, end));
      }
      if (input?.type) {
        filters.push(eq(personalEntries.type, input.type));
      }
      const rows = await db
        .select()
        .from(personalEntries)
        .where(and(...filters))
        .orderBy(desc(personalEntries.occurredAt))
        .limit(input?.limit ?? 100);
      return rows.map((r) => ({
        ...r,
        // Decrypt the encrypted columns. AES-GCM auth-tag verification
        // means tampered or empty-string fields throw — surface those
        // as a clear server error rather than silently returning 0/"".
        amount: decryptAmount(r.amount),
        description: decryptValue(r.description),
      }));
    }),

  /** Headline KPIs for the dashboard hero. Server-computed so the math
   *  stays consistent with whatever filters the client uses.
   *
   *  Amounts are encrypted, so SUM() in SQL doesn't work — we pull every
   *  row for the month, decrypt, and aggregate in app. For personal data
   *  (typically <500 entries/month per user) this is cheap. */
  summary: protectedProcedure
    .input(
      z
        .object({
          month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { start, end, label } = monthBounds(input?.month);
      const rows = await db
        .select({
          type: personalEntries.type,
          amount: personalEntries.amount,
        })
        .from(personalEntries)
        .where(
          and(
            eq(personalEntries.userId, ctx.user.id),
            isNull(personalEntries.deletedAt),
            gte(personalEntries.occurredAt, start),
            lt(personalEntries.occurredAt, end),
          ),
        );

      const byType: Record<string, { total: number; count: number }> = {};
      for (const r of rows) {
        const amt = decryptAmount(r.amount);
        const bucket = (byType[r.type] ??= { total: 0, count: 0 });
        bucket.total += amt;
        bucket.count += 1;
      }
      const income = byType.income?.total ?? 0;
      const expenses = byType.expense?.total ?? 0;
      const investments = byType.investment?.total ?? 0;
      const net = income - expenses - investments;
      const savingsRate = income > 0 ? net / income : 0;
      return {
        monthLabel: label,
        income: Math.round(income * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        investments: Math.round(investments * 100) / 100,
        net: Math.round(net * 100) / 100,
        savingsRate,
        entryCounts: {
          income: byType.income?.count ?? 0,
          expense: byType.expense?.count ?? 0,
          investment: byType.investment?.count ?? 0,
        },
      };
    }),

  /** Top categories for the current month. Used in the dashboard list.
   *  Same encryption-aware aggregation as `summary`. */
  topCategoriesThisMonth: protectedProcedure
    .input(
      z
        .object({
          month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
          limit: z.number().int().min(1).max(20).default(5),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { start, end } = monthBounds(input?.month);
      const rows = await db
        .select({
          category: personalEntries.category,
          amount: personalEntries.amount,
        })
        .from(personalEntries)
        .where(
          and(
            eq(personalEntries.userId, ctx.user.id),
            isNull(personalEntries.deletedAt),
            eq(personalEntries.type, "expense"),
            gte(personalEntries.occurredAt, start),
            lt(personalEntries.occurredAt, end),
          ),
        );
      const byCat = new Map<string, number>();
      for (const r of rows) {
        const amt = decryptAmount(r.amount);
        byCat.set(r.category, (byCat.get(r.category) ?? 0) + amt);
      }
      return Array.from(byCat.entries())
        .map(([category, total]) => ({
          category,
          total: Math.round(total * 100) / 100,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, input?.limit ?? 5);
    }),

  /**
   * Monthly review — single-roundtrip aggregation for the modal that
   * pops on the first /app/personal load in a new month. Computes
   * top categories vs previous month, savings-rate delta, biggest
   * pillar improvement, and a "watch out" category increase.
   *
   * Defaults to the *previous* month relative to the server clock,
   * since that's what the modal celebrates.
   */
  monthlyReview: protectedProcedure
    .input(
      z
        .object({
          month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      // Default = previous calendar month.
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const defaultKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
      const monthKey = input?.month ?? defaultKey;

      // Bounds for the target month and the one before it (for deltas).
      const target = monthBounds(monthKey);
      const [ty, tm] = monthKey.split("-").map(Number);
      const beforeKey = `${tm === 1 ? ty - 1 : ty}-${String(tm === 1 ? 12 : tm - 1).padStart(2, "0")}`;
      const before = monthBounds(beforeKey);

      // Pull both months in one go; we'll bucket in memory.
      const rows = await db
        .select({
          type: personalEntries.type,
          category: personalEntries.category,
          amount: personalEntries.amount,
          occurredAt: personalEntries.occurredAt,
        })
        .from(personalEntries)
        .where(
          and(
            eq(personalEntries.userId, ctx.user.id),
            isNull(personalEntries.deletedAt),
            gte(personalEntries.occurredAt, before.start),
            lt(personalEntries.occurredAt, target.end),
          ),
        );

      const targetTotals = { income: 0, expenses: 0, investments: 0, count: 0 };
      const beforeTotals = { income: 0, expenses: 0, investments: 0, count: 0 };
      const targetByCat = new Map<string, number>();
      const beforeByCat = new Map<string, number>();

      for (const r of rows) {
        const amt = decryptAmount(r.amount);
        const isTarget = r.occurredAt >= target.start;
        const totals = isTarget ? targetTotals : beforeTotals;
        totals.count += 1;
        if (r.type === "income") totals.income += amt;
        else if (r.type === "expense") totals.expenses += amt;
        else if (r.type === "investment") totals.investments += amt;
        if (r.type === "expense") {
          const map = isTarget ? targetByCat : beforeByCat;
          map.set(r.category, (map.get(r.category) ?? 0) + amt);
        }
      }

      const savingsRate = (t: typeof targetTotals) =>
        t.income > 0 ? (t.income - t.expenses - t.investments) / t.income : 0;
      const targetSavingsRate = savingsRate(targetTotals);
      const beforeSavingsRate = savingsRate(beforeTotals);
      const savingsRateDelta =
        beforeTotals.income > 0
          ? targetSavingsRate - beforeSavingsRate
          : null;

      const topCategories = Array.from(targetByCat.entries())
        .map(([category, total]) => {
          const prev = beforeByCat.get(category) ?? 0;
          const deltaPct = prev > 0 ? (total - prev) / prev : null;
          return {
            category,
            total: Math.round(total * 100) / 100,
            prevTotal: Math.round(prev * 100) / 100,
            deltaPct,
          };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);

      // "Biggest win" — first try a pillar improvement, then fall back to
      // a savings-rate jump. Only meaningful if both months have data.
      let biggestWin: {
        type: "pillar" | "savings-rate";
        label: string;
        detail: string;
      } | null = null;
      const snapshots = await db
        .select()
        .from(scoreSnapshots)
        .where(
          and(
            eq(scoreSnapshots.userId, ctx.user.id),
            gte(scoreSnapshots.snapshottedAt, before.start),
            lt(scoreSnapshots.snapshottedAt, target.end),
          ),
        )
        .orderBy(asc(scoreSnapshots.snapshottedAt));
      const targetSnap = snapshots
        .filter((s) => s.snapshottedAt >= target.start)
        .pop();
      const beforeSnap = snapshots
        .filter((s) => s.snapshottedAt < target.start)
        .pop();
      if (targetSnap && beforeSnap) {
        try {
          const targetP = JSON.parse(targetSnap.pillarScores) as Record<
            string,
            number
          >;
          const beforeP = JSON.parse(beforeSnap.pillarScores) as Record<
            string,
            number
          >;
          const labels: Record<string, string> = {
            emergency: "Emergency fund",
            insurance: "Insurance",
            debt: "Debt",
            savingsRate: "Savings rate",
            investing: "Investing",
          };
          let bestKey: string | null = null;
          let bestDelta = 0;
          for (const k of Object.keys(targetP)) {
            const d = (targetP[k] ?? 0) - (beforeP[k] ?? 0);
            if (d > bestDelta) {
              bestDelta = d;
              bestKey = k;
            }
          }
          if (bestKey && bestDelta > 0) {
            biggestWin = {
              type: "pillar",
              label: `${labels[bestKey] ?? bestKey} pillar +${bestDelta} pts`,
              detail: "Your scorecard moved in the right direction.",
            };
          }
        } catch {
          // bad JSON — silently skip the pillar win
        }
      }
      if (
        !biggestWin &&
        savingsRateDelta !== null &&
        savingsRateDelta > 0.02
      ) {
        biggestWin = {
          type: "savings-rate",
          label: `Savings rate up ${(savingsRateDelta * 100).toFixed(1)} pts`,
          detail: "More of your income made it through the month.",
        };
      }

      // "Watch out" — biggest category increase (vs prev month) where
      // both months had spend so the delta is meaningful.
      let watchOut: {
        category: string;
        total: number;
        deltaPct: number;
      } | null = null;
      let worstDelta = 0;
      for (const [category, total] of targetByCat.entries()) {
        const prev = beforeByCat.get(category) ?? 0;
        if (prev <= 0 || total < 500) continue; // skip tiny categories
        const deltaPct = (total - prev) / prev;
        if (deltaPct > 0.2 && deltaPct > worstDelta) {
          worstDelta = deltaPct;
          watchOut = {
            category,
            total: Math.round(total * 100) / 100,
            deltaPct,
          };
        }
      }

      const hasEnoughData = targetTotals.count >= 5;

      return {
        monthKey,
        monthLabel: target.label,
        hasEnoughData,
        income: Math.round(targetTotals.income * 100) / 100,
        expenses: Math.round(targetTotals.expenses * 100) / 100,
        investments: Math.round(targetTotals.investments * 100) / 100,
        net:
          Math.round(
            (targetTotals.income -
              targetTotals.expenses -
              targetTotals.investments) *
              100,
          ) / 100,
        savingsRate: targetSavingsRate,
        savingsRateDelta,
        entryCount: targetTotals.count,
        topCategories,
        biggestWin,
        watchOut,
      };
    }),

  /**
   * Multi-month trend for the year-over-year card. Pulls the last
   * `months` calendar months (default 13 so the chart shows current
   * month + 12 prior — drives YoY same-month deltas) and aggregates
   * each into income / expenses / investments / savings-rate.
   *
   * Returns oldest → newest so the chart paints left-to-right
   * naturally. Empty months are filled with zeros so the bar chart
   * doesn't collapse gaps and the "spent ₹0 in May" row is honest
   * about reality.
   */
  yearlyTrend: protectedProcedure
    .input(
      z
        .object({ months: z.number().int().min(2).max(36).default(13) })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const months = input?.months ?? 13;
      const now = new Date();
      // Floor to the first day of the current month so partial-month
      // counts in the latest bucket don't get dropped.
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const start = new Date(
        end.getFullYear(),
        end.getMonth() - months,
        1,
      );

      const rows = await db
        .select({
          type: personalEntries.type,
          amount: personalEntries.amount,
          occurredAt: personalEntries.occurredAt,
        })
        .from(personalEntries)
        .where(
          and(
            eq(personalEntries.userId, ctx.user.id),
            isNull(personalEntries.deletedAt),
            gte(personalEntries.occurredAt, start),
            lt(personalEntries.occurredAt, end),
          ),
        );

      // Seed every bucket so empty months render as zeros (chart needs
      // a continuous x-axis to communicate "we ran the math, you had
      // no entries" vs "the bucket is missing").
      const buckets = new Map<
        string,
        {
          monthKey: string;
          monthLabel: string;
          income: number;
          expenses: number;
          investments: number;
          entryCount: number;
        }
      >();
      for (let i = 0; i < months; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        buckets.set(key, {
          monthKey: key,
          monthLabel: d.toLocaleDateString("en-US", {
            month: "short",
            year: "2-digit",
          }),
          income: 0,
          expenses: 0,
          investments: 0,
          entryCount: 0,
        });
      }

      for (const r of rows) {
        const d = r.occurredAt;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const b = buckets.get(key);
        if (!b) continue;
        const amt = decryptAmount(r.amount);
        b.entryCount += 1;
        if (r.type === "income") b.income += amt;
        else if (r.type === "expense") b.expenses += amt;
        else if (r.type === "investment") b.investments += amt;
      }

      const series = Array.from(buckets.values()).map((b) => ({
        monthKey: b.monthKey,
        monthLabel: b.monthLabel,
        income: Math.round(b.income * 100) / 100,
        expenses: Math.round(b.expenses * 100) / 100,
        investments: Math.round(b.investments * 100) / 100,
        net: Math.round((b.income - b.expenses - b.investments) * 100) / 100,
        savingsRate:
          b.income > 0 ? (b.income - b.expenses - b.investments) / b.income : 0,
        entryCount: b.entryCount,
      }));

      // YoY same-month comparison — only fires when the series spans
      // ≥13 months so the bookend pair exists.
      const latest = series[series.length - 1];
      const yoyMatch = series[series.length - 13];
      const yoy =
        yoyMatch && latest
          ? {
              latestMonth: latest,
              priorYearMonth: yoyMatch,
              expensesDeltaPct:
                yoyMatch.expenses > 0
                  ? (latest.expenses - yoyMatch.expenses) / yoyMatch.expenses
                  : null,
              savingsRateDelta: latest.savingsRate - yoyMatch.savingsRate,
            }
          : null;

      return { series, yoy };
    }),

  create: protectedProcedure
    .input(
      z.object({
        type: typeSchema,
        amount: z.number().positive(),
        currency: currencySchema.default("INR"),
        category: categorySchema.default("other"),
        description: z.string().max(200).default(""),
        occurredAt: z.date().optional(),
        clientEventId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Idempotent if clientEventId supplied — same pattern as the group
      // expense router so offline-queued creates don't duplicate.
      if (input.clientEventId) {
        const [existing] = await db
          .select()
          .from(personalEntries)
          .where(eq(personalEntries.id, input.clientEventId))
          .limit(1);
        if (existing) return existing;
      }

      const [created] = await db
        .insert(personalEntries)
        .values({
          ...(input.clientEventId && { id: input.clientEventId }),
          userId: ctx.user.id,
          type: input.type,
          amount: encryptAmount(input.amount),
          currency: input.currency,
          category: input.category,
          description: encryptValue(input.description.trim()),
          occurredAt: input.occurredAt ?? new Date(),
        })
        .returning();
      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create entry",
        });
      }
      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        type: typeSchema,
        amount: z.number().positive(),
        currency: currencySchema,
        category: categorySchema,
        description: z.string().max(200).default(""),
        occurredAt: z.date().optional(),
        clientUpdatedAt: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(personalEntries)
        .where(eq(personalEntries.id, input.id))
        .limit(1);
      if (!existing || existing.userId !== ctx.user.id || existing.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
      }
      // LWW: reject stale offline updates so concurrent edits don't clobber.
      if (input.clientUpdatedAt) {
        const existingTime = new Date(existing.updatedAt).getTime();
        if (input.clientUpdatedAt.getTime() < existingTime) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Someone else made a more recent edit. Refresh to see the latest version.",
          });
        }
      }
      const [updated] = await db
        .update(personalEntries)
        .set({
          type: input.type,
          amount: encryptAmount(input.amount),
          currency: input.currency,
          category: input.category,
          description: encryptValue(input.description.trim()),
          ...(input.occurredAt && { occurredAt: input.occurredAt }),
          updatedAt: new Date(),
        })
        .where(eq(personalEntries.id, input.id))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select({ userId: personalEntries.userId })
        .from(personalEntries)
        .where(eq(personalEntries.id, input.id))
        .limit(1);
      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
      }
      await db
        .update(personalEntries)
        .set({ deletedAt: new Date() })
        .where(eq(personalEntries.id, input.id));
      return { ok: true };
    }),

  /**
   * One-shot recovery for entries created with the pre-2026-06-01 client.
   *
   * Old client did `new Date(\`${YYYY-MM-DD}T00:00:00\`)`, which parses
   * as the user's local timezone. For an IST user (+5:30), every "today"
   * entry was stored as `(previous-day)T18:30:00Z` — which the server's
   * UTC month-bounds query then placed in the wrong calendar month.
   *
   * Signature: any entry whose `occurred_at` UTC time-of-day is exactly
   * `HH:MM:SS = 18:30:00` was created via that buggy path from IST. Shift
   * those forward by 5h30 so they land at UTC midnight of the day the
   * user originally picked. Idempotent — the new client writes UTC
   * midnight, so re-running finds nothing to shift.
   *
   * Caller-scoped: only touches the calling user's rows. No admin
   * privilege needed.
   */
  shiftLegacyTimezoneEntries: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await db.execute(sql`
      UPDATE personal_entries
      SET occurred_at = occurred_at + INTERVAL '5 hours 30 minutes',
          updated_at = now()
      WHERE user_id = ${ctx.user.id}
        AND deleted_at IS NULL
        AND EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'UTC') = 18
        AND EXTRACT(MINUTE FROM occurred_at AT TIME ZONE 'UTC') = 30
        AND EXTRACT(SECOND FROM occurred_at AT TIME ZONE 'UTC') = 0
    `);
    // node-postgres returns a result with rowCount; drizzle exposes it.
    const shifted =
      (result as unknown as { rowCount?: number; count?: number }).rowCount ??
      (result as unknown as { rowCount?: number; count?: number }).count ??
      0;
    return { shifted };
  }),

  /**
   * Last N months of aggregated income / expense / investment for trend
   * charts. Encryption-aware (decrypts in app, like summary). Returns the
   * series in chronological order so the chart can render left-to-right.
   */
  monthlyTrend: protectedProcedure
    .input(
      z
        .object({
          months: z.number().int().min(1).max(24).default(6),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const monthsBack = input?.months ?? 6;
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const rows = await db
        .select({
          type: personalEntries.type,
          amount: personalEntries.amount,
          occurredAt: personalEntries.occurredAt,
        })
        .from(personalEntries)
        .where(
          and(
            eq(personalEntries.userId, ctx.user.id),
            isNull(personalEntries.deletedAt),
            gte(personalEntries.occurredAt, start),
            lt(personalEntries.occurredAt, end),
          ),
        );

      type Bucket = { income: number; expenses: number; investments: number };
      const byMonth = new Map<string, Bucket>();
      // Pre-seed every month in the range so empty months show as zero
      // (otherwise the chart skips and the x-axis gets gaps).
      for (let i = 0; i < monthsBack; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1 - i), 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        byMonth.set(key, { income: 0, expenses: 0, investments: 0 });
      }
      for (const r of rows) {
        const d = new Date(r.occurredAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const bucket = byMonth.get(key);
        if (!bucket) continue;
        const amt = decryptAmount(r.amount);
        if (r.type === "income") bucket.income += amt;
        else if (r.type === "expense") bucket.expenses += amt;
        else if (r.type === "investment") bucket.investments += amt;
      }
      return Array.from(byMonth.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([monthKey, bucket]) => ({
          monthKey,
          monthLabel: new Date(`${monthKey}-01T00:00:00`).toLocaleDateString(
            undefined,
            { month: "short" },
          ),
          income: Math.round(bucket.income * 100) / 100,
          expenses: Math.round(bucket.expenses * 100) / 100,
          investments: Math.round(bucket.investments * 100) / 100,
          net:
            Math.round(
              (bucket.income - bucket.expenses - bucket.investments) * 100,
            ) / 100,
        }));
    }),

  /**
   * Detect spending anomalies in the current month — categories where
   * spend is meaningfully above the user's own historical average. Used
   * by the dashboard banner and by the cron's anomaly-push pass.
   */
  anomalies: protectedProcedure.query(async ({ ctx }) => {
    // Pull the last 7 months of expense entries (current + 6 baseline).
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const rows = await db
      .select({
        category: personalEntries.category,
        amount: personalEntries.amount,
        occurredAt: personalEntries.occurredAt,
      })
      .from(personalEntries)
      .where(
        and(
          eq(personalEntries.userId, ctx.user.id),
          isNull(personalEntries.deletedAt),
          eq(personalEntries.type, "expense"),
          gte(personalEntries.occurredAt, start),
          lt(personalEntries.occurredAt, end),
        ),
      );

    const decryptedEntries = rows.map((r) => {
      const d = new Date(r.occurredAt);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return {
        monthKey,
        category: r.category,
        amount: decryptAmount(r.amount),
      };
    });

    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const detected = detectAnomalies(decryptedEntries, currentMonthKey);

    // Filter out user-muted categories. Pull active mutes (muted_until > now)
    // and drop matching anomalies.
    if (detected.length > 0) {
      const activeMutes = await db
        .select({ category: anomalyMutes.category })
        .from(anomalyMutes)
        .where(
          and(
            eq(anomalyMutes.userId, ctx.user.id),
            gte(anomalyMutes.mutedUntil, now),
          ),
        );
      const mutedSet = new Set(activeMutes.map((m) => m.category));
      return detected.filter((a) => !mutedSet.has(a.category));
    }
    return detected;
  }),

  /** List of months the user has any entry in — populates a month picker. */
  availableMonths: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        monthKey: sql<string>`TO_CHAR(${personalEntries.occurredAt}, 'YYYY-MM')`,
      })
      .from(personalEntries)
      .where(
        and(
          eq(personalEntries.userId, ctx.user.id),
          isNull(personalEntries.deletedAt),
        ),
      )
      .groupBy(sql`TO_CHAR(${personalEntries.occurredAt}, 'YYYY-MM')`)
      .orderBy(asc(sql`TO_CHAR(${personalEntries.occurredAt}, 'YYYY-MM')`));
    return rows.map((r) => r.monthKey);
  }),

  /**
   * Financial Health Scorecard (v3) — read the user's profile,
   * decrypt sensitive fields, and return both the raw inputs (for
   * the wizard's prefill) and the computed 5-pillar score.
   */
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const [row] = await db
        .select()
        .from(financialProfiles)
        .where(eq(financialProfiles.userId, ctx.user.id))
        .limit(1);
      if (!row) {
        return {
          exists: false as const,
          inputs: null,
          score: null,
        };
      }
      // Decrypt every encrypted column. Null stays null (incomplete onboarding).
      const decrypt = (s: string | null): number | null =>
        s === null ? null : decryptAmount(s);
      const inputs: ScoreInputs = {
        age: row.age,
        retirementAge: row.retirementAge,
        isFreelancer: row.isFreelancer,
        hasDependents: row.hasDependents,
        hasCcCarryover: row.hasCcCarryover,
        monthlyIncome: decrypt(row.monthlyIncome),
        monthlyExpenses: decrypt(row.monthlyExpenses),
        liquidSavings: decrypt(row.liquidSavings),
        termCoverAmount: decrypt(row.termCoverAmount),
        healthCoverAmount: decrypt(row.healthCoverAmount),
        totalEmi: decrypt(row.totalEmi),
        investmentBalance: decrypt(row.investmentBalance),
        monthlyInvestment: decrypt(row.monthlyInvestment),
      };
      return {
        exists: true as const,
        inputs,
        score: computeScore(inputs),
        completedAt: row.completedAt,
        updatedAt: row.updatedAt,
      };
    }),

    /** Save the wizard's outputs. Upserts by user_id; overwrites all
     *  fields (the form sends the full profile back). */
    upsert: protectedProcedure
      .input(
        z.object({
          age: z.number().int().min(13).max(110).nullable(),
          retirementAge: z.number().int().min(30).max(110).nullable(),
          isFreelancer: z.boolean(),
          hasDependents: z.boolean(),
          hasCcCarryover: z.boolean(),
          monthlyIncome: z.number().nonnegative().nullable(),
          monthlyExpenses: z.number().nonnegative().nullable(),
          liquidSavings: z.number().nonnegative().nullable(),
          termCoverAmount: z.number().nonnegative().nullable(),
          healthCoverAmount: z.number().nonnegative().nullable(),
          totalEmi: z.number().nonnegative().nullable(),
          investmentBalance: z.number().nonnegative().nullable(),
          monthlyInvestment: z.number().nonnegative().nullable(),
          markCompleted: z.boolean().default(false),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const enc = (n: number | null): string | null =>
          n === null ? null : encryptAmount(n);
        const values = {
          userId: ctx.user.id,
          age: input.age,
          retirementAge: input.retirementAge,
          isFreelancer: input.isFreelancer,
          hasDependents: input.hasDependents,
          hasCcCarryover: input.hasCcCarryover,
          monthlyIncome: enc(input.monthlyIncome),
          monthlyExpenses: enc(input.monthlyExpenses),
          liquidSavings: enc(input.liquidSavings),
          termCoverAmount: enc(input.termCoverAmount),
          healthCoverAmount: enc(input.healthCoverAmount),
          totalEmi: enc(input.totalEmi),
          investmentBalance: enc(input.investmentBalance),
          monthlyInvestment: enc(input.monthlyInvestment),
          updatedAt: new Date(),
          ...(input.markCompleted && { completedAt: new Date() }),
        };

        // Atomic upsert — single round-trip via Postgres ON CONFLICT.
        // Replaces an earlier two-query pattern (update → check rowcount
        // → insert) that wasn't surviving the Supabase transaction-mode
        // pooler's prepared-statement quirks cleanly.
        await db
          .insert(financialProfiles)
          .values(values)
          .onConflictDoUpdate({
            target: financialProfiles.userId,
            set: {
              age: values.age,
              retirementAge: values.retirementAge,
              isFreelancer: values.isFreelancer,
              hasDependents: values.hasDependents,
              hasCcCarryover: values.hasCcCarryover,
              monthlyIncome: values.monthlyIncome,
              monthlyExpenses: values.monthlyExpenses,
              liquidSavings: values.liquidSavings,
              termCoverAmount: values.termCoverAmount,
              healthCoverAmount: values.healthCoverAmount,
              totalEmi: values.totalEmi,
              investmentBalance: values.investmentBalance,
              monthlyInvestment: values.monthlyInvestment,
              updatedAt: values.updatedAt,
              ...(input.markCompleted && { completedAt: new Date() }),
            },
          });

        // liquid_savings is part of net worth — re-snapshot.
        void recordNetWorthSnapshot(ctx.user.id);

        // Snapshot the score on every "Compute" submit so the
        // trajectory chart + streak badge have a data point. Only on
        // markCompleted to avoid noisy partial-progress snapshots.
        if (input.markCompleted) {
          const inputs: ScoreInputs = {
            age: input.age,
            retirementAge: input.retirementAge,
            isFreelancer: input.isFreelancer,
            hasDependents: input.hasDependents,
            hasCcCarryover: input.hasCcCarryover,
            monthlyIncome: input.monthlyIncome,
            monthlyExpenses: input.monthlyExpenses,
            liquidSavings: input.liquidSavings,
            termCoverAmount: input.termCoverAmount,
            healthCoverAmount: input.healthCoverAmount,
            totalEmi: input.totalEmi,
            investmentBalance: input.investmentBalance,
            monthlyInvestment: input.monthlyInvestment,
          };
          const score = computeScore(inputs);
          if (score.hasEnoughData) {
            const pillarScores: Record<string, number> = {};
            for (const p of score.pillars) pillarScores[p.key] = p.score;
            await db.insert(scoreSnapshots).values({
              userId: ctx.user.id,
              total: score.total,
              band: score.band,
              pillarScores: JSON.stringify(pillarScores),
            });

            // Refresh active goals' current_value + completed_at so the
            // goals card shows accurate progress without recomputing on
            // every read. Only active (non-archived) goals are touched.
            const active = await db
              .select()
              .from(financialGoals)
              .where(
                and(
                  eq(financialGoals.userId, ctx.user.id),
                  isNull(financialGoals.archivedAt),
                ),
              );
            for (const g of active) {
              const value =
                g.goalKind === "total"
                  ? score.total
                  : pillarScores[g.pillarKey ?? ""] ?? 0;
              const justCompleted =
                g.completedAt === null && value >= g.targetScore;
              await db
                .update(financialGoals)
                .set({
                  currentValue: value,
                  ...(justCompleted && { completedAt: new Date() }),
                  updatedAt: new Date(),
                })
                .where(eq(financialGoals.id, g.id));
            }
          }
        }
        return { ok: true };
      }),

    /**
     * Score history — last N snapshots, oldest first so charts render
     * left-to-right. Used by the trajectory line chart + streak/delta
     * computation in the scorecard hero.
     */
    history: protectedProcedure
      .input(
        z
          .object({ limit: z.number().int().min(1).max(120).default(24) })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const rows = await db
          .select()
          .from(scoreSnapshots)
          .where(eq(scoreSnapshots.userId, ctx.user.id))
          .orderBy(asc(scoreSnapshots.snapshottedAt))
          .limit(input?.limit ?? 24);
        return rows.map((r) => ({
          id: r.id,
          total: r.total,
          band: r.band as "red" | "amber" | "emerald" | "green",
          snapshottedAt: r.snapshottedAt,
          pillarScores: ((): Record<string, number> => {
            try {
              return JSON.parse(r.pillarScores);
            } catch {
              return {};
            }
          })(),
        }));
      }),
  }),

  /**
   * Financial goals (Phase 2.5 v4.2). User-defined milestones tied to
   * pillar scores or the total score. CurrentValue is refreshed by
   * profile.upsert on every Compute submit; goals.list just reads it.
   */
  goals: router({
    list: protectedProcedure
      .input(
        z
          .object({ includeArchived: z.boolean().default(false) })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const filters = [eq(financialGoals.userId, ctx.user.id)];
        if (!input?.includeArchived) {
          filters.push(isNull(financialGoals.archivedAt));
        }
        const [rows, snapshots] = await Promise.all([
          db
            .select()
            .from(financialGoals)
            .where(and(...filters))
            .orderBy(asc(financialGoals.createdAt)),
          db
            .select()
            .from(scoreSnapshots)
            .where(eq(scoreSnapshots.userId, ctx.user.id))
            .orderBy(asc(scoreSnapshots.snapshottedAt)),
        ]);

        // Pre-parse pillar-score JSON once per snapshot. Bad rows just
        // get skipped — we don't want one corrupt row to nuke projections.
        const parsedSnapshots = snapshots
          .map((s) => {
            let pillars: Record<string, number> = {};
            try {
              pillars = JSON.parse(s.pillarScores) as Record<string, number>;
            } catch {
              // ignore — pillar projections for this snapshot will be 0.
            }
            return { total: s.total, pillars, at: s.snapshottedAt.getTime() };
          })
          .filter(Boolean);

        const projectHitDate = (
          goalKind: "pillar" | "total",
          pillarKey: string | null,
          target: number,
          current: number,
        ): Date | null => {
          if (current >= target) return null; // already done
          if (parsedSnapshots.length < 2) return null;
          const valueAt = (i: number): number =>
            goalKind === "total"
              ? parsedSnapshots[i].total
              : (parsedSnapshots[i].pillars[pillarKey ?? ""] ?? 0);
          const first = parsedSnapshots[0];
          const last = parsedSnapshots[parsedSnapshots.length - 1];
          const v0 = valueAt(0);
          const v1 = valueAt(parsedSnapshots.length - 1);
          const dtDays = (last.at - first.at) / (1000 * 60 * 60 * 24);
          if (dtDays < 1) return null; // need a real time delta
          const slopePerDay = (v1 - v0) / dtDays;
          if (slopePerDay <= 0) return null; // flat or regressing — no useful ETA
          const remaining = target - current;
          const daysToHit = remaining / slopePerDay;
          // Cap at 10 years out — past that, projection is meaningless.
          if (daysToHit > 365 * 10) return null;
          const eta = new Date(Date.now() + daysToHit * 24 * 60 * 60 * 1000);
          return eta;
        };

        return rows.map((r) => {
          const goalKind = r.goalKind as "pillar" | "total";
          const projectedHitDate = r.completedAt
            ? null
            : projectHitDate(goalKind, r.pillarKey, r.targetScore, r.currentValue);
          return {
            id: r.id,
            goalKind,
            pillarKey: r.pillarKey,
            label: r.label,
            targetScore: r.targetScore,
            targetDate: r.targetDate,
            currentValue: r.currentValue,
            completedAt: r.completedAt,
            archivedAt: r.archivedAt,
            createdAt: r.createdAt,
            /** null when: already complete, fewer than 2 snapshots,
             *  flat/regressing trend, or projection > 10 years out. */
            projectedHitDate,
            /** Number of snapshots used — UI shows this for transparency
             *  ("based on N snapshots") and to trigger the fallback copy. */
            snapshotCount: parsedSnapshots.length,
          };
        });
      }),

    create: protectedProcedure
      .input(
        z
          .object({
            goalKind: z.enum(["pillar", "total"]),
            pillarKey: z
              .enum(["emergency", "insurance", "debt", "savingsRate", "investing"])
              .nullable(),
            label: z.string().min(1).max(120),
            targetScore: z.number().int().positive(),
            targetDate: z.date().nullable(),
          })
          .refine(
            (v) =>
              v.goalKind === "total"
                ? v.pillarKey === null && v.targetScore <= 100
                : v.pillarKey !== null && v.targetScore <= 20,
            "pillar goals need a pillarKey and target ≤20; total goals need null pillarKey and target ≤100",
          ),
      )
      .mutation(async ({ ctx, input }) => {
        // Seed currentValue from the user's latest profile so the new
        // goal already reflects today's progress (otherwise it'd show 0%
        // until the user re-submits the wizard).
        const [profile] = await db
          .select()
          .from(financialProfiles)
          .where(eq(financialProfiles.userId, ctx.user.id))
          .limit(1);
        let currentValue = 0;
        if (profile) {
          const decrypt = (s: string | null): number | null =>
            s === null ? null : decryptAmount(s);
          const score = computeScore({
            age: profile.age,
            retirementAge: profile.retirementAge,
            isFreelancer: profile.isFreelancer,
            hasDependents: profile.hasDependents,
            hasCcCarryover: profile.hasCcCarryover,
            monthlyIncome: decrypt(profile.monthlyIncome),
            monthlyExpenses: decrypt(profile.monthlyExpenses),
            liquidSavings: decrypt(profile.liquidSavings),
            termCoverAmount: decrypt(profile.termCoverAmount),
            healthCoverAmount: decrypt(profile.healthCoverAmount),
            totalEmi: decrypt(profile.totalEmi),
            investmentBalance: decrypt(profile.investmentBalance),
            monthlyInvestment: decrypt(profile.monthlyInvestment),
          });
          if (score.hasEnoughData) {
            currentValue =
              input.goalKind === "total"
                ? score.total
                : score.pillars.find((p) => p.key === input.pillarKey)?.score ??
                  0;
          }
        }

        const [created] = await db
          .insert(financialGoals)
          .values({
            userId: ctx.user.id,
            goalKind: input.goalKind,
            pillarKey: input.pillarKey,
            label: input.label.trim(),
            targetScore: input.targetScore,
            targetDate: input.targetDate ?? null,
            currentValue,
            completedAt:
              currentValue >= input.targetScore ? new Date() : null,
          })
          .returning();
        return created;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          label: z.string().min(1).max(120).optional(),
          targetScore: z.number().int().positive().optional(),
          targetDate: z.date().nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [existing] = await db
          .select()
          .from(financialGoals)
          .where(eq(financialGoals.id, input.id))
          .limit(1);
        if (!existing || existing.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        const next = {
          ...(input.label !== undefined && { label: input.label.trim() }),
          ...(input.targetScore !== undefined && {
            targetScore: input.targetScore,
          }),
          ...(input.targetDate !== undefined && {
            targetDate: input.targetDate,
          }),
          updatedAt: new Date(),
        };
        // If targetScore moved below currentValue, mark complete; if it
        // moved above, un-complete (user raised the bar).
        const newTarget = input.targetScore ?? existing.targetScore;
        const finalNext = {
          ...next,
          completedAt:
            existing.currentValue >= newTarget
              ? existing.completedAt ?? new Date()
              : null,
        };
        const [updated] = await db
          .update(financialGoals)
          .set(finalNext)
          .where(eq(financialGoals.id, input.id))
          .returning();
        return updated;
      }),

    archive: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [existing] = await db
          .select({ userId: financialGoals.userId })
          .from(financialGoals)
          .where(eq(financialGoals.id, input.id))
          .limit(1);
        if (!existing || existing.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        await db
          .update(financialGoals)
          .set({ archivedAt: new Date() })
          .where(eq(financialGoals.id, input.id));
        return { ok: true };
      }),
  }),

  /**
   * Anomaly category mutes (v3.5.1). The in-app anomalies query and
   * the cron's anomaly pass both filter out categories present here
   * with `muted_until > now`. Per-user; one row per category max.
   */
  mutes: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const now = new Date();
      const rows = await db
        .select()
        .from(anomalyMutes)
        .where(
          and(
            eq(anomalyMutes.userId, ctx.user.id),
            gte(anomalyMutes.mutedUntil, now),
          ),
        );
      return rows.map((r) => ({
        category: r.category,
        mutedUntil: r.mutedUntil,
      }));
    }),

    create: protectedProcedure
      .input(
        z.object({
          category: z.enum(CATEGORY_KEYS),
          days: z.number().int().min(1).max(365).default(30),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const mutedUntil = new Date(
          Date.now() + input.days * 24 * 60 * 60 * 1000,
        );
        // Upsert via try-update-then-insert. Drizzle's onConflict needs
        // the unique-index name; this pattern matches what financial_profiles
        // does and stays portable across providers.
        const updated = await db
          .update(anomalyMutes)
          .set({ mutedUntil })
          .where(
            and(
              eq(anomalyMutes.userId, ctx.user.id),
              eq(anomalyMutes.category, input.category),
            ),
          )
          .returning();
        if (updated.length === 0) {
          await db.insert(anomalyMutes).values({
            userId: ctx.user.id,
            category: input.category,
            mutedUntil,
          });
        }
        return { mutedUntil };
      }),

    delete: protectedProcedure
      .input(z.object({ category: z.enum(CATEGORY_KEYS) }))
      .mutation(async ({ ctx, input }) => {
        await db
          .delete(anomalyMutes)
          .where(
            and(
              eq(anomalyMutes.userId, ctx.user.id),
              eq(anomalyMutes.category, input.category),
            ),
          );
        return { ok: true };
      }),
  }),

  /**
   * Monthly recurrences (Phase 2.5 v5.0). Cron processes them via the
   * /api/cron/reminders endpoint — see runRecurrencePass() there.
   */
  recurrences: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const rows = await db
        .select()
        .from(personalRecurrences)
        .where(eq(personalRecurrences.userId, ctx.user.id))
        .orderBy(asc(personalRecurrences.scheduleDay));
      return rows.map((r) => ({
        id: r.id,
        type: r.type as "income" | "expense" | "investment",
        amount: decryptAmount(r.amount),
        description: decryptValue(r.description),
        category: r.category,
        currency: r.currency,
        scheduleDay: r.scheduleDay,
        nextDueAt: r.nextDueAt,
        lastFiredAt: r.lastFiredAt,
        pausedAt: r.pausedAt,
      }));
    }),

    create: protectedProcedure
      .input(
        z.object({
          type: typeSchema,
          amount: z.number().positive(),
          description: z.string().max(200).default(""),
          category: categorySchema.default("other"),
          currency: currencySchema.default("INR"),
          scheduleDay: z.number().int().min(1).max(31),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const now = new Date();
        const nextDueAt = computeNextDue(input.scheduleDay, now, null);
        const [created] = await db
          .insert(personalRecurrences)
          .values({
            userId: ctx.user.id,
            type: input.type,
            amount: encryptAmount(input.amount),
            description: encryptValue(input.description.trim()),
            category: input.category,
            currency: input.currency,
            scheduleDay: input.scheduleDay,
            nextDueAt,
          })
          .returning();
        return created;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          type: typeSchema.optional(),
          amount: z.number().positive().optional(),
          description: z.string().max(200).optional(),
          category: categorySchema.optional(),
          currency: currencySchema.optional(),
          scheduleDay: z.number().int().min(1).max(31).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [existing] = await db
          .select()
          .from(personalRecurrences)
          .where(eq(personalRecurrences.id, input.id))
          .limit(1);
        if (!existing || existing.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        // If scheduleDay changes, recompute next_due_at from now (so
        // the user sees the new schedule take effect on next month).
        const nextDueAt =
          input.scheduleDay !== undefined &&
          input.scheduleDay !== existing.scheduleDay
            ? computeNextDue(
                input.scheduleDay,
                new Date(),
                existing.lastFiredAt,
              )
            : undefined;

        const [updated] = await db
          .update(personalRecurrences)
          .set({
            ...(input.type !== undefined && { type: input.type }),
            ...(input.amount !== undefined && {
              amount: encryptAmount(input.amount),
            }),
            ...(input.description !== undefined && {
              description: encryptValue(input.description.trim()),
            }),
            ...(input.category !== undefined && { category: input.category }),
            ...(input.currency !== undefined && { currency: input.currency }),
            ...(input.scheduleDay !== undefined && {
              scheduleDay: input.scheduleDay,
            }),
            ...(nextDueAt && { nextDueAt }),
            updatedAt: new Date(),
          })
          .where(eq(personalRecurrences.id, input.id))
          .returning();
        return updated;
      }),

    pause: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [existing] = await db
          .select({ userId: personalRecurrences.userId })
          .from(personalRecurrences)
          .where(eq(personalRecurrences.id, input.id))
          .limit(1);
        if (!existing || existing.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        await db
          .update(personalRecurrences)
          .set({ pausedAt: new Date(), updatedAt: new Date() })
          .where(eq(personalRecurrences.id, input.id));
        return { ok: true };
      }),

    resume: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [existing] = await db
          .select()
          .from(personalRecurrences)
          .where(eq(personalRecurrences.id, input.id))
          .limit(1);
        if (!existing || existing.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        // On resume, recompute next_due_at — the pause may have been long.
        const nextDueAt = computeNextDue(
          existing.scheduleDay,
          new Date(),
          existing.lastFiredAt,
        );
        await db
          .update(personalRecurrences)
          .set({
            pausedAt: null,
            nextDueAt,
            updatedAt: new Date(),
          })
          .where(eq(personalRecurrences.id, input.id));
        return { ok: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [existing] = await db
          .select({ userId: personalRecurrences.userId })
          .from(personalRecurrences)
          .where(eq(personalRecurrences.id, input.id))
          .limit(1);
        if (!existing || existing.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        await db
          .delete(personalRecurrences)
          .where(eq(personalRecurrences.id, input.id));
        return { ok: true };
      }),
  }),

  /**
   * Investment holdings (Phase 2.5 v5.1). Powers /app/personal/wealth.
   * All amounts encrypted; net-worth aggregation happens server-side
   * after decryption.
   */
  holdings: router({
    list: protectedProcedure
      .input(
        z
          .object({ includeArchived: z.boolean().default(false) })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const filters = [eq(personalHoldings.userId, ctx.user.id)];
        if (!input?.includeArchived) {
          filters.push(isNull(personalHoldings.archivedAt));
        }
        const rows = await db
          .select()
          .from(personalHoldings)
          .where(and(...filters))
          .orderBy(asc(personalHoldings.createdAt));
        return rows.map((r) => {
          const units = decryptAmount(r.units);
          const avgCost = decryptAmount(r.avgCost);
          const currentValue = decryptAmount(r.currentValue);
          const invested = Math.round(units * avgCost * 100) / 100;
          const gain = Math.round((currentValue - invested) * 100) / 100;
          const gainPct = invested > 0 ? gain / invested : 0;
          return {
            id: r.id,
            name: r.name,
            type: r.type as
              | "mutual_fund"
              | "fd"
              | "stock"
              | "gold"
              | "bond"
              | "other",
            units,
            avgCost,
            currentValue,
            invested,
            gain,
            gainPct,
            asOf: r.asOf,
            notes: r.notes ? decryptValue(r.notes) : "",
            archivedAt: r.archivedAt,
          };
        });
      }),

    /** Aggregate net worth: sum of active holdings + liquid savings
     *  (from financial_profiles). Cached entirely in this query so the
     *  /wealth page can render without a second roundtrip. */
    netWorth: protectedProcedure.query(async ({ ctx }) => {
      const [profile] = await db
        .select()
        .from(financialProfiles)
        .where(eq(financialProfiles.userId, ctx.user.id))
        .limit(1);
      const liquidSavings =
        profile?.liquidSavings !== null && profile?.liquidSavings !== undefined
          ? decryptAmount(profile.liquidSavings)
          : 0;
      const holdingsRows = await db
        .select()
        .from(personalHoldings)
        .where(
          and(
            eq(personalHoldings.userId, ctx.user.id),
            isNull(personalHoldings.archivedAt),
          ),
        );
      const byType = new Map<string, number>();
      let totalInvested = 0;
      let totalCurrent = 0;
      for (const h of holdingsRows) {
        const cv = decryptAmount(h.currentValue);
        const units = decryptAmount(h.units);
        const cost = decryptAmount(h.avgCost);
        totalCurrent += cv;
        totalInvested += units * cost;
        byType.set(h.type, (byType.get(h.type) ?? 0) + cv);
      }
      // Subtract debts so net worth reflects liabilities, not just assets.
      const loans = await loadActiveLoans(ctx.user.id);
      const debtsValue = totalOutstandingAt(loans, new Date());
      const netWorth = liquidSavings + totalCurrent - debtsValue;
      const totalGain =
        Math.round((totalCurrent - totalInvested) * 100) / 100;
      const totalGainPct = totalInvested > 0 ? totalGain / totalInvested : 0;
      return {
        netWorth: Math.round(netWorth * 100) / 100,
        liquidSavings: Math.round(liquidSavings * 100) / 100,
        holdingsValue: Math.round(totalCurrent * 100) / 100,
        debtsValue: Math.round(debtsValue * 100) / 100,
        totalInvested: Math.round(totalInvested * 100) / 100,
        totalGain,
        totalGainPct,
        byType: Array.from(byType.entries()).map(([type, value]) => ({
          type,
          value: Math.round(value * 100) / 100,
        })),
        holdingsCount: holdingsRows.length,
        debtsCount: loans.length,
      };
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(80),
          type: z.enum([
            "mutual_fund",
            "fd",
            "stock",
            "gold",
            "bond",
            "other",
          ]),
          units: z.number().positive(),
          avgCost: z.number().nonnegative(),
          currentValue: z.number().nonnegative(),
          asOf: z.date().optional(),
          notes: z.string().max(200).default(""),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [created] = await db
          .insert(personalHoldings)
          .values({
            userId: ctx.user.id,
            name: input.name.trim(),
            type: input.type,
            units: encryptAmount(input.units),
            avgCost: encryptAmount(input.avgCost),
            currentValue: encryptAmount(input.currentValue),
            asOf: input.asOf ?? new Date(),
            notes: input.notes ? encryptValue(input.notes.trim()) : null,
          })
          .returning();
        void recordNetWorthSnapshot(ctx.user.id);
        return created;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).max(80).optional(),
          type: z
            .enum(["mutual_fund", "fd", "stock", "gold", "bond", "other"])
            .optional(),
          units: z.number().positive().optional(),
          avgCost: z.number().nonnegative().optional(),
          currentValue: z.number().nonnegative().optional(),
          asOf: z.date().optional(),
          notes: z.string().max(200).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [existing] = await db
          .select({ userId: personalHoldings.userId })
          .from(personalHoldings)
          .where(eq(personalHoldings.id, input.id))
          .limit(1);
        if (!existing || existing.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        const [updated] = await db
          .update(personalHoldings)
          .set({
            ...(input.name !== undefined && { name: input.name.trim() }),
            ...(input.type !== undefined && { type: input.type }),
            ...(input.units !== undefined && {
              units: encryptAmount(input.units),
            }),
            ...(input.avgCost !== undefined && {
              avgCost: encryptAmount(input.avgCost),
            }),
            ...(input.currentValue !== undefined && {
              currentValue: encryptAmount(input.currentValue),
              asOf: input.asOf ?? new Date(),
            }),
            ...(input.asOf && { asOf: input.asOf }),
            ...(input.notes !== undefined && {
              notes: input.notes ? encryptValue(input.notes.trim()) : null,
            }),
            updatedAt: new Date(),
          })
          .where(eq(personalHoldings.id, input.id))
          .returning();
        void recordNetWorthSnapshot(ctx.user.id);
        return updated;
      }),

    archive: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [existing] = await db
          .select({ userId: personalHoldings.userId })
          .from(personalHoldings)
          .where(eq(personalHoldings.id, input.id))
          .limit(1);
        if (!existing || existing.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        await db
          .update(personalHoldings)
          .set({ archivedAt: new Date(), updatedAt: new Date() })
          .where(eq(personalHoldings.id, input.id));
        void recordNetWorthSnapshot(ctx.user.id);
        return { ok: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [existing] = await db
          .select({ userId: personalHoldings.userId })
          .from(personalHoldings)
          .where(eq(personalHoldings.id, input.id))
          .limit(1);
        if (!existing || existing.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        await db
          .delete(personalHoldings)
          .where(eq(personalHoldings.id, input.id));
        void recordNetWorthSnapshot(ctx.user.id);
        return { ok: true };
      }),

    /**
     * Net-worth history — last N snapshots, ascending by date. Used by
     * the trajectory chart on /wealth. We also write a snapshot on read
     * if today's row doesn't exist yet, so the curve always ends "today"
     * even if the user hasn't edited holdings recently.
     */
    netWorthHistory: protectedProcedure
      .input(
        z
          .object({ days: z.number().int().min(7).max(365).default(90) })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const days = input?.days ?? 90;
        // Backfill today's row if missing — keeps the chart current.
        const today = todayISODate();
        const [existingToday] = await db
          .select({ id: personalNetWorthSnapshots.id })
          .from(personalNetWorthSnapshots)
          .where(
            and(
              eq(personalNetWorthSnapshots.userId, ctx.user.id),
              eq(personalNetWorthSnapshots.snapshotDate, today),
            ),
          )
          .limit(1);
        if (!existingToday) {
          await recordNetWorthSnapshot(ctx.user.id);
        }
        const cutoff = new Date();
        cutoff.setUTCDate(cutoff.getUTCDate() - days);
        const cutoffISO = cutoff.toISOString().slice(0, 10);
        const rows = await db
          .select()
          .from(personalNetWorthSnapshots)
          .where(
            and(
              eq(personalNetWorthSnapshots.userId, ctx.user.id),
              gte(personalNetWorthSnapshots.snapshotDate, cutoffISO),
            ),
          )
          .orderBy(asc(personalNetWorthSnapshots.snapshotDate));
        return rows.map((r) => ({
          snapshotDate: r.snapshotDate,
          totalValue: decryptAmount(r.totalValue),
          liquidSavings: decryptAmount(r.liquidSavings),
          holdingsValue: decryptAmount(r.holdingsValue),
        }));
      }),
  }),

  /**
   * Loans / EMIs (Phase 2.5 v5.2). Amounts encrypted, the rest plain.
   * Outstanding balance and freedom date are computed on read using the
   * amortise.ts library — we never store decrementing balances, no cron.
   */
  debts: router({
    list: protectedProcedure
      .input(
        z
          .object({ includeArchived: z.boolean().default(false) })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const filters = [eq(personalDebts.userId, ctx.user.id)];
        if (!input?.includeArchived) {
          filters.push(isNull(personalDebts.archivedAt));
        }
        const rows = await db
          .select()
          .from(personalDebts)
          .where(and(...filters))
          .orderBy(asc(personalDebts.createdAt));
        const now = new Date();
        return rows.map((r) => {
          const loan: LoanSnapshot = {
            principal: decryptAmount(r.principal),
            emi: decryptAmount(r.emi),
            annualRatePct: Number(r.annualRatePct),
            startDate: new Date(r.startDate),
          };
          const currentOutstanding = outstandingAt(loan, now);
          const monthsLeft = monthsToFreedom(loan);
          const finishDate = freedomDate(loan);
          return {
            id: r.id,
            name: r.name,
            debtType: r.debtType as
              | "home" | "car" | "personal" | "education" | "credit_card" | "other",
            principal: loan.principal,
            emi: loan.emi,
            annualRatePct: loan.annualRatePct,
            startDate: loan.startDate,
            archivedAt: r.archivedAt,
            // Derived values — UI uses these directly so it doesn't need
            // its own amortisation implementation.
            currentOutstanding: Math.round(currentOutstanding * 100) / 100,
            monthsRemaining: Number.isFinite(monthsLeft) ? monthsLeft : null,
            finishDate,
            isUnderwater: !Number.isFinite(monthsLeft), // EMI ≤ interest
          };
        });
      }),

    /** 24-month projection of total outstanding debt at each month
     *  boundary, for the /wealth trajectory chart. */
    trajectory: protectedProcedure
      .input(z.object({ months: z.number().int().min(1).max(60).default(24) }).optional())
      .query(async ({ ctx, input }) => {
        const months = input?.months ?? 24;
        const loans = await loadActiveLoans(ctx.user.id);
        const traj = debtTrajectory(loans, new Date(), months);
        return traj.map((p) => ({
          month: p.month,
          outstanding: Math.round(p.outstanding * 100) / 100,
        }));
      }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(80),
          debtType: z.enum([
            "home", "car", "personal", "education", "credit_card", "other",
          ]),
          principal: z.number().positive(),
          emi: z.number().positive(),
          annualRatePct: z.number().min(0).max(99.99),
          startDate: z.date().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [created] = await db
          .insert(personalDebts)
          .values({
            userId: ctx.user.id,
            name: input.name.trim(),
            debtType: input.debtType,
            principal: encryptAmount(input.principal),
            emi: encryptAmount(input.emi),
            // Drizzle's numeric column accepts strings on insert.
            annualRatePct: input.annualRatePct.toFixed(2),
            startDate: input.startDate ?? new Date(),
          })
          .returning();
        void recordNetWorthSnapshot(ctx.user.id);
        return created;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).max(80).optional(),
          debtType: z
            .enum(["home", "car", "personal", "education", "credit_card", "other"])
            .optional(),
          principal: z.number().positive().optional(),
          emi: z.number().positive().optional(),
          annualRatePct: z.number().min(0).max(99.99).optional(),
          startDate: z.date().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const [existing] = await db
          .select({ userId: personalDebts.userId })
          .from(personalDebts)
          .where(eq(personalDebts.id, input.id))
          .limit(1);
        if (!existing || existing.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        const [updated] = await db
          .update(personalDebts)
          .set({
            ...(input.name !== undefined && { name: input.name.trim() }),
            ...(input.debtType !== undefined && { debtType: input.debtType }),
            ...(input.principal !== undefined && {
              principal: encryptAmount(input.principal),
            }),
            ...(input.emi !== undefined && { emi: encryptAmount(input.emi) }),
            ...(input.annualRatePct !== undefined && {
              annualRatePct: input.annualRatePct.toFixed(2),
            }),
            ...(input.startDate !== undefined && { startDate: input.startDate }),
            updatedAt: new Date(),
          })
          .where(eq(personalDebts.id, input.id))
          .returning();
        void recordNetWorthSnapshot(ctx.user.id);
        return updated;
      }),

    archive: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [existing] = await db
          .select({ userId: personalDebts.userId })
          .from(personalDebts)
          .where(eq(personalDebts.id, input.id))
          .limit(1);
        if (!existing || existing.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        await db
          .update(personalDebts)
          .set({ archivedAt: new Date(), updatedAt: new Date() })
          .where(eq(personalDebts.id, input.id));
        void recordNetWorthSnapshot(ctx.user.id);
        return { ok: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const [existing] = await db
          .select({ userId: personalDebts.userId })
          .from(personalDebts)
          .where(eq(personalDebts.id, input.id))
          .limit(1);
        if (!existing || existing.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        await db.delete(personalDebts).where(eq(personalDebts.id, input.id));
        void recordNetWorthSnapshot(ctx.user.id);
        return { ok: true };
      }),
  }),
});
