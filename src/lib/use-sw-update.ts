"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseMajor } from "@/lib/app-version";

/**
 * Service-worker update detection with two release tiers.
 *
 * Watches for a new SW reaching the 'waiting' state — a fresh build is
 * downloaded and ready but not yet active. Once waiting, we query
 * BOTH the active SW and the waiting SW for their APP_VERSION via
 * MessageChannel and compare majors:
 *
 *   - Same major (e.g. active 1.0, waiting 1.1): normal release.
 *       Surface `updateAvailable` so <SwUpdateBanner /> can prompt. If
 *       the user goes idle for ≥2 min, silently auto-apply and set
 *       JUST_AUTO_UPDATED_KEY so the next page-load shows a toast.
 *   - New major (e.g. active 1.x, waiting 2.0): force release.
 *       Surface `forceUpdate` immediately. <ForceUpdateModal /> blocks
 *       the app until the user reloads (or the 30s countdown fires).
 *       No idle wait — force means force.
 *
 * Why compare *active SW* vs *waiting SW* (not the JS bundle's
 * APP_VERSION vs waiting SW)? Because network-first navigation always
 * loads the latest HTML+JS, so the bundle's APP_VERSION always equals
 * the waiting SW's version on a kill+reopen — that comparison can
 * never trigger force-update for users who close and reopen the PWA.
 * The active SW lags the deploy until SKIP_WAITING fires; its version
 * is the honest "what the user previously accepted" baseline.
 *
 * Polls for updates every 30 min so long-lived PWA tabs don't sit on a
 * stale SW forever. Additionally checks on visibilitychange/focus so
 * foregrounding the PWA picks up new builds within seconds instead of
 * waiting out the poll window.
 */

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const IDLE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // re-check idle every 60s
const VERSION_QUERY_TIMEOUT_MS = 1500;

/** Flag set immediately before an auto-update reload. The new tab
 *  reads + clears it, then shows a one-time "✨ Updated" toast. */
export const JUST_AUTO_UPDATED_KEY = "easysplits.just-auto-updated";

export type SwUpdateState = {
  /** True when a new SW is waiting AND its major matches the current
   *  major. Drives the dismissible in-app banner. */
  updateAvailable: boolean;
  /** True when a new SW is waiting AND its major is higher than the
   *  current. Drives the blocking force-update modal. Mutually
   *  exclusive with `updateAvailable`. */
  forceUpdate: boolean;
  /** Trigger SKIP_WAITING + page reload. No-op if nothing to apply. */
  applyUpdate: () => void;
};

/** Ask a waiting SW what version it is, via a one-shot MessageChannel.
 *  Returns null on timeout or any error — caller treats null as
 *  "same major" (safer default than triggering force-update). */
function querySwVersion(sw: ServiceWorker): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: string | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    try {
      const channel = new MessageChannel();
      channel.port1.onmessage = (e) => finish(e.data?.version ?? null);
      sw.postMessage({ type: "GET_VERSION" }, [channel.port2]);
      window.setTimeout(() => finish(null), VERSION_QUERY_TIMEOUT_MS);
    } catch {
      finish(null);
    }
  });
}

