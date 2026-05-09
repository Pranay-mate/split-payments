import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import {
  looksLikeEmailPrefix,
  profileAvatarDefault,
  profileDisplayDefault,
} from "@/lib/profile-defaults";

export const profilesRouter = router({
  /** Get profiles for an array of user IDs. Used to render member names. */
  byIds: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(profiles)
        .where(inArray(profiles.id, input.ids));
      return rows;
    }),

  /** Get the current user's profile. Creates one if missing. Also
   *  auto-upgrades a stale email-prefix display name / missing avatar
   *  to OAuth metadata when available, so existing users get the
   *  Google name + avatar populated on their next visit. */
  me: protectedProcedure.query(async ({ ctx }) => {
    const existing = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, ctx.user.id))
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      const wantedName = profileDisplayDefault(ctx.user);
      const wantedAvatar = profileAvatarDefault(ctx.user);

      // Only overwrite displayName if it still looks like the
      // email-prefix auto-fallback AND we have a better (OAuth) name.
      // Don't clobber names users have manually edited.
      const shouldUpgradeName =
        ctx.user.fullName !== null &&
        looksLikeEmailPrefix(row.displayName, ctx.user.email) &&
        wantedName !== row.displayName;
      // Avatar: fill in only if missing — user might have uploaded one.
      const shouldUpgradeAvatar =
        wantedAvatar !== null && row.avatarUrl === null;

      if (shouldUpgradeName || shouldUpgradeAvatar) {
        const [updated] = await db
          .update(profiles)
          .set({
            ...(shouldUpgradeName && { displayName: wantedName }),
            ...(shouldUpgradeAvatar && { avatarUrl: wantedAvatar }),
            updatedAt: new Date(),
          })
          .where(eq(profiles.id, ctx.user.id))
          .returning();
        return updated;
      }
      return row;
    }

    const [created] = await db
      .insert(profiles)
      .values({
        id: ctx.user.id,
        displayName: profileDisplayDefault(ctx.user),
        avatarUrl: profileAvatarDefault(ctx.user),
      })
      .returning();
    return created;
  }),

  /** Update the current user's display name + avatar. */
  update: protectedProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(60).optional(),
        avatarUrl: z.string().url().or(z.literal("")).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(profiles)
        .set({
          ...(input.displayName !== undefined && { displayName: input.displayName }),
          ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl || null }),
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, ctx.user.id))
        .returning();
      return updated;
    }),
});
