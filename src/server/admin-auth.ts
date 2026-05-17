/**
 * Admin authorization. Gates the /app/admin surface + admin.* tRPC router.
 *
 * Allow-list is sourced from the ADMIN_USER_IDS env var — comma-separated
 * Supabase user UUIDs. Empty / missing env = nobody is admin (safe default;
 * the admin route 404-redirects).
 *
 * We deliberately do NOT add a separate password. Adding a second secret
 * is more attack surface than relying on the existing Google MFA on the
 * already-authenticated account. The env var lives only on the server.
 */
import { TRPCError } from "@trpc/server";
import { middleware, protectedProcedure } from "./trpc";

function loadAdminIds(): ReadonlySet<string> {
  const raw = process.env.ADMIN_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

/**
 * Resolves on every call rather than module load, so a Vercel env-var
 * update takes effect on the next request without redeploy of the route.
 */
export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return loadAdminIds().has(userId);
}

const requireAdmin = middleware(({ ctx, next }) => {
  if (!ctx.user || !isAdmin(ctx.user.id)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access only.",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = protectedProcedure.use(requireAdmin);
