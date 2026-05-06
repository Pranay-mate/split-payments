/**
 * Builds the per-request tRPC context. Loaded from cookies via the SSR
 * Supabase client so server components see the current authenticated user.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TrpcContext } from "./trpc";

export async function createTrpcContext(): Promise<TrpcContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    user: user ? { id: user.id, email: user.email ?? null } : null,
  };
}
