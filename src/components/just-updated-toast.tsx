"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { JUST_AUTO_UPDATED_KEY } from "@/lib/use-sw-update";

/**
 * One-time confirmation toast after a silent auto-update. The hook in
 * `use-sw-update` writes a localStorage flag right before reloading; we
 * read + clear it on first mount of the next session and show a small
 * "Updated" toast. Keeps the silent-update flow transparent without
 * being interruptive.
 */
export function JustUpdatedToast() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let flagged = false;
    try {
      flagged = window.localStorage.getItem(JUST_AUTO_UPDATED_KEY) === "1";
      if (flagged) window.localStorage.removeItem(JUST_AUTO_UPDATED_KEY);
    } catch {
      // Storage disabled — nothing to do.
    }
    if (!flagged) return;
    // Fire after a tick so Sonner is mounted and visible.
    const handle = window.setTimeout(() => {
      toast.success("Updated to the latest version", {
        icon: <Sparkles className="h-4 w-4 text-emerald-500" />,
        duration: 4_000,
      });
    }, 600);
    return () => window.clearTimeout(handle);
  }, []);

  return null;
}
