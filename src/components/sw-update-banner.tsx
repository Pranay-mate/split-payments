"use client";

import { useState } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { useSwUpdate } from "@/lib/use-sw-update";

/**
 * "A new version is ready" banner — fires when the service worker has
 * downloaded a fresh build but the page is still running the old one.
 * One-click Reload triggers SKIP_WAITING + a page reload so the user
 * gets the new code immediately without losing offline-queue state.
 *
 * Sits at the top of the viewport (not bottom) so it doesn't fight
 * the install-prompt banner for real estate. Auto-dismiss isn't
 * useful here — users only see this when there's something for them
 * to do, and dismissing is just deferring; they'll see it again next
 * session.
 */
export function SwUpdateBanner() {
  const { updateAvailable, applyUpdate } = useSwUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-2 z-40 flex justify-center px-3 sm:top-3"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-violet-50 to-emerald-50 p-3 shadow-md backdrop-blur dark:border-indigo-800 dark:from-indigo-950/60 dark:via-violet-950/60 dark:to-emerald-950/60">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 text-white shadow-sm"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            A new version is ready
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-slate-300">
            Reload to get the latest features and fixes.
          </p>
        </div>
        <button
          type="button"
          onClick={applyUpdate}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Reload
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Dismiss update notice"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
