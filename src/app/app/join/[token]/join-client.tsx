"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

export function JoinClient({ token }: { token: string }) {
  const router = useRouter();
  const ranRef = useRef(false);
  const joinMutation = trpc.groups.joinByToken.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    joinMutation.mutate(
      { token },
      {
        onSuccess: (group) => {
          utils.groups.list.invalidate();
          toast.success(`Joined "${group.name}"`);
          router.replace(`/app/groups/${group.id}`);
        },
        onError: (err) => toast.error(err.message),
      },
    );
    // run-once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {joinMutation.isError ? (
          <>
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
              <AlertCircle className="h-5 w-5" aria-hidden />
            </div>
            <h1 className="mt-4 text-lg font-semibold tracking-tight">
              Couldn&apos;t join
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              {joinMutation.error.message}
            </p>
            <Link
              href="/app/groups"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Back to your groups
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </>
        ) : (
          <>
            <Loader2
              className="mx-auto h-6 w-6 animate-spin text-slate-400"
              aria-hidden
            />
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              Joining the group…
            </p>
          </>
        )}
      </div>
    </main>
  );
}
