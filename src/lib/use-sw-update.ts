"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Service-worker update detection with idle auto-apply.
 *
 * Watches for a new SW reaching the 'waiting' state — that means a
 * fresh build is downloaded and ready but not yet active. Two paths
 * from there:
 *
 *   1. Silent auto-update: if the user has been idle for ≥2 minutes,
 *      we silently call applyUpdate() ourselves. A localStorage flag
 *      gets set right before reload so the next page-load can show a
 *      one-time "Updated" toast — keeps the user informed without
 *      interrupting them.
 *   2. Active user: surface `updateAvailable` so <SwUpdateBanner />
 *      can prompt them. They click Reload when they're ready, no
 *      surprises mid-edit.
 *
 * Polls for updates every 30 min so long-lived PWA tabs don't sit on
 * a stale SW forever. Idle threshold tuned to 2 min (down from 5) so
 * post-deploy rollout to active users completes faster.
 */

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const IDLE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // re-check idle every 60s

/** Flag set immediately before an auto-update reload. The new tab
 *  reads + clears it, then shows a one-time "✨ Updated" toast. */
export const JUST_AUTO_UPDATED_KEY = "easysplits.just-auto-updated";

export type SwUpdateState = {
  /** True when a new SW is in 'waiting' AND we haven't auto-applied
   *  yet. Drives the in-app banner. */
  updateAvailable: boolean;
  /** Trigger SKIP_WAITING + page reload. No-op if nothing to apply. */
  applyUpdate: () => void;
};

export function useSwUpdate(): SwUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
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

    const markWaiting = (sw: ServiceWorker | null) => {
      if (!sw || cancelled) return;
      waitingRef.current = sw;
      queueMicrotask(() => setUpdateAvailable(true));
    };

    const trackInstalling = (
      registration: ServiceWorkerRegistration,
      sw: ServiceWorker,
    ) => {
      sw.addEventListener("statechange", () => {
        if (sw.state === "installed" && navigator.serviceWorker.controller) {
          markWaiting(sw);
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

    // Silent-apply path: every minute, check if an update is waiting
    // AND the user is idle. If both true, swap in the new SW without
    // bothering them. Flag in localStorage so we can toast post-reload.
    idleCheckHandle = window.setInterval(() => {
      if (!waitingRef.current) return;
      if (reloadingRef.current) return;
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

    void (async () => {
      try {
        const registration =
          await navigator.serviceWorker.getRegistration("/sw.js");
        if (!registration || cancelled) return;

        if (registration.waiting && navigator.serviceWorker.controller) {
          markWaiting(registration.waiting);
        }
        if (registration.installing) {
          trackInstalling(registration, registration.installing);
        }
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (installing) trackInstalling(registration, installing);
        });

        pollHandle = window.setInterval(() => {
          registration.update().catch(() => {
            // Silent — network failures here aren't user-facing.
          });
        }, POLL_INTERVAL_MS);
      } catch {
        // SW API not available or blocked — feature simply stays off.
      }
    })();

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
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  const applyUpdate = useCallback(() => {
    const sw = waitingRef.current;
    if (!sw) {
      window.location.reload();
      return;
    }
    sw.postMessage({ type: "SKIP_WAITING" });
  }, []);

  return { updateAvailable, applyUpdate };
}
