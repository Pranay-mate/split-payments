"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const meQuery = trpc.profiles.me.useQuery(undefined, { staleTime: 60_000 });

  const initial = (meQuery.data?.displayName ?? "?").slice(0, 1).toUpperCase();
  const supabase = createSupabaseBrowserClient();

  const deleteMutation = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Account deleted");
      router.push("/");
      router.refresh();
    },
    onError: (err) => toast.error(err.message),
  });

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

  const deleteAccount = () => {
    if (
      !confirm(
        "Delete your account? You'll lose access to all your groups. Your historical expenses will remain visible to other members but anonymised. This cannot be undone.",
      )
    ) {
      return;
    }
    deleteMutation.mutate();
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
              <User className="h-4 w-4" aria-hidden /> Your groups
            </button>
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                deleteAccount();
              }}
              disabled={deleteMutation.isPending}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 dark:border-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Delete account
            </button>
          </div>
        </>
      )}
    </div>
  );
}
