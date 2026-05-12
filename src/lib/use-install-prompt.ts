"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Shared PWA-install state hook. Encapsulates:
 *   - capturing the `beforeinstallprompt` event so we can fire it later
 *   - detecting standalone / installed state on every platform we can
 *   - 7-day dismiss cooldown (per-user, localStorage)
 *   - "first meaningful action done" gate so we don't pester newcomers
 *
 * Two surfaces consume this:
 *   - <InstallPrompt /> — bottom-banner nag inside the authed app
 *   - <InstallFooterLink /> — quiet text link in the marketing-site
 *     footer; always discoverable, never naggy
 */

const DISMISS_KEY = "easysplits-install-dismissed";
const FIRST_ACTION_KEY = "easysplits.first-action-done";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type Platform = "android-chrome" | "ios" | "desktop" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !("MSStream" in window)) return "ios";
  if (/Android/.test(ua)) return "android-chrome";
  return "desktop";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari uses non-standard `navigator.standalone`.
  return Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  );
}

function readDismissedUntil(): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = window.localStorage.getItem(DISMISS_KEY);
    if (!v) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function persistDismiss() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DISMISS_KEY,
      String(Date.now() + DISMISS_DURATION_MS),
    );
  } catch {
    // localStorage disabled — banner just won't dismiss across reloads.
  }
}

function readFirstActionDone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FIRST_ACTION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Call this from the add-expense or scorecard-completion flows to mark
 *  the user as having seen value — gates the install nag onto an earned
 *  moment instead of yelling on first paint. */
export function markFirstActionDone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FIRST_ACTION_KEY, "1");
  } catch {
    // ignore
  }
}

/**
 * Detect whether the PWA is already installed even if the user is
 * currently viewing the site in a browser tab. Chromium-only; we fall
 * back to `null` on platforms where we can't tell.
 */
async function detectInstalled(): Promise<boolean | null> {
  if (typeof window === "undefined") return null;
  if (isStandalone()) return true;
  const nav = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<unknown[]>;
  };
  if (typeof nav.getInstalledRelatedApps !== "function") return null;
  try {
    const apps = await nav.getInstalledRelatedApps();
    return apps.length > 0;
  } catch {
    return null;
  }
}

export type InstallState = {
  /** Has the browser fired `beforeinstallprompt`? Means we can call
   *  `triggerNativePrompt()` immediately. */
  canInstall: boolean;
  /** True when we're confident the PWA is installed (standalone or
   *  `getInstalledRelatedApps` reports it). */
  installed: boolean;
  /** OS family — drives which copy to show (iOS gets manual instructions). */
  platform: Platform;
  /** Whether the user has done a meaningful action (added an expense
   *  or completed the scorecard) — gates the in-app banner. */
  firstActionDone: boolean;
  /** True while the 7-day dismiss cooldown is still active. Computed
   *  inside the hook (via state) so render-pure callers don't need to
   *  call Date.now() themselves. */
  inCooldown: boolean;
  /** Trigger the native Chrome/Edge install dialog. No-op on iOS. */
  triggerNativePrompt: () => Promise<"accepted" | "dismissed" | "no-prompt">;
  /** Save a 7-day dismiss timestamp so we don't re-pester. */
  dismiss: () => void;
};

export function useInstallPrompt(): InstallState {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [firstActionDone, setFirstActionDone] = useState(false);
  const [inCooldown, setInCooldown] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      setPlatform(detectPlatform());
      setFirstActionDone(readFirstActionDone());
      setInCooldown(Date.now() < readDismissedUntil());
      setInstalled(isStandalone());
    });

    void detectInstalled().then((v) => {
      if (v === true) setInstalled(true);
    });

    const onBeforeInstall = (e: Event) => {
      const event = e as BeforeInstallPromptEvent;
      event.preventDefault();
      setDeferredPrompt(event);
      setCanInstall(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setCanInstall(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const triggerNativePrompt = useCallback(async (): Promise<
    "accepted" | "dismissed" | "no-prompt"
  > => {
    if (!deferredPrompt) return "no-prompt";
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
      setCanInstall(false);
    }
    return choice.outcome;
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    persistDismiss();
    setInCooldown(true);
  }, []);

  return {
    canInstall,
    installed,
    platform,
    firstActionDone,
    inCooldown,
    triggerNativePrompt,
    dismiss,
  };
}
