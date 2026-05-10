"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Pencil, Users, Wallet } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { EditProfileModal } from "./edit-profile-modal";

export function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const meQuery = trpc.profiles.me.useQuery(undefined, { staleTime: 60_000 });
  const { setTheme } = useTheme();

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
              <Wallet className="h-4 w-4" aria-hidden /> Personal
            </button>
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
    </div>
  );
}
