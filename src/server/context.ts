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

  if (!user) return { supabase, user: null };

  // Pull display name + avatar from OAuth metadata when available.
  // Google fills user_metadata.{full_name, name, avatar_url, picture};
  // email-link signups have neither. Falling back to the email prefix
  // happens at the consumer (see lib/profile-defaults.ts), not here —
  // we just expose the raw provider data.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const pickStr = (k: string): string | null =>
    typeof meta[k] === "string" && (meta[k] as string).length > 0
      ? (meta[k] as string)
      : null;
  const fullName = pickStr("full_name") ?? pickStr("name");
  const avatarUrl = pickStr("avatar_url") ?? pickStr("picture");

  return {
    supabase,
    user: {
      id: user.id,
      email: user.email ?? null,
      fullName,
      avatarUrl,
    },
  };
}
