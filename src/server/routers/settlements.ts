import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import {
  groupMembers,
  groups,
  profiles,
  settlements,
} from "@/lib/db/schema";
import { logEvent } from "../events";
import { pushToUser } from "@/lib/push";
import { formatINR } from "@/lib/format";

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

      // Real-time push to the OTHER party / parties. If the recorder
      // is one of the participants, only the other gets pinged.
      // If a third-party member recorded it (creator on someone else's
      // behalf), both participants get pinged. Native push `tag` makes
      // the OS dedupe multiple-in-a-row notifications for the same
      // group automatically — no DB throttle needed.
      const recipientIds = new Set<string>([
        input.fromUserId,
        input.toUserId,
      ]);
      recipientIds.delete(ctx.user.id);

      if (recipientIds.size > 0) {
        // Fire-and-forget: don't block the mutation response on push
        // delivery. Errors swallowed inside pushToUser.
        void (async () => {
          try {
            const ids = [...recipientIds, input.fromUserId, input.toUserId];
            const namesMap = new Map<string, string>();
            const profileRows = await db
              .select({
                id: profiles.id,
                displayName: profiles.displayName,
              })
              .from(profiles)
              .where(inArray(profiles.id, ids));
            for (const p of profileRows) namesMap.set(p.id, p.displayName);

            const [grp] = await db
              .select({ name: groups.name })
              .from(groups)
              .where(eq(groups.id, input.groupId))
              .limit(1);
            const groupName = grp?.name ?? "your group";
            const fromName = namesMap.get(input.fromUserId) ?? "Someone";
            const toName = namesMap.get(input.toUserId) ?? "someone";
            const amountText = formatINR(input.amount, 0);

            for (const recipientId of recipientIds) {
              const isReceiver = recipientId === input.toUserId;
              const title = isReceiver
                ? `✓ ${fromName} settled ${amountText}`
                : `✓ Your ${amountText} payment was recorded`;
              const body = isReceiver
                ? `${fromName} paid you ${amountText} in "${groupName}".`
                : `${toName} marked your ${amountText} payment received in "${groupName}".`;
              await pushToUser(recipientId, {
                title,
                body,
                url: `/app/groups/${input.groupId}`,
                // Per-group tag — newer pushes replace older ones at the
                // OS level, so multiple settlements in a row collapse
                // into one visible notification.
                tag: `easysplits-settlement-${input.groupId}`,
              });
            }
          } catch (err) {
            // Best-effort: settlement is real even if push hiccups.
            console.error("Settlement push failed", err);
          }
        })();
      }

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
