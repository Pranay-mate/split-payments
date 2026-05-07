import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { groupMembers, groups, profiles } from "@/lib/db/schema";

const currencySchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, "3-letter ISO 4217 currency");

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

export const groupsRouter = router({
  /** Lists all groups the current user is a member of. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: groups.id,
        name: groups.name,
        primaryCurrency: groups.primaryCurrency,
        inviteToken: groups.inviteToken,
        createdAt: groups.createdAt,
      })
      .from(groups)
      .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
      .where(
        and(eq(groupMembers.userId, ctx.user.id), isNull(groups.deletedAt)),
      )
      .orderBy(groups.createdAt);

    return rows;
  }),

  /** Get a single group by id (must be a member). */
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await ensureMembership(input.id, ctx.user.id);

      const [group] = await db
        .select()
        .from(groups)
        .where(and(eq(groups.id, input.id), isNull(groups.deletedAt)))
        .limit(1);

      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
      }

      return group;
    }),

  /** List members of a group with their profiles. */
  members: protectedProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await ensureMembership(input.groupId, ctx.user.id);

      const rows = await db
        .select({
          userId: groupMembers.userId,
          joinedAt: groupMembers.joinedAt,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
        })
        .from(groupMembers)
        .leftJoin(profiles, eq(profiles.id, groupMembers.userId))
        .where(eq(groupMembers.groupId, input.groupId))
        .orderBy(groupMembers.joinedAt);

      return rows.map((r) => ({
        userId: r.userId,
        joinedAt: r.joinedAt,
        displayName: r.displayName ?? "Member",
        avatarUrl: r.avatarUrl,
      }));
    }),

  /** Creates a new group with the current user as creator + first member. */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80),
        primaryCurrency: currencySchema.default("INR"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(profiles)
        .values({
          id: ctx.user.id,
          displayName: ctx.user.email?.split("@")[0] ?? "Member",
        })
        .onConflictDoNothing();

      const [created] = await db
        .insert(groups)
        .values({
          name: input.name.trim(),
          primaryCurrency: input.primaryCurrency,
          createdBy: ctx.user.id,
        })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create group",
        });
      }

      await db.insert(groupMembers).values({
        groupId: created.id,
        userId: ctx.user.id,
      });

      return created;
    }),

  /** Join an existing group via its invite token. */
  joinByToken: protectedProcedure
    .input(z.object({ token: z.string().min(20) }))
    .mutation(async ({ ctx, input }) => {
      const [group] = await db
        .select()
        .from(groups)
        .where(and(eq(groups.inviteToken, input.token), isNull(groups.deletedAt)))
        .limit(1);

      if (!group) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite link is invalid or expired." });
      }

      // Ensure profile exists.
      await db
        .insert(profiles)
        .values({
          id: ctx.user.id,
          displayName: ctx.user.email?.split("@")[0] ?? "Member",
        })
        .onConflictDoNothing();

      // Idempotent join.
      await db
        .insert(groupMembers)
        .values({ groupId: group.id, userId: ctx.user.id })
        .onConflictDoNothing();

      return group;
    }),
});
