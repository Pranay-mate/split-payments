"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";

/**
 * After sign-in, read the `ref-from` value stashed by <ReferralCapture />
 * on the public homepage and tell the server who referred this user.
 * Server-side mutation is idempotent + write-once.
 *
 * Mounts in the (authed) layout — fires exactly once per page-load if a
 * referrer is cached. Clears the cache on success so it doesn't keep
 * firing harmlessly on every navigation.
 */
export function ReferralAttacher() {
  const firedRef = useRef(false);
  const attachMutation = trpc.profiles.attachReferrer.useMutation();

  useEffect(() => {
    if (firedRef.current) return;
    if (typeof window === "undefined") return;
    const name = window.localStorage.getItem("ref-from");
    if (!name) return;
    firedRef.current = true;
    attachMutation.mutate(
      { name },
      {
        onSettled: () => {
          // Clear the cache either way — if it succeeded the server has
          // the value, if it failed (already set, empty after clean,
          // etc.) retrying won't help.
          try {
            window.localStorage.removeItem("ref-from");
            window.localStorage.removeItem("ref-from-at");
          } catch {
            // ignore
          }
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
