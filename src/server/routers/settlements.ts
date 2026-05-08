import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { groupMembers, settlements } from "@/lib/db/schema";
import { logEvent } from "../events";

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

export const settlementsRouter = router({
  /** All recorded settlements in a group, newest first. */
  listByGroup: protectedProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await ensureMembership(input.groupId, ctx.user.id);
      const rows = await db
        .select()
        .from(settlements)
        .where(eq(settlements.groupId, input.groupId))
        .orderBy(desc(settlements.occurredAt));
      return rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
      }));
    }),

  /** Record a payment from one member to another in this group. */
  create: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        fromUserId: z.string().uuid(),
        toUserId: z.string().uuid(),
        amount: z.number().positive(),
        note: z.string().max(200).default(""),
        occurredAt: z.date().optional(),
        clientEventId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.fromUserId === input.toUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payer and receiver must be different.",
        });
      }
      await ensureMembership(input.groupId, ctx.user.id);
      await ensureMembership(input.groupId, input.fromUserId);
      await ensureMembership(input.groupId, input.toUserId);

      // Idempotency check
      if (input.clientEventId) {
        const [existing] = await db
          .select()
          .from(settlements)
          .where(eq(settlements.id, input.clientEventId))
          .limit(1);
        if (existing) return { ...existing, amount: Number(existing.amount) };
      }

      const [created] = await db
        .insert(settlements)
        .values({
          ...(input.clientEventId && { id: input.clientEventId }),
          groupId: input.groupId,
          fromUserId: input.fromUserId,
          toUserId: input.toUserId,
          amount: input.amount.toFixed(2),
          note: input.note.trim(),
          occurredAt: input.occurredAt ?? new Date(),
        })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to record settlement",
        });
      }

      await logEvent({
        groupId: input.groupId,
        eventType: "settlement.recorded",
        actorId: ctx.user.id,
        payload: {
          settlementId: created.id,
          fromUserId: input.fromUserId,
          toUserId: input.toUserId,
          amount: input.amount,
        },
      });

      return { ...created, amount: Number(created.amount) };
    }),

  /** Remove a recorded settlement (any member can undo). */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await db
        .select()
        .from(settlements)
        .where(eq(settlements.id, input.id))
        .limit(1);
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Settlement not found" });
      }
      await ensureMembership(row.groupId, ctx.user.id);
      await db.delete(settlements).where(eq(settlements.id, input.id));
      await logEvent({
        groupId: row.groupId,
        eventType: "settlement.deleted",
        actorId: ctx.user.id,
        payload: { settlementId: input.id },
      });
      return { ok: true };
    }),
});
