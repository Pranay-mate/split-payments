"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  CloudDownload,
  Download,
  LogOut,
  Pencil,
  Send,
  Share,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useInstallPrompt } from "@/lib/use-install-prompt";
import { EditProfileModal } from "./edit-profile-modal";
import { ExportDataModal } from "./export-data-modal";

export function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [iosInstallModal, setIosInstallModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const meQuery = trpc.profiles.me.useQuery(undefined, { staleTime: 60_000 });
  const { setTheme } = useTheme();
  const install = useInstallPrompt();

  // Show the menu item if the PWA isn't installed AND there's a real
  // path to install (Chromium with deferredPrompt captured, OR iOS
  // Safari where we surface manual instructions). Once installed, the
  // item silently disappears.
  const showInstallItem =
    !install.installed && (install.canInstall || install.platform === "ios");

  const onInstall = async () => {
    setOpen(false);
    if (install.platform === "ios") {
      setIosInstallModal(true);
      return;
    }
    await install.triggerNativePrompt();
  };

  // Sync the user's saved theme preference into next-themes ONCE per
  // session, on first profile load. We deliberately do NOT re-sync on
  // every meQuery refetch — that was overriding live theme previews
  // selected in the EditProfileModal, because every refetch made this
  // effect re-fire with the (stale) server value.
  const themeSyncedRef = useRef(false);
  const savedTheme = (meQuery.data as { theme?: string } | undefined)?.theme;
  useEffect(() => {
    if (themeSyncedRef.current) return;
    if (savedTheme && ["system", "light", "dark"].includes(savedTheme)) {
      setTheme(savedTheme);
      themeSyncedRef.current = true;
    }
  }, [savedTheme, setTheme]);

  // While the profile query is in flight, show an empty placeholder
  // (lets the gradient circle stand in) rather than flashing "?".
  // After load, fall back to the first letter of the display name.
  const initial = meQuery.data?.displayName
    ? meQuery.data.displayName.slice(0, 1).toUpperCase()
    : "";
  const supabase = createSupabaseBrowserClient();

  // First name only (no surname) for the personalized share URL — keeps
  // the link tasteful + slightly more private than full display name.
  const firstName = (meQuery.data?.displayName ?? "")
    .trim()
    .split(/\s+/)[0]
    ?.slice(0, 24)
    ?? "";

  const onShareApp = async () => {
    setOpen(false);
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://easy-split-payments.vercel.app";
    const url = firstName
      ? `${base}/?from=${encodeURIComponent(firstName)}`
      : base + "/";
    const title = "EasySplits — split bills + track your money";
    const text = firstName
      ? `${firstName} thought you'd like this — a free, India-first app for splitting bills with friends and tracking your own money. Encrypted, no ads, works offline.`
      : "A free, India-first app for splitting bills + tracking your money. Encrypted, no ads, works offline.";
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
        // Fall through to clipboard on other errors.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied — paste it anywhere");
    } catch {
      toast.error("Couldn't copy. Try again.");
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed out");
    router.push("/app/login");
    router.refresh();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 text-sm font-semibold text-white transition hover:shadow-md"
      >
        {meQuery.data?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meQuery.data.avatarUrl}
            alt=""
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          initial
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 top-11 z-40 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
              <p className="truncate text-sm font-medium">
                {meQuery.data?.displayName ?? "…"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/app/groups");
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Users className="h-4 w-4" aria-hidden /> Groups
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/app/personal");
              }}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <Wallet className="h-4 w-4" aria-hidden /> Personal finance
            </button>
            {(meQuery.data as { isAdmin?: boolean } | undefined)?.isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/app/admin");
                }}
                className="flex w-full items-center gap-2 border-t border-slate-100 bg-indigo-50/40 px-3 py-2 text-left text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 dark:border-slate-800 dark:bg-indigo-950/20 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden /> Admin
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setEditing(true);
              }}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <Pencil className="h-4 w-4" aria-hidden /> Edit profile
            </button>
            {showInstallItem && (
              <button
                type="button"
                onClick={onInstall}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <Download className="h-4 w-4" aria-hidden /> Install app
              </button>
            )}
            <button
              type="button"
              onClick={onShareApp}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <Send className="h-4 w-4" aria-hidden /> Share with friends
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setExporting(true);
              }}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <CloudDownload className="h-4 w-4" aria-hidden /> Download my data
            </button>
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        </>
      )}

      <EditProfileModal open={editing} onClose={() => setEditing(false)} />
      <ExportDataModal open={exporting} onClose={() => setExporting(false)} />

      {iosInstallModal && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Install on iOS"
          onClick={() => setIosInstallModal(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIosInstallModal(false)}
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
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
