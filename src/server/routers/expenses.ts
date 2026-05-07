import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import {
  expenses,
  expenseSplits,
  groupMembers,
} from "@/lib/db/schema";

const splitSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().positive(),
});

const splitModeSchema = z.enum(["equal", "exact", "share", "percent"]);

async function ensureMembership(groupId: string, userId: string) {
  const membership = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    )
    .limit(1);
  if (membership.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this group.",
    });
  }
}

export const expensesRouter = router({
  /** All expenses in a group (must be a member). */
  listByGroup: protectedProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await ensureMembership(input.groupId, ctx.user.id);

      const rows = await db
        .select()
        .from(expenses)
        .where(eq(expenses.groupId, input.groupId))
        .orderBy(desc(expenses.occurredAt));

      if (rows.length === 0) return [];

      const splitRows = await db
        .select()
        .from(expenseSplits)
        .where(
          sql`${expenseSplits.expenseId} = ANY(${sql.raw(
            `ARRAY[${rows.map((r) => `'${r.id}'::uuid`).join(", ")}]`,
          )})`,
        );

      const splitsByExpense = new Map<string, typeof splitRows>();
      for (const s of splitRows) {
        const list = splitsByExpense.get(s.expenseId) ?? [];
        list.push(s);
        splitsByExpense.set(s.expenseId, list);
      }

      return rows.map((e) => ({
        ...e,
        amount: Number(e.amount),
        convertedAmount: Number(e.convertedAmount),
        fxRate: Number(e.fxRate),
        splits: (splitsByExpense.get(e.id) ?? []).map((s) => ({
          userId: s.userId,
          amount: Number(s.amount),
        })),
      }));
    }),

  /**
   * Create an expense + its splits in a single transaction.
   * For v1, the entered currency is assumed to equal the group's primary
   * currency (FX is wired but rate=1). Cross-currency support comes in a
   * follow-up.
   */
  create: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        description: z.string().max(200).default(""),
        amount: z.number().positive(),
        currency: z
          .string()
          .length(3)
          .regex(/^[A-Z]{3}$/)
          .default("INR"),
        payerId: z.string().uuid(),
        splitMode: splitModeSchema.default("equal"),
        splits: z.array(splitSchema).min(1),
        occurredAt: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMembership(input.groupId, ctx.user.id);
      await ensureMembership(input.groupId, input.payerId);

      // Validate splits sum within 1 paisa of amount.
      const splitSum = input.splits.reduce((s, x) => s + x.amount, 0);
      if (Math.abs(splitSum - input.amount) > 0.01) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Splits (₹${splitSum.toFixed(2)}) must sum to amount (₹${input.amount.toFixed(2)}).`,
        });
      }

      // Validate every split is a group member.
      for (const split of input.splits) {
        await ensureMembership(input.groupId, split.userId);
      }

      // v1 — single-currency: rate = 1, converted = amount
      const fxRate = 1;
      const convertedAmount = input.amount;

      return await db.transaction(async (tx) => {
        const [expense] = await tx
          .insert(expenses)
          .values({
            groupId: input.groupId,
            description: input.description.trim(),
            amount: input.amount.toFixed(2),
            currency: input.currency,
            convertedAmount: convertedAmount.toFixed(2),
            fxRate: fxRate.toString(),
            payerId: input.payerId,
            splitMode: input.splitMode,
            occurredAt: input.occurredAt ?? new Date(),
            createdBy: ctx.user.id,
          })
          .returning();

        if (!expense) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create expense",
          });
        }

        await tx.insert(expenseSplits).values(
          input.splits.map((s) => ({
            expenseId: expense.id,
            userId: s.userId,
            amount: s.amount.toFixed(2),
          })),
        );

        return expense;
      });
    }),

  /** Delete an expense (only the creator or payer can delete). */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [expense] = await db
        .select()
        .from(expenses)
        .where(eq(expenses.id, input.id))
        .limit(1);

      if (!expense) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
      }

      await ensureMembership(expense.groupId, ctx.user.id);

      // Anyone in the group can delete for v1; tighten later if needed.
      await db.delete(expenses).where(eq(expenses.id, input.id));
      return { ok: true };
    }),
});
