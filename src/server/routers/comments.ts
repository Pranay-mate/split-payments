import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import {
  expenseComments,
  expenses,
  groupMembers,
} from "@/lib/db/schema";
import { logEvent } from "../events";

async function ensureExpenseAccess(expenseId: string, userId: string) {
  const [row] = await db
    .select({ groupId: expenses.groupId })
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
  }
  const m = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, row.groupId), eq(groupMembers.userId, userId)),
    )
    .limit(1);
  if (m.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this group.",
    });
  }
  return row.groupId;
}

export const commentsRouter = router({
  listByExpense: protectedProcedure
    .input(z.object({ expenseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await ensureExpenseAccess(input.expenseId, ctx.user.id);
      return db
        .select()
        .from(expenseComments)
        .where(eq(expenseComments.expenseId, input.expenseId))
        .orderBy(asc(expenseComments.createdAt));
    }),

  add: protectedProcedure
    .input(
      z.object({
        expenseId: z.string().uuid(),
        body: z.string().min(1).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const groupId = await ensureExpenseAccess(input.expenseId, ctx.user.id);

      const [created] = await db
        .insert(expenseComments)
        .values({
          expenseId: input.expenseId,
          userId: ctx.user.id,
          body: input.body.trim(),
        })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add comment",
        });
      }

      await logEvent({
        groupId,
        eventType: "comment.added",
        actorId: ctx.user.id,
        payload: { expenseId: input.expenseId, commentId: created.id },
      });

      return created;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [comment] = await db
        .select()
        .from(expenseComments)
        .where(eq(expenseComments.id, input.id))
        .limit(1);
      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }
      // Only the author can delete their own comment.
      if (comment.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the author can delete this comment.",
        });
      }
      await db.delete(expenseComments).where(eq(expenseComments.id, input.id));
      return { ok: true };
    }),
});
