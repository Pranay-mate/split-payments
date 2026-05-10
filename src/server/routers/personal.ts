import { z } from "zod";
import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import {
  anomalyMutes,
  financialGoals,
  financialProfiles,
  personalEntries,
  personalHoldings,
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

const typeSchema = z.enum(["income", "expense", "investment"]);
const categorySchema = z.enum(CATEGORY_KEYS);

const currencySchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, "3-letter ISO 4217 currency");

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

        // Upsert: try update first; insert if no row exists.
        const updated = await db
          .update(financialProfiles)
          .set(values)
          .where(eq(financialProfiles.userId, ctx.user.id))
          .returning();
        if (updated.length === 0) {
          await db.insert(financialProfiles).values(values);
        }

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
        const rows = await db
          .select()
          .from(financialGoals)
          .where(and(...filters))
          .orderBy(asc(financialGoals.createdAt));
        return rows.map((r) => ({
          id: r.id,
          goalKind: r.goalKind as "pillar" | "total",
          pillarKey: r.pillarKey,
          label: r.label,
          targetScore: r.targetScore,
          targetDate: r.targetDate,
          currentValue: r.currentValue,
          completedAt: r.completedAt,
          archivedAt: r.archivedAt,
          createdAt: r.createdAt,
        }));
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
      const netWorth = liquidSavings + totalCurrent;
      const totalGain =
        Math.round((totalCurrent - totalInvested) * 100) / 100;
      const totalGainPct = totalInvested > 0 ? totalGain / totalInvested : 0;
      return {
        netWorth: Math.round(netWorth * 100) / 100,
        liquidSavings: Math.round(liquidSavings * 100) / 100,
        holdingsValue: Math.round(totalCurrent * 100) / 100,
        totalInvested: Math.round(totalInvested * 100) / 100,
        totalGain,
        totalGainPct,
        byType: Array.from(byType.entries()).map(([type, value]) => ({
          type,
          value: Math.round(value * 100) / 100,
        })),
        holdingsCount: holdingsRows.length,
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
        return { ok: true };
      }),
  }),
});
