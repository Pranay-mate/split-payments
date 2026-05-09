import { z } from "zod";
import { randomBytes, randomUUID } from "node:crypto";
import { and, count, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import {
  claimTokens,
  expenses,
  groupMembers,
  groups,
  profiles,
  settlements,
} from "@/lib/db/schema";
import { logEvent } from "../events";
import {
  profileAvatarDefault,
  profileDisplayDefault,
} from "@/lib/profile-defaults";

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

/**
 * Check that `userId` is the group's creator. Used for destructive /
 * identity-sensitive actions (removing real members, deleting the group,
 * generating claim links). Membership is implied — if you're the creator
 * you're a member.
 */
async function requireCreator(groupId: string, userId: string) {
  const [grp] = await db
    .select({ createdBy: groups.createdBy })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!grp) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });
  }
  if (grp.createdBy !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the group creator can do this.",
    });
  }
  return grp.createdBy;
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
          isGuest: profiles.isGuest,
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
        isGuest: r.isGuest ?? false,
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
          displayName: profileDisplayDefault(ctx.user),
          avatarUrl: profileAvatarDefault(ctx.user),
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

      await logEvent({
        groupId: created.id,
        eventType: "group.created",
        actorId: ctx.user.id,
        payload: { name: created.name, currency: created.primaryCurrency },
      });

      return created;
    }),

  /** Update a group's name. Only group members can rename. */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(80).optional(),
        primaryCurrency: currencySchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMembership(input.id, ctx.user.id);

      // Block currency change if any expense or settlement exists — would
      // invalidate stored convertedAmount values. Allowed only on empty groups.
      if (input.primaryCurrency) {
        const [{ value: expCount }] = await db
          .select({ value: count() })
          .from(expenses)
          .where(eq(expenses.groupId, input.id));
        const [{ value: setCount }] = await db
          .select({ value: count() })
          .from(settlements)
          .where(eq(settlements.groupId, input.id));
        if (expCount + setCount > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Can't change currency once expenses or settlements exist. Create a new group instead.",
          });
        }
      }

      const [updated] = await db
        .update(groups)
        .set({
          ...(input.name !== undefined && { name: input.name.trim() }),
          ...(input.primaryCurrency !== undefined && {
            primaryCurrency: input.primaryCurrency,
          }),
          updatedAt: new Date(),
        })
        .where(eq(groups.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update group",
        });
      }

      await logEvent({
        groupId: input.id,
        eventType: "group.updated",
        actorId: ctx.user.id,
        payload: {
          ...(input.name && { newName: input.name.trim() }),
          ...(input.primaryCurrency && { newCurrency: input.primaryCurrency }),
        },
      });

      return updated;
    }),

  /** Soft-delete a group. Creator-only; cascades drop on the DB side. */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireCreator(input.id, ctx.user.id);
      await db
        .update(groups)
        .set({ deletedAt: new Date() })
        .where(eq(groups.id, input.id));
      await logEvent({
        groupId: input.id,
        eventType: "group.deleted",
        actorId: ctx.user.id,
        payload: {},
      });
      return { ok: true };
    }),

  /**
   * Remove a member from a group. Trust model:
   *   - real auth users → creator only
   *   - guest (shadow) profiles → any group member (no real identity to
   *     protect; trivially re-addable by name).
   * Self-removal is rejected — use `leave` instead.
   */
  removeMember: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        userId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMembership(input.groupId, ctx.user.id);
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use 'Leave group' to remove yourself.",
        });
      }

      const [target] = await db
        .select({ isGuest: profiles.isGuest })
        .from(profiles)
        .where(eq(profiles.id, input.userId))
        .limit(1);

      // Guests can be removed by any member; auth users only by creator.
      if (!target?.isGuest) {
        await requireCreator(input.groupId, ctx.user.id);
      }

      await db
        .delete(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, input.groupId),
            eq(groupMembers.userId, input.userId),
          ),
        );
      await logEvent({
        groupId: input.groupId,
        eventType: "member.removed",
        actorId: ctx.user.id,
        payload: { removedUserId: input.userId, wasGuest: !!target?.isGuest },
      });
      return { ok: true };
    }),

  /** Leave a group. Removes the current user's membership. */
  leave: protectedProcedure
    .input(z.object({ groupId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ensureMembership(input.groupId, ctx.user.id);
      await db
        .delete(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, input.groupId),
            eq(groupMembers.userId, ctx.user.id),
          ),
        );
      await logEvent({
        groupId: input.groupId,
        eventType: "member.left",
        actorId: ctx.user.id,
        payload: {},
      });
      return { ok: true };
    }),

  /**
   * Add a non-signup ("guest") member to a group. Creates a shadow profile
   * with a generated UUID and adds it to group_members. Anyone in the group
   * can do this — same trust model as sharing the group's invite link.
   */
  addGuest: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        name: z.string().min(1).max(60),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureMembership(input.groupId, ctx.user.id);

      const shadowId = randomUUID();
      const trimmed = input.name.trim();

      await db.transaction(async (tx) => {
        await tx.insert(profiles).values({
          id: shadowId,
          displayName: trimmed,
          isGuest: true,
        });
        await tx.insert(groupMembers).values({
          groupId: input.groupId,
          userId: shadowId,
        });
      });

      await logEvent({
        groupId: input.groupId,
        eventType: "guest.added",
        actorId: ctx.user.id,
        payload: { shadowProfileId: shadowId, displayName: trimmed },
      });

      return {
        userId: shadowId,
        joinedAt: new Date(),
        displayName: trimmed,
        avatarUrl: null,
        isGuest: true,
      };
    }),

  /**
   * Create a single-use claim token for a guest. Creator-only — clicking
   * a claim link absorbs the guest's history into the clicker's account,
   * which is identity-sensitive enough to gate on group ownership.
   */
  createClaimToken: protectedProcedure
    .input(
      z.object({
        groupId: z.string().uuid(),
        shadowProfileId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireCreator(input.groupId, ctx.user.id);

      const [shadow] = await db
        .select({ id: profiles.id, isGuest: profiles.isGuest })
        .from(profiles)
        .innerJoin(groupMembers, eq(groupMembers.userId, profiles.id))
        .where(
          and(
            eq(profiles.id, input.shadowProfileId),
            eq(groupMembers.groupId, input.groupId),
          ),
        )
        .limit(1);

      if (!shadow || !shadow.isGuest) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That member is not a guest.",
        });
      }

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await db.insert(claimTokens).values({
        token,
        shadowProfileId: input.shadowProfileId,
        groupId: input.groupId,
        createdBy: ctx.user.id,
        expiresAt,
      });

      return { token, expiresAt };
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
          displayName: profileDisplayDefault(ctx.user),
          avatarUrl: profileAvatarDefault(ctx.user),
        })
        .onConflictDoNothing();

      // Idempotent join.
      const inserted = await db
        .insert(groupMembers)
        .values({ groupId: group.id, userId: ctx.user.id })
        .onConflictDoNothing()
        .returning();

      if (inserted.length > 0) {
        await logEvent({
          groupId: group.id,
          eventType: "member.joined",
          actorId: ctx.user.id,
          payload: {},
        });
      }

      return group;
    }),
});
