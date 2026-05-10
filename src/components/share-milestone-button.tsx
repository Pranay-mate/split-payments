"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Share button for milestone OG cards. Uses Web Share API where
 * available (mobile native share sheet); falls back to clipboard.
 *
 * The `imagePath` is the OG endpoint path with query params already
 * encoded — caller composes it. We construct the absolute URL on click
 * (location.origin only available client-side).
 *
 * Title + text are what appears in the share dialog (subject lines,
 * etc.). The image itself is fetched from the OG URL by the social
 * platform when it scrapes Open Graph tags — but for direct sharing
 * we just share the link to a public app page that serves the OG meta.
 */
export function ShareMilestoneButton({
  shareUrl,
  title,
  text,
  className = "",
  label = "Share",
}: {
  /** Path or absolute URL of the page that has og:image meta pointing
   *  at the right /api/og/milestone?type=… endpoint. */
  shareUrl: string;
  title: string;
  text: string;
  className?: string;
  label?: string;
}) {
  const onShare = async () => {
    const absUrl = shareUrl.startsWith("http")
      ? shareUrl
      : `${window.location.origin}${shareUrl}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url: absUrl });
        return;
      } catch (err) {
        // AbortError fires when user cancels — silent.
        if ((err as DOMException)?.name === "AbortError") return;
        // Other errors fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(absUrl);
      toast.success("Link copied — share it anywhere");
    } catch {
      toast.error("Couldn't share. Try copying the URL manually.");
    }
  };

  return (
    <button
      type="button"
      onClick={onShare}
      className={
        className ||
        "inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      }
    >
      <Share2 className="h-3 w-3" aria-hidden />
      {label}
    </button>
  );
}
