/**
 * tRPC server setup — context, instance, and procedure builders.
 *
 * Procedures:
 *   publicProcedure   — anyone can call
 *   protectedProcedure — requires an authenticated Supabase user
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TrpcContext = {
  supabase: SupabaseClient;
  user: { id: string; email: string | null } | null;
};

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

const requireAuth = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to do this.",
    });
  }
  return next({
    ctx: { ...ctx, user: ctx.user },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);
