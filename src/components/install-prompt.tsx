"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const DISMISS_KEY = "easysplits-install-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari uses navigator.standalone (non-standard)
  return Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  );
}

function getDismissedUntil(): number {
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

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [iosVariant, setIosVariant] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (Date.now() < getDismissedUntil()) return;

    const onBeforeInstall = (e: Event) => {
      const event = e as BeforeInstallPromptEvent;
      event.preventDefault();
      setDeferredPrompt(event);
      setShow(true);
    };

    const onInstalled = () => {
      setShow(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari never fires beforeinstallprompt — show instructional variant
    // after a short delay so we don't yell at first paint.
    if (isIOS() && !isStandalone()) {
      const t = window.setTimeout(() => {
        setIosVariant(true);
        setShow(true);
      }, 4000);
      return () => {
        window.removeEventListener("beforeinstallprompt", onBeforeInstall);
        window.removeEventListener("appinstalled", onInstalled);
        window.clearTimeout(t);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(
        DISMISS_KEY,
        String(Date.now() + DISMISS_DURATION_MS),
      );
    } catch {
      // ignore
    }
    setShow(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setShow(false);
      setDeferredPrompt(null);
    } else {
      dismiss();
    }
  };

  if (!show) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 sm:bottom-4"
      role="region"
      aria-label="Install EasySplits"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <BrandMark
          className="h-10 w-10 shrink-0"
          rounded="rounded-xl"
          fontSizeClass="text-xs"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight">
            Install EasySplits
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-400">
            {iosVariant
              ? "Tap Share, then “Add to Home Screen”"
              : "Adds to your home screen · works offline"}
          </p>
        </div>
        {iosVariant ? (
          <Share
            className="h-4 w-4 text-slate-500"
            aria-hidden
          />
        ) : (
          <button
            type="button"
            onClick={install}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Dismiss install prompt"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
