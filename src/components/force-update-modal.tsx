"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useSwUpdate } from "@/lib/use-sw-update";

/**
 * Blocking force-update modal — fires only when the waiting SW reports
 * a higher major version than the current bundle (e.g. 1.x → 2.0).
 *
 * Reserved for genuinely critical updates: schema migrations the old
 * client can't handle, security fixes, broken core flows. Force-fatigue
 * is real, so the bar should be "site is genuinely broken on stale
 * code" — not "shiny new feature shipped."
 *
 * UX rules:
 *   - No dismiss, no escape, no click-outside. The whole point is to
 *     block until reload.
 *   - 30-second auto-reload countdown so an idle user with the modal
 *     open eventually gets unblocked without action.
 *   - z-[100] so it sits above every other modal, banner, sheet.
 */
const AUTO_RELOAD_SECONDS = 30;

export function ForceUpdateModal() {
  const { forceUpdate, applyUpdate } = useSwUpdate();
  const [secondsLeft, setSecondsLeft] = useState(AUTO_RELOAD_SECONDS);

  useEffect(() => {
    // Countdown only starts once the SW signals a force update. Once
    // forceUpdate flips true it doesn't flip back (we reload before
    // that can happen), so a one-shot interval is enough — no reset.
    if (!forceUpdate) return;
    const handle = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(handle);
          applyUpdate();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(handle);
  }, [forceUpdate, applyUpdate]);

  if (!forceUpdate) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="force-update-title"
      aria-describedby="force-update-body"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl dark:border-amber-900/50 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-rose-50 px-5 py-4 dark:border-slate-800 dark:from-amber-950/30 dark:to-rose-950/30">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          >
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </span>
          <h2
            id="force-update-title"
            className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50"
          >
            Update required
          </h2>
        </div>

        <div id="force-update-body" className="px-5 py-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            A critical update is ready. Reload to continue using EasySplits.
          </p>
          <p className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">
            Any unsaved changes on this screen will be lost.
          </p>
        </div>

        <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={applyUpdate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
            autoFocus
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Reload now
            <span className="text-rose-100">({secondsLeft}s)</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
