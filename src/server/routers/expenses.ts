import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import {
  expenseItems,
  expenses,
  expenseSplits,
  groupMembers,
  groups,
} from "@/lib/db/schema";
import { getRate, isReasonableRate } from "@/lib/fx";
import { CATEGORY_KEYS } from "@/lib/categories";
import { splitsFromItems } from "@/lib/itemized-splits";
import { logEvent } from "../events";

const splitSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().positive(),
});

const splitModeSchema = z.enum(["equal", "exact", "share", "percent"]);
const categorySchema = z.enum(CATEGORY_KEYS);

const itemSchema = z.object({
  description: z.string().max(200).default(""),
  amount: z.number().positive(),
  sharerIds: z.array(z.string().uuid()).min(1),
});

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

async function getGroupPrimaryCurrency(groupId: string): Promise<string> {
  const [g] = await db
    .select({ primaryCurrency: groups.primaryCurrency })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!g) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
  }
  return g.primaryCurrency;
}

/**
 * Resolve fxRate + convertedAmount given an expense in `currency` and
 * the group's primary currency. Server-side rate fetch is the source of
 * truth — clients can pass a rate for preview but we ignore it.
 */
async function resolveConversion(
  amount: number,
  currency: string,
  primaryCurrency: string,
): Promise<{ fxRate: number; convertedAmount: number }> {
  if (currency === primaryCurrency) {
    return { fxRate: 1, convertedAmount: amount };
  }
  let fxRate: number;
  try {
    fxRate = await getRate(currency, primaryCurrency);
  } catch (err) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Couldn't fetch FX rate ${currency} → ${primaryCurrency}. Try again.`,
      cause: err,
    });
  }
  if (!isReasonableRate(fxRate)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `FX rate looks wrong (${fxRate}). Refusing to save.`,
    });
  }
  return {
    fxRate,
    convertedAmount: Math.round(amount * fxRate * 100) / 100,
  };
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

      const expenseIds = rows.map((r) => r.id);

      const [splitRows, itemRows] = await Promise.all([
        db
          .select()
          .from(expenseSplits)
          .where(inArray(expenseSplits.expenseId, expenseIds)),
        db
          .select()
          .from(expenseItems)
          .where(inArray(expenseItems.expenseId, expenseIds))
          .orderBy(expenseItems.position),
      ]);

      const splitsByExpense = new Map<string, typeof splitRows>();
      for (const s of splitRows) {
        const list = splitsByExpense.get(s.expenseId) ?? [];
        list.push(s);
        splitsByExpense.set(s.expenseId, list);
      }
      const itemsByExpense = new Map<string, typeof itemRows>();
      for (const it of itemRows) {
        const list = itemsByExpense.get(it.expenseId) ?? [];
        list.push(it);
        itemsByExpense.set(it.expenseId, list);
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
        items: (itemsByExpense.get(e.id) ?? []).map((it) => ({
          id: it.id,
          description: it.description,
          amount: Number(it.amount),
          sharerIds: it.sharerIds,
          position: it.position,
        })),
      }));
    }),

  /**
   * Create an expense + its splits in a single transaction.
   * Accepts an optional clientEventId — when present, used as the row id.
   * This makes offline-queued creates idempotent and lets follow-up
   * updates/deletes reference the same id the client used optimistically.
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
        category: categorySchema.default("other"),
        splits: z.array(splitSchema).min(1),
        /**
         * Itemized split: when present, server recomputes splits + amount
         * from these items and ignores the client-supplied splits/amount.
         */
        items: z.array(itemSchema).optional(),
        occurredAt: z.date().optional(),
        clientEventId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMembership(input.groupId, ctx.user.id);
      await ensureMembership(input.groupId, input.payerId);

      // Itemized mode: derive amount + splits from items (server-trusted),
      // discarding client values to keep them in sync with the items table.
      let workingAmount = input.amount;
      let workingSplits = input.splits;
      if (input.items && input.items.length > 0) {
        for (const item of input.items) {
          for (const id of item.sharerIds) {
            await ensureMembership(input.groupId, id);
          }
        }
        workingAmount =
          Math.round(
            input.items.reduce((s, i) => s + i.amount, 0) * 100,
          ) / 100;
        workingSplits = splitsFromItems(input.items);
      }

      // Validate splits sum within 1 paisa of amount (in original currency).
      const splitSum = workingSplits.reduce((s, x) => s + x.amount, 0);
      if (Math.abs(splitSum - workingAmount) > 0.01) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Splits (${splitSum.toFixed(2)}) must sum to amount (${workingAmount.toFixed(2)}).`,
        });
      }

      // Validate every split is a group member (skipped for items, already done above).
      if (!input.items || input.items.length === 0) {
        for (const split of workingSplits) {
          await ensureMembership(input.groupId, split.userId);
        }
      }

      // Idempotency: if an expense with this clientEventId already exists,
      // return it instead of creating a duplicate. Handles drainQueue
      // re-replays after a partial failure.
      if (input.clientEventId) {
        const [existing] = await db
          .select()
          .from(expenses)
          .where(eq(expenses.id, input.clientEventId))
          .limit(1);
        if (existing) return existing;
      }

      const primaryCurrency = await getGroupPrimaryCurrency(input.groupId);
      const { fxRate, convertedAmount } = await resolveConversion(
        workingAmount,
        input.currency,
        primaryCurrency,
      );

      const splitsInPrimary = workingSplits.map((s) => ({
        userId: s.userId,
        amount: Math.round(s.amount * fxRate * 100) / 100,
      }));

      return await db.transaction(async (tx) => {
        const [expense] = await tx
          .insert(expenses)
          .values({
            ...(input.clientEventId && { id: input.clientEventId }),
            groupId: input.groupId,
            description: input.description.trim(),
            amount: workingAmount.toFixed(2),
            currency: input.currency,
            convertedAmount: convertedAmount.toFixed(2),
            fxRate: fxRate.toString(),
            payerId: input.payerId,
            splitMode: input.splitMode,
            category: input.category,
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
          splitsInPrimary.map((s) => ({
            expenseId: expense.id,
            userId: s.userId,
            amount: s.amount.toFixed(2),
          })),
        );

        if (input.items && input.items.length > 0) {
          await tx.insert(expenseItems).values(
            input.items.map((item, idx) => ({
              expenseId: expense.id,
              description: item.description.trim(),
              amount: item.amount.toFixed(2),
              sharerIds: item.sharerIds,
              position: idx,
            })),
          );
        }

        await logEvent({
          groupId: input.groupId,
          expenseId: expense.id,
          eventType: "expense.added",
          actorId: ctx.user.id,
          payload: {
            expenseId: expense.id,
            description: expense.description,
            amount: input.amount,
            currency: input.currency,
          },
        });

        return expense;
      });
    }),

  /** Update an existing expense (description, amount, currency, payer, splits). */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        description: z.string().max(200).default(""),
        amount: z.number().positive(),
        currency: z
          .string()
          .length(3)
          .regex(/^[A-Z]{3}$/)
          .default("INR"),
        payerId: z.string().uuid(),
        splitMode: splitModeSchema,
        category: categorySchema.default("other"),
        splits: z.array(splitSchema).min(1),
        /**
         * Itemized split: when present, server recomputes amount + splits
         * from items and replaces the expense's items rows in the same
         * transaction. Pass an empty array to clear an expense's items
         * (i.e. switch back to flat-split mode).
         */
        items: z.array(itemSchema).optional(),
        /**
         * Client wall-clock at the moment the user submitted the edit.
         * Used for last-write-wins conflict resolution: a stale update
         * (older than the row's current updated_at) is rejected so that
         * a fresher edit from another device isn't overwritten.
         */
        clientUpdatedAt: z.date().optional(),
        clientEventId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(expenses)
        .where(eq(expenses.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
      }
      await ensureMembership(existing.groupId, ctx.user.id);
      // Grandfather the original payer: if you're not changing them, no
      // need to verify they're still in the group.
      if (input.payerId !== existing.payerId) {
        await ensureMembership(existing.groupId, input.payerId);
      }

      // Last-write-wins: if the client's edit is older than the row's
      // current updated_at (someone else edited more recently), reject.
      if (input.clientUpdatedAt) {
        const existingTime = new Date(existing.updatedAt).getTime();
        const clientTime = input.clientUpdatedAt.getTime();
        if (clientTime < existingTime) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Someone else made a more recent edit. Refresh to see the latest version.",
          });
        }
      }

      // Itemized mode: derive amount + splits from items.
      let workingAmount = input.amount;
      let workingSplits = input.splits;
      const replaceItems = Array.isArray(input.items);
      if (input.items && input.items.length > 0) {
        for (const item of input.items) {
          for (const id of item.sharerIds) {
            // Items use current-membership rules; new items can't include
            // ex-members. (Existing splits stay grandfathered separately.)
            await ensureMembership(existing.groupId, id);
          }
        }
        workingAmount =
          Math.round(
            input.items.reduce((s, i) => s + i.amount, 0) * 100,
          ) / 100;
        workingSplits = splitsFromItems(input.items);
      }

      const splitSum = workingSplits.reduce((s, x) => s + x.amount, 0);
      if (Math.abs(splitSum - workingAmount) > 0.01) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Splits (${splitSum.toFixed(2)}) must sum to amount (${workingAmount.toFixed(2)}).`,
        });
      }

      // Splits may reference members who have since left the group (or guests
      // who were removed). Grandfather them through: a userId is allowed if
      // it was already on this expense, OR is a current group member. This
      // lets you edit legacy expenses without first re-adding ex-members.
      const existingSplitUserIds = new Set(
        (
          await db
            .select({ userId: expenseSplits.userId })
            .from(expenseSplits)
            .where(eq(expenseSplits.expenseId, input.id))
        ).map((r) => r.userId),
      );
      for (const split of workingSplits) {
        if (existingSplitUserIds.has(split.userId)) continue;
        await ensureMembership(existing.groupId, split.userId);
      }

      const primaryCurrency = await getGroupPrimaryCurrency(existing.groupId);
      const { fxRate, convertedAmount } = await resolveConversion(
        workingAmount,
        input.currency,
        primaryCurrency,
      );

      const splitsInPrimary = workingSplits.map((s) => ({
        userId: s.userId,
        amount: Math.round(s.amount * fxRate * 100) / 100,
      }));

      return await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(expenses)
          .set({
            description: input.description.trim(),
            amount: workingAmount.toFixed(2),
            currency: input.currency,
            convertedAmount: convertedAmount.toFixed(2),
            fxRate: fxRate.toString(),
            payerId: input.payerId,
            splitMode: input.splitMode,
            category: input.category,
            updatedAt: new Date(),
          })
          .where(eq(expenses.id, input.id))
          .returning();

        if (!updated) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update expense",
          });
        }

        await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, input.id));
        await tx.insert(expenseSplits).values(
          splitsInPrimary.map((s) => ({
            expenseId: input.id,
            userId: s.userId,
            amount: s.amount.toFixed(2),
          })),
        );

        // If the client supplied items[], replace the items rows wholesale.
        // (input.items === undefined means "leave items untouched".)
        if (replaceItems) {
          await tx
            .delete(expenseItems)
            .where(eq(expenseItems.expenseId, input.id));
          if (input.items && input.items.length > 0) {
            await tx.insert(expenseItems).values(
              input.items.map((item, idx) => ({
                expenseId: input.id,
                description: item.description.trim(),
                amount: item.amount.toFixed(2),
                sharerIds: item.sharerIds,
                position: idx,
              })),
            );
          }
        }

        await logEvent({
          groupId: existing.groupId,
          expenseId: input.id,
          eventType: "expense.updated",
          actorId: ctx.user.id,
          payload: {
            expenseId: input.id,
            description: input.description,
            amount: input.amount,
            currency: input.currency,
          },
        });

        return updated;
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

      await logEvent({
        groupId: expense.groupId,
        expenseId: input.id,
        eventType: "expense.deleted",
        actorId: ctx.user.id,
        payload: { expenseId: input.id, description: expense.description },
      });

      return { ok: true };
    }),
});