export function useSwUpdate(): SwUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);
  const reloadingRef = useRef(false);
  const lastInteractionRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    lastInteractionRef.current = Date.now();

    let cancelled = false;
    let pollHandle: number | null = null;
    let idleCheckHandle: number | null = null;

    const markWaiting = async (sw: ServiceWorker | null) => {
      if (!sw || cancelled) return;
      // First-time install (no controller) — don't ever force a fresh
      // user into a force-reload modal on their very first encounter
      // with the app. They'll naturally pick up the new SW on next load.
      const controller = navigator.serviceWorker.controller;
      if (!controller) return;
      waitingRef.current = sw;
      // Compare ACTIVE SW vs WAITING SW (not the JS bundle's
      // APP_VERSION). On network-first navigations the JS bundle is
      // always the latest, so comparing against it makes force-update
      // unreachable for the kill+reopen path. The active SW reflects
      // what the user last actually accepted, so its version is the
      // honest "before" of the upgrade. Pre-1.0 SWs without a
      // GET_VERSION handler time out → treat as major 0 (any 1.0+
      // waiting SW correctly counts as a force).
      const [activeVersion, waitingVersion] = await Promise.all([
        querySwVersion(controller),
        querySwVersion(sw),
      ]);
      if (cancelled) return;
      // If we can't determine the waiting SW's version, fall back to
      // the dismissible banner — we'd rather under-fire force-update
      // than blast users on a flaky query.
      if (!waitingVersion) {
        queueMicrotask(() => setUpdateAvailable(true));
        return;
      }
      const activeMajor = activeVersion ? parseMajor(activeVersion) : 0;
      const waitingMajor = parseMajor(waitingVersion);
      if (waitingMajor > activeMajor) {
        queueMicrotask(() => setForceUpdate(true));
      } else {
        queueMicrotask(() => setUpdateAvailable(true));
      }
    };

    const trackInstalling = (
      registration: ServiceWorkerRegistration,
      sw: ServiceWorker,
    ) => {
      sw.addEventListener("statechange", () => {
        if (sw.state === "installed" && navigator.serviceWorker.controller) {
          void markWaiting(sw);
        }
      });
      void registration;
    };

    // Cheap activity tracking: passive listeners on document update
    // a ref so we don't re-render on every keystroke / pointer move.
    const touch = () => {
      lastInteractionRef.current = Date.now();
    };
    document.addEventListener("pointerdown", touch, { passive: true });
    document.addEventListener("keydown", touch, { passive: true });
    document.addEventListener("touchstart", touch, { passive: true });

    // Silent-apply path: every minute, check if a (non-force) update is
    // waiting AND the user is idle. If both true, swap in the new SW
    // without bothering them. Force-updates skip this path — they
    // trigger the modal immediately via markWaiting.
    idleCheckHandle = window.setInterval(() => {
      if (!waitingRef.current) return;
      if (reloadingRef.current) return;
      if (forceUpdate) return;
      const idleFor = Date.now() - lastInteractionRef.current;
      if (idleFor < IDLE_THRESHOLD_MS) return;
      try {
        window.localStorage.setItem(JUST_AUTO_UPDATED_KEY, "1");
      } catch {
        // Storage disabled — the toast just won't fire; reload still works.
      }
      const sw = waitingRef.current;
      waitingRef.current = null;
      sw.postMessage({ type: "SKIP_WAITING" });
      // controllerchange handler will trigger the actual reload.
    }, IDLE_CHECK_INTERVAL_MS);

    // Captured here so visibilitychange/focus handlers can call update()
    // even before the IIFE below has finished its async work.
    let cachedRegistration: ServiceWorkerRegistration | null = null;
    const triggerUpdateCheck = () => {
      if (!cachedRegistration || cancelled) return;
      cachedRegistration.update().catch(() => {
        // Silent — network failures here aren't user-facing.
      });
    };

    void (async () => {
      try {
        const registration =
          await navigator.serviceWorker.getRegistration("/sw.js");
        if (!registration || cancelled) return;
        cachedRegistration = registration;

        if (registration.waiting && navigator.serviceWorker.controller) {
          void markWaiting(registration.waiting);
        }
        if (registration.installing) {
          trackInstalling(registration, registration.installing);
        }
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (installing) trackInstalling(registration, installing);
        });

        pollHandle = window.setInterval(triggerUpdateCheck, POLL_INTERVAL_MS);
      } catch {
        // SW API not available or blocked — feature simply stays off.
      }
    })();

    // Foregrounding the PWA (or refocusing the tab) is a perfect moment
    // to check for updates — the user just came back, they're about to
    // engage, and any waiting SW we can surface now is one they won't
    // hit mid-action later. Both events fire; we throttle to avoid a
    // burst when the browser fires visibilitychange + focus together.
    let lastUpdateCheckMs = 0;
    const onMaybeForeground = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastUpdateCheckMs < 5_000) return;
      lastUpdateCheckMs = now;
      triggerUpdateCheck();
    };
    document.addEventListener("visibilitychange", onMaybeForeground);
    window.addEventListener("focus", onMaybeForeground);

    const onControllerChange = () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    return () => {
      cancelled = true;
      if (pollHandle !== null) window.clearInterval(pollHandle);
      if (idleCheckHandle !== null) window.clearInterval(idleCheckHandle);
      document.removeEventListener("pointerdown", touch);
      document.removeEventListener("keydown", touch);
      document.removeEventListener("touchstart", touch);
      document.removeEventListener("visibilitychange", onMaybeForeground);
      window.removeEventListener("focus", onMaybeForeground);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, [forceUpdate]);

  const applyUpdate = useCallback(() => {
    const sw = waitingRef.current;
    if (!sw) {
      window.location.reload();
      return;
    }
    sw.postMessage({ type: "SKIP_WAITING" });
  }, []);

  return { updateAvailable, forceUpdate, applyUpdate };
}
