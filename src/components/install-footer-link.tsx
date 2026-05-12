"use client";

import { useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useInstallPrompt } from "@/lib/use-install-prompt";

/**
 * Quiet "Install the app" link for marketing-site footers. Always
 * available (no first-action gate, no dismiss cooldown), but rendered
 * as a discreet text link so it doesn't compete with primary CTAs.
 *
 * - Chromium with `beforeinstallprompt` captured → triggers native dialog
 * - iOS → opens a small modal with the manual Share-sheet instructions
 * - Already-installed → renders nothing
 */
export function InstallFooterLink() {
  const { canInstall, installed, platform, triggerNativePrompt } =
    useInstallPrompt();
  const [iosModal, setIosModal] = useState(false);
  const isIOS = platform === "ios";

  if (installed) return null;
  if (!canInstall && !isIOS) return null; // no install path available

  const onClick = async () => {
    if (isIOS) {
      setIosModal(true);
      return;
    }
    await triggerNativePrompt();
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        Install the app
      </button>

      {iosModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Install on iOS"
          onClick={() => setIosModal(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIosModal(false)}
              className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Share className="h-4 w-4 text-indigo-500" aria-hidden /> Install
              on iOS
            </h3>
            <ol className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <li className="flex gap-2">
                <span className="font-semibold text-indigo-500">1.</span>
                <span>
                  Tap the <strong>Share</strong> button at the bottom of
                  Safari.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-indigo-500">2.</span>
                <span>
                  Scroll down and tap{" "}
                  <strong>Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-indigo-500">3.</span>
                <span>
                  Tap <strong>Add</strong> in the top-right corner.
                </span>
              </li>
            </ol>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              EasySplits will open like a real app — full screen, works
              offline.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
