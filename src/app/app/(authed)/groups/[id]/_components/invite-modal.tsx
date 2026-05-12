"use client";

import { useState } from "react";
import { Copy, QrCode, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

/**
 * Group invite modal. Renders a scannable QR plus the copy-link
 * fallback in one place — mobile-to-mobile invites become a 2-tap
 * flow (open modal → friend scans) instead of "copy link → switch
 * apps → paste link → send → friend taps."
 *
 * QR is generated client-side with qrcode.react (~7 KB MIT, no
 * service). Encodes the existing /app/join/<token> URL the link
 * already uses — no schema or routing change.
 */
export function InviteModal({
  groupName,
  inviteToken,
  open,
  onClose,
}: {
  groupName: string;
  inviteToken: string;
  open: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  // Build the absolute URL at render time so SSR doesn't try (window
  // isn't available there). The modal only renders when `open` flips
  // true on a client interaction, so window is guaranteed to exist.
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/app/join/${inviteToken}`
      : `/app/join/${inviteToken}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Invite link copied");
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      toast.error("Could not copy. Long-press the QR to save instead.");
    }
  };

  const share = async () => {
    if (typeof navigator.share !== "function") {
      void copy();
      return;
    }
    try {
      await navigator.share({
        title: `Join "${groupName}" on EasySplits`,
        text: `You're invited to "${groupName}" — split expenses without the drama.`,
        url,
      });
    } catch (err) {
      // User cancelled the system share sheet — no-op.
      if ((err as DOMException)?.name === "AbortError") return;
      void copy();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Invite to ${groupName}`}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Close invite"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="px-5 pb-2 pt-5 sm:px-6">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <QrCode className="h-3.5 w-3.5" aria-hidden /> Invite to
          </p>
          <h2 className="mt-0.5 truncate text-lg font-semibold tracking-tight">
            {groupName}
          </h2>
        </div>

        <div className="px-5 py-4 sm:px-6">
          <div className="mx-auto w-fit rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-white">
            {/* QR keeps a white background even in dark mode — most
                camera apps need solid contrast to read reliably. */}
            <QRCodeSVG
              value={url}
              size={224}
              level="M"
              marginSize={1}
              bgColor="#ffffff"
              fgColor="#0f172a"
              aria-label={`QR code to join ${groupName}`}
            />
          </div>
          <p className="mt-3 text-center text-[11.5px] text-slate-500 dark:text-slate-400">
            Open your friend&apos;s camera and point it at this QR. They&apos;ll
            tap to join.
          </p>
        </div>

        <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800 sm:px-6">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-600 dark:text-slate-300">
              {url}
            </span>
            <button
              type="button"
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <Copy className="h-3 w-3" aria-hidden />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            onClick={share}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-600 hover:to-emerald-600"
          >
            <Share2 className="h-4 w-4" aria-hidden /> Share via…
          </button>
        </div>
      </div>
    </div>
  );
}
