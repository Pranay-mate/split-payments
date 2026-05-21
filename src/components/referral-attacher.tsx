"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";

/**
 * After sign-in, attach the referrer to the current user's profile.
 * Server-side mutation is idempotent + write-once (first invite wins).
 *
 * Two sources, in priority order:
 *   1. localStorage `ref-from` — written by <ReferralCapture /> on the
 *      public homepage when `?from=` was in the URL pre-signin.
 *   2. URL `?from=<inviter>` — direct path used by group invite links
 *      (`/app/join/<token>?from=<inviter>`), so a WhatsApp invitee can
 *      be attributed even though they never hit the homepage.
 *
 * Mounted in the (authed) layout AND inline on the join page — fires
 * exactly once per page-load if a referrer is found. Clears localStorage
 * on success so it doesn't keep firing harmlessly on every navigation.
 *
 * Sanitiser kept inline (matching ReferralCapture + server) — three
 * occurrences is the threshold for extraction; deferring until a fourth
 * lands.
 */
export function ReferralAttacher() {
  const firedRef = useRef(false);
  const attachMutation = trpc.profiles.attachReferrer.useMutation();

  useEffect(() => {
    if (firedRef.current) return;
    if (typeof window === "undefined") return;
    let name = window.localStorage.getItem("ref-from");
    if (!name) {
      // Fallback: WhatsApp group-invite path lands users straight on
      // `/app/join/<token>?from=<inviter>` post-signin, bypassing the
      // homepage capture step. Read `?from=` directly here.
      const raw = new URLSearchParams(window.location.search).get("from");
      const cleaned = (raw ?? "")
        .replace(/[^a-zA-Zऀ-ॿ֐-׿\s'-]/g, "")
        .trim()
        .slice(0, 24);
      if (cleaned) name = cleaned;
    }
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
