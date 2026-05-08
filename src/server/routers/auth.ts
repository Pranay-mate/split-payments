import { eq } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { groupMembers, profiles } from "@/lib/db/schema";

export const authRouter = router({
  /** Returns the current authenticated user (or null). */
  me: publicProcedure.query(({ ctx }) => {
    return ctx.user;
  }),

  /** Signs the current user out. */
  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.supabase.auth.signOut();
    return { ok: true };
  }),

  /**
   * Soft-delete the current user's account. We:
   *   1. Drop their profile row (anonymises them in member lists going forward).
   *   2. Drop all group_members rows so they can no longer access groups.
   *   3. Sign them out.
   *
   * We don't delete the auth.users row itself (would need supabase admin
   * client + service-role key + careful auth state cleanup). The user can
   * re-sign-in to start fresh — the auto-create-profile flow will give them
   * a clean slate.
   *
   * Their historical expenses + splits + settlements remain in the database
   * with their old userId. This preserves group history for other members.
   * The UI shows "Former member" where their profile is missing.
   */
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    await db.delete(groupMembers).where(eq(groupMembers.userId, ctx.user.id));
    await db.delete(profiles).where(eq(profiles.id, ctx.user.id));
    await ctx.supabase.auth.signOut();
    return { ok: true };
  }),
});
