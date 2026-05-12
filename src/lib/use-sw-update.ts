"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Service-worker update detection. Watches for a new SW reaching the
 * 'waiting' state — that means a fresh build is downloaded and ready
 * but not yet active. Surfaces this through `updateAvailable` so the
 * <SwUpdateBanner /> can prompt the user to reload.
 *
 * Polls for updates every 30 min while the tab is open so long-lived
 * sessions (a desktop user with the PWA pinned all day) eventually
 * notice a deploy without needing a hard reload.
 */

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export type SwUpdateState = {
  /** True when a new SW is in the 'waiting' state. */
  updateAvailable: boolean;
  /** Trigger SKIP_WAITING + page reload. No-op if there's nothing to apply. */
  applyUpdate: () => void;
};

export function useSwUpdate(): SwUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let pollHandle: number | null = null;

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
          // A new SW reached 'installed' but our page is still controlled by
          // the previous one — that's the "update ready" moment.
          markWaiting(sw);
        }
      });
      void registration;
    };

    void (async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/sw.js");
        if (!registration || cancelled) return;

        // If the user landed on a tab that already had a waiting SW
        // (e.g. opened a new tab after an old deploy), surface it now.
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

        // Periodically nudge the browser to check for an updated SW
        // script. Without this, the browser only checks on navigation,
        // which long-lived PWA tabs rarely trigger.
        pollHandle = window.setInterval(() => {
          registration.update().catch(() => {
            // Silent — network failures here aren't user-facing.
          });
        }, POLL_INTERVAL_MS);
      } catch {
        // SW API not available or blocked — feature simply stays off.
      }
    })();

    // When the active SW changes (because we sent SKIP_WAITING), reload
    // the page so the new assets get used. Guard against the reload
    // loop with `reloadingRef`.
    const onControllerChange = () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      if (pollHandle !== null) window.clearInterval(pollHandle);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  const applyUpdate = useCallback(() => {
    const sw = waitingRef.current;
    if (!sw) {
      // Nothing waiting (shouldn't happen given the banner only renders
      // when updateAvailable === true). Hard-reload as a fallback.
      window.location.reload();
      return;
    }
    sw.postMessage({ type: "SKIP_WAITING" });
    // The actual reload fires from the `controllerchange` handler once
    // the new SW takes over — gives a smoother transition than reloading
    // before the swap completes.
  }, []);

  return { updateAvailable, applyUpdate };
}
