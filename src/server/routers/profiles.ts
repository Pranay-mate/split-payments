import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

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

  /** Get the current user's profile. Creates one if missing. */
  me: protectedProcedure.query(async ({ ctx }) => {
    const existing = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, ctx.user.id))
      .limit(1);

    if (existing.length > 0) return existing[0];

    const fallbackName = ctx.user.email?.split("@")[0] ?? "Member";
    const [created] = await db
      .insert(profiles)
      .values({ id: ctx.user.id, displayName: fallbackName })
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
