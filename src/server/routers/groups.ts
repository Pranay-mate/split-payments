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
        and(
          eq(groupMembers.userId, ctx.user.id),
          isNull(groups.deletedAt),
        ),
      )
      .orderBy(groups.createdAt);

    return rows;
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
      // Ensure the user has a profile row (idempotent — created on first signup).
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
});
