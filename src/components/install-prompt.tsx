"use client";

import { useState } from "react";
import { Download, X, Share } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { useInstallPrompt } from "@/lib/use-install-prompt";

/**
 * In-app install nag — only fires after the user has done something
 * meaningful (added an expense, completed the scorecard). Hides
 * permanently if the PWA is already installed; hides for 7 days after
 * dismissal. Marketing-site visitors see the quieter footer link
 * instead, never this banner.
 */

export function InstallPrompt() {
  const {
    canInstall,
    installed,
    platform,
    firstActionDone,
    inCooldown,
    triggerNativePrompt,
    dismiss,
  } = useInstallPrompt();
  const [pending, setPending] = useState(false);

  const isIOS = platform === "ios";

  // The visibility ladder, top-priority first:
  //   1. Installed → never show.
  //   2. Cooldown active → never show.
  //   3. User hasn't done a meaningful action → never show (no nag for newcomers).
  //   4. Android / Chrome with deferredPrompt captured → show install banner.
  //   5. iOS Safari → show share-sheet instructions banner.
  const shouldShow =
    !installed &&
    !inCooldown &&
    firstActionDone &&
    (canInstall || isIOS);

  if (!shouldShow) return null;

  const onInstall = async () => {
    setPending(true);
    try {
      const outcome = await triggerNativePrompt();
      if (outcome === "dismissed") dismiss();
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 sm:bottom-4"
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
            {isIOS
              ? "Tap Share, then “Add to Home Screen”"
              : "Adds to home screen · works offline"}
          </p>
        </div>
        {isIOS ? (
          <Share className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        ) : (
          <button
            type="button"
            onClick={onInstall}
            disabled={pending || !canInstall}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
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
