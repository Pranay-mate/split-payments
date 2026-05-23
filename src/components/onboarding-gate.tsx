"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

/**
 * Redirects first-time users from any authed route to /app/welcome
 * exactly once. Looks up `profiles.me.onboardedAt`; if null AND the
 * user isn't already on /app/welcome, navigates there.
 *
 * Implementation notes:
 *   - profiles.me is cached client-side (60s staleTime per the
 *     existing useQuery in user-menu), so this is a cheap read after
 *     first page-load
 *   - Brief flash possible: the user lands on /app/groups, mounts
 *     this gate, waits ~50-100ms for profiles.me, then redirects.
 *     Acceptable trade-off vs. middleware-based DB hit on every req
 *   - Existing users (pre-0005 migration) had onboardedAt backfilled
 *     to NOW(), so this gate never fires for them
 *   - Returns null — no UI; the redirect happens via useEffect
 */
export function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();
  const meQuery = trpc.profiles.me.useQuery();

  useEffect(() => {
    const me = meQuery.data;
    if (!me) return;
    // Type guard — onboarded_at column may not yet be in the cached
    // type if a deploy lands before the schema invalidates.
    const onboardedAt = (me as { onboardedAt?: Date | string | null })
      .onboardedAt;
    if (onboardedAt) return;
    // Already on /welcome — let the user finish the flow.
    if (pathname?.startsWith("/app/welcome")) return;
    router.replace("/app/welcome");
  }, [meQuery.data, pathname, router]);

  return null;
}
