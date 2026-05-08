"use client";

import { CloudOff, RefreshCw, Loader2 } from "lucide-react";
import { useOffline } from "@/lib/offline/use-offline";

export function OfflineIndicator() {
  const { online, pendingCount, syncing, syncNow } = useOffline();

  // Hide entirely when fully synced + online.
  if (online && pendingCount === 0) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50/95 p-3 shadow-lg backdrop-blur dark:border-amber-800 dark:bg-amber-950/90 sm:bottom-4"
      role="status"
      aria-live="polite"
    >
      {!online ? (
        <CloudOff
          className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400"
          aria-hidden
        />
      ) : syncing ? (
        <Loader2
          className="h-5 w-5 shrink-0 animate-spin text-amber-700 dark:text-amber-400"
          aria-hidden
        />
      ) : (
        <RefreshCw
          className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400"
          aria-hidden
        />
      )}

      <div className="min-w-0 flex-1">
        {!online ? (
          <>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              You&apos;re offline
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {pendingCount > 0
                ? `${pendingCount} change${pendingCount === 1 ? "" : "s"} will sync when you reconnect.`
                : "New changes will sync when you reconnect."}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {syncing ? "Syncing…" : `${pendingCount} pending`}
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {syncing
                ? "Sending your changes to the server."
                : "Tap retry to sync now."}
            </p>
          </>
        )}
      </div>

      {online && !syncing && pendingCount > 0 && (
        <button
          type="button"
          onClick={() => void syncNow()}
          className="shrink-0 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800"
        >
          Retry
        </button>
      )}
    </div>
  );
}
