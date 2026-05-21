"use client";

import { useEffect } from "react";
import { sanitiseReferrerName } from "@/lib/referral-name";

/**
 * Capture `?from=<name>` from the homepage URL into localStorage so we
 * can attribute the eventual signup to the inviter — even though
 * Supabase OAuth bounces through 3 different origins and strips query
 * strings along the way.
 *
 * Mounted invisibly on the public homepage. Pairs with
 * <ReferralAttacher /> mounted in the (authed) layout, which reads
 * this value after sign-in and calls profiles.attachReferrer once.
 *
 * Write-once semantics in localStorage too: if a referrer is already
 * cached we don't overwrite, so a returning user clicking a different
 * friend's link doesn't steal attribution.
 */
export function ReferralCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cleaned = sanitiseReferrerName(
      new URLSearchParams(window.location.search).get("from"),
    );
    if (!cleaned) return;
    if (window.localStorage.getItem("ref-from")) return; // first-write-wins
    try {
      window.localStorage.setItem("ref-from", cleaned);
      window.localStorage.setItem("ref-from-at", String(Date.now()));
    } catch {
      // localStorage may be disabled (Safari private mode, etc.) — silent
      // failure is fine; the worst case is we miss attribution.
    }
  }, []);
  return null;
}
