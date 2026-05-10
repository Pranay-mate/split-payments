"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, Globe, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

/**
 * Wealth-share opt-in panel. Slots into the profile editor.
 *
 * Privacy ladder (each step requires explicit user action):
 *   1. Sharing OFF (default) — no public page exists.
 *   2. Toggle ON → server generates a 64-hex token, /wealth/[token]
 *      starts working. Page shows ratios + type breakdown only.
 *   3. (Optional) "Show amounts" sub-toggle → public page also reveals
 *      total + per-type rupee values. Default OFF.
 *   4. Rotate token → invalidates the old URL.
 *
 * The token + show-amounts state come from the trpc.profiles.me query
 * which the EditProfileModal already runs.
 */
export function WealthShareBlock() {
  const utils = trpc.useUtils();
  const meQuery = trpc.profiles.me.useQuery();
  const me = meQuery.data;
  const [copied, setCopied] = useState(false);

  const enableMutation = trpc.profiles.enableWealthShare.useMutation({
    onSuccess: () => {
      utils.profiles.me.invalidate();
      toast.success("Wealth share enabled");
    },
    onError: (err) => toast.error(err.message),
  });
  const disableMutation = trpc.profiles.disableWealthShare.useMutation({
    onSuccess: () => {
      utils.profiles.me.invalidate();
      toast.success("Wealth share disabled");
    },
    onError: (err) => toast.error(err.message),
  });
  const rotateMutation = trpc.profiles.rotateWealthShareToken.useMutation({
    onSuccess: () => {
      utils.profiles.me.invalidate();
      toast.success("New share URL issued — old one no longer works");
    },
    onError: (err) => toast.error(err.message),
  });
  const showAmountsMutation =
    trpc.profiles.setWealthShareShowAmounts.useMutation({
      onSuccess: () => utils.profiles.me.invalidate(),
      onError: (err) => toast.error(err.message),
    });

  const token = (me as { wealthShareToken?: string | null } | undefined)
    ?.wealthShareToken;
  const showAmounts =
    (me as { wealthShareShowAmounts?: boolean } | undefined)
      ?.wealthShareShowAmounts ?? false;
  const isEnabled = !!token;

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://split-payments-sigma.vercel.app";
  const url = token ? `${origin}/wealth/${token}` : "";

  const onCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the URL manually");
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Globe className="h-3.5 w-3.5" aria-hidden /> Share my wealth page
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Generates a public URL with your portfolio mix (no PII beyond your
            name). Default: ratios only — amounts stay hidden until you opt in
            below.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (isEnabled) {
              if (confirm("Disable wealth sharing? Your share URL will stop working.")) {
                disableMutation.mutate();
              }
            } else {
              enableMutation.mutate();
            }
          }}
          disabled={enableMutation.isPending || disableMutation.isPending}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium transition disabled:opacity-60 ${
            isEnabled
              ? "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
              : "bg-emerald-600 text-white hover:bg-emerald-500"
          }`}
        >
          {isEnabled ? "Disable" : "Enable"}
        </button>
      </div>

      {isEnabled && (
        <div className="mt-3 space-y-3">
          {/* URL + copy */}
          <div>
            <p className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
              Public URL
            </p>
            <div className="mt-1 flex items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 truncate rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-[10.5px] dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-600" aria-hidden />
                ) : (
                  <Copy className="h-3 w-3" aria-hidden />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Show-amounts sub-toggle */}
          <button
            type="button"
            onClick={() =>
              showAmountsMutation.mutate({ show: !showAmounts })
            }
            disabled={showAmountsMutation.isPending}
            className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-900"
          >
            <span className="flex items-center gap-1.5">
              {showAmounts ? (
                <Eye className="h-3 w-3 text-emerald-600" aria-hidden />
              ) : (
                <EyeOff className="h-3 w-3 text-slate-400" aria-hidden />
              )}
              <span className="font-medium">
                {showAmounts ? "Showing amounts" : "Hiding amounts"}
              </span>
              <span className="text-slate-400">
                — {showAmounts ? "rupee values visible" : "ratios only"}
              </span>
            </span>
            <span
              className={`inline-block h-4 w-7 rounded-full transition ${
                showAmounts ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`block h-3 w-3 translate-y-0.5 rounded-full bg-white transition ${
                  showAmounts ? "translate-x-3.5" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>

          {/* Rotate token */}
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  "Issue a new share URL? The old one stops working immediately.",
                )
              ) {
                rotateMutation.mutate();
              }
            }}
            disabled={rotateMutation.isPending}
            className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <RefreshCcw className="h-3 w-3" aria-hidden />
            Rotate URL (revoke old link)
          </button>
        </div>
      )}
    </div>
  );
}
