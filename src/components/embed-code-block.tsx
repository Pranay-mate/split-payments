"use client";

import { useState } from "react";
import { Check, Code2, Copy } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

/**
 * Embed-code generator for the user's Financial Health Scorecard.
 * Renders a copy-paste iframe snippet pointing at /embed/scorecard with
 * the user's current score + band + first-letter label baked into the
 * URL. PII-light by design: only an initial appears in the embed, never
 * the full name.
 *
 * Privacy note: this is opt-in by virtue of the user copy-pasting the
 * code. We don't store or expose anything until they actively share.
 */
export function EmbedCodeBlock() {
  const profileQuery = trpc.personal.profile.get.useQuery();
  const meQuery = trpc.profiles.me.useQuery();
  const [copied, setCopied] = useState(false);

  const score = profileQuery.data?.score?.total ?? null;
  const band = profileQuery.data?.score?.band ?? "emerald";
  const label =
    meQuery.data?.displayName?.slice(0, 24) ?? "Financial Health";

  if (
    profileQuery.isLoading ||
    !profileQuery.data?.score?.hasEnoughData ||
    score === null
  ) {
    return (
      <div className="text-[11px] text-slate-500 dark:text-slate-400">
        Complete your scorecard first to generate an embed code.
      </div>
    );
  }

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://split-payments-sigma.vercel.app";
  const url = `${origin}/embed/scorecard?score=${score}&band=${band}&label=${encodeURIComponent(label)}`;
  const code = `<iframe
  src="${url}"
  width="320"
  height="200"
  style="border:0;border-radius:16px"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
  title="Financial Health Score"
></iframe>`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — old browsers
    }
  };

  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
        <Code2 className="h-3.5 w-3.5" aria-hidden /> Embed your score
      </p>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        Paste this into a blog or portfolio. Only your initials + score
        appear — no PII. Updates only when you re-copy after a score change.
      </p>
      <pre className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-2 text-[10.5px] leading-snug dark:border-slate-700 dark:bg-slate-900/60">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={onCopy}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-600" aria-hidden />
        ) : (
          <Copy className="h-3 w-3" aria-hidden />
        )}
        {copied ? "Copied" : "Copy code"}
      </button>
    </div>
  );
}
