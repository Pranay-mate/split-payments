import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import {
  profileAvatarDefault,
  profileDisplayDefault,
} from "@/lib/profile-defaults";
import {
  claimTokens,
  events,
  expenseComments,
  expenseSplits,
  expenses,
  groupMembers,
  profiles,
  settlements,
} from "@/lib/db/schema";
import { logEvent } from "../events";

export const claimRouter = router({
  /**
   * Inspect a claim token without consuming it. Lets the /claim/[token]
   * page show the user what they're about to claim before they sign in.
   */
  preview: protectedProcedure
    .input(z.object({ token: z.string().min(20) }))
    .query(async ({ input }) => {
      const [tok] = await db
        .select()
        .from(claimTokens)
        .where(eq(claimTokens.token, input.token))
        .limit(1);

      if (!tok) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid link." });
      }
      if (tok.usedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This link has already been used.",
        });
      }
      if (tok.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This link has expired.",
        });
      }

      const [shadow] = await db
        .select({ displayName: profiles.displayName })
        .from(profiles)
        .where(eq(profiles.id, tok.shadowProfileId))
        .limit(1);

      return {
        groupId: tok.groupId,
        guestName: shadow?.displayName ?? "Guest",
      };
    }),

  /**
   * Consume a claim token: migrate every reference to the shadow profile
   * over to the calling auth user, then delete the shadow.
   *
   * Edge cases handled:
   * - Auth user already in the group (merge): drop the shadow's
   *   group_members row instead of updating it.
   * - Same expense has both auth user and shadow as splitters: sum
   *   amounts into the auth user's row, drop the shadow's.
   */
  consume: protectedProcedure
    .input(z.object({ token: z.string().min(20) }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.transaction(async (tx) => {
        const [tok] = await tx
          .select()
          .from(claimTokens)
          .where(eq(claimTokens.token, input.token))
          .limit(1);

        if (!tok) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invalid link." });
        }
        if (tok.usedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This link has already been used.",
          });
        }
        if (tok.expiresAt < new Date()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This link has expired.",
          });
        }

        const S1 = tok.shadowProfileId;
        const A1 = ctx.user.id;
        const gid = tok.groupId;

        // Make sure the auth user has a profile row (signup may have skipped it).
        await tx
          .insert(profiles)
          .values({
            id: A1,
            displayName: profileDisplayDefault(ctx.user),
            avatarUrl: profileAvatarDefault(ctx.user),
          })
          .onConflictDoNothing();

        // group_members: if A1 already in this group, drop S1's row;
        // else flip S1's row to A1.
        const a1Member = await tx
          .select({ userId: groupMembers.userId })
          .from(groupMembers)
          .where(
            and(eq(groupMembers.groupId, gid), eq(groupMembers.userId, A1)),
          )
          .limit(1);

        if (a1Member.length > 0) {
          await tx
            .delete(groupMembers)
            .where(
              and(eq(groupMembers.groupId, gid), eq(groupMembers.userId, S1)),
            );
        } else {
          await tx
            .update(groupMembers)
            .set({ userId: A1 })
            .where(
              and(eq(groupMembers.groupId, gid), eq(groupMembers.userId, S1)),
            );
        }

        // expense_splits: when both A1 and S1 split the same expense, sum
        // amounts into A1's row and drop S1's. The UPSERT-style merge first,
        // then a plain UPDATE for the remaining (non-conflicting) S1 rows.
        await tx.execute(sql`
          UPDATE expense_splits a
             SET amount = a.amount + b.amount
            FROM expense_splits b
           WHERE a.user_id = ${A1}
             AND b.user_id = ${S1}
             AND a.expense_id = b.expense_id
        `);
        await tx.execute(sql`
          DELETE FROM expense_splits
           WHERE user_id = ${S1}
             AND expense_id IN (
               SELECT expense_id FROM expense_splits WHERE user_id = ${A1}
             )
        `);
        await tx
          .update(expenseSplits)
          .set({ userId: A1 })
          .where(eq(expenseSplits.userId, S1));

        // Straightforward FK rewrites — no uniqueness constraints to worry about.
        await tx
          .update(expenses)
          .set({ payerId: A1 })
          .where(eq(expenses.payerId, S1));
        await tx
          .update(settlements)
          .set({ fromUserId: A1 })
          .where(eq(settlements.fromUserId, S1));
        await tx
          .update(settlements)
          .set({ toUserId: A1 })
          .where(eq(settlements.toUserId, S1));
        await tx
          .update(expenseComments)
          .set({ userId: A1 })
          .where(eq(expenseComments.userId, S1));
        await tx
          .update(events)
          .set({ actorId: A1 })
          .where(eq(events.actorId, S1));

        // Mark token consumed; delete shadow.
        await tx
          .update(claimTokens)
          .set({ usedAt: new Date() })
          .where(eq(claimTokens.token, input.token));
        await tx.delete(profiles).where(eq(profiles.id, S1));

        return { groupId: gid };
      });

      await logEvent({
        groupId: result.groupId,
        eventType: "guest.claimed",
        actorId: ctx.user.id,
        payload: { claimedBy: ctx.user.id },
      });

      return result;
    }),
});
