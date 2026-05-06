import { router, publicProcedure, protectedProcedure } from "../trpc";

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
});
