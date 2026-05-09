import { z } from "zod";
import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { personalEntries } from "@/lib/db/schema";
import { CATEGORY_KEYS } from "@/lib/categories";
import {
  decryptAmount,
  decryptValue,
  encryptAmount,
  encryptValue,
} from "@/lib/encryption";

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
});
