import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { events, expenses, groupMembers } from "@/lib/db/schema";

async function ensureMembership(groupId: string, userId: string) {
  const m = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    )
    .limit(1);
  if (m.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this group.",
    });
  }
}

export const eventsRouter = router({
  /** Recent events for a group, newest first. */
  listByGroup: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ensureMembership(input.groupId, ctx.user.id);
      const rows = await db
        .select()
        .from(events)
        .where(eq(events.groupId, input.groupId))
        .orderBy(desc(events.occurredAt))
        .limit(input.limit);
      return rows.map((r) => ({
        ...r,
        payload: safeParseJson(r.payload),
      }));
    }),

  /** Events for a single expense (chronological history of edits + comments). */
  listByExpense: protectedProcedure
    .input(
      z.object({
        expenseId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify access via the expense's group
      const [expense] = await db
        .select({ groupId: expenses.groupId })
        .from(expenses)
        .where(eq(expenses.id, input.expenseId))
        .limit(1);
      if (!expense) {
        // Expense may have been deleted — check events for the groupId
        // via any matching event row, otherwise refuse.
        const [ev] = await db
          .select({ groupId: events.groupId })
          .from(events)
          .where(eq(events.expenseId, input.expenseId))
          .limit(1);
        if (!ev?.groupId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found" });
        }
        await ensureMembership(ev.groupId, ctx.user.id);
      } else {
        await ensureMembership(expense.groupId, ctx.user.id);
      }

      const rows = await db
        .select()
        .from(events)
        .where(eq(events.expenseId, input.expenseId))
        .orderBy(desc(events.occurredAt))
        .limit(input.limit);
      return rows.map((r) => ({
        ...r,
        payload: safeParseJson(r.payload),
      }));
    }),
});

function safeParseJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
