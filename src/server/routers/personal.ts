import { z } from "zod";
import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import {
  financialProfiles,
  personalEntries,
  scoreSnapshots,
} from "@/lib/db/schema";
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
    return detectAnomalies(decryptedEntries, currentMonthKey);
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
});
