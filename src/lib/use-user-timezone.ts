"use client";

import { trpc } from "@/lib/trpc/client";

/**
 * Returns the current user's preferred timezone (e.g. "Asia/Kolkata").
 * Falls back to the profile default until the trpc.profiles.me query
 * resolves; never returns null. Use with formatDate(d, tz, preset).
 *
 * Caches at the trpc query level (60s staleTime). No extra requests.
 */
export function useUserTimezone(): string {
  const meQuery = trpc.profiles.me.useQuery(undefined, { staleTime: 60_000 });
  const tz = (meQuery.data as { timezone?: string } | undefined)?.timezone;
  return tz && tz.length > 0 ? tz : "Asia/Kolkata";
}
