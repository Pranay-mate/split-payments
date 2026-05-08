"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle, ArrowRight, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

export function ClaimClient({ token }: { token: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const previewQuery = trpc.claim.preview.useQuery({ token }, { retry: false });
  const consumeMutation = trpc.claim.consume.useMutation({
    onSuccess: ({ groupId }) => {
      utils.groups.list.invalidate();
      utils.groups.members.invalidate({ groupId });
      utils.expenses.listByGroup.invalidate({ groupId });
      utils.settlements.listByGroup.invalidate({ groupId });
      toast.success("Claimed — history merged into your account");
      router.replace(`/app/groups/${groupId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const isLoading = previewQuery.isLoading;
  const error = previewQuery.error ?? consumeMutation.error;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <>
            <Loader2
              className="mx-auto h-6 w-6 animate-spin text-slate-400"
              aria-hidden
            />
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              Checking link…
            </p>
          </>
        ) : error ? (
          <>
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
              <AlertCircle className="h-5 w-5" aria-hidden />
            </div>
            <h1 className="mt-4 text-lg font-semibold tracking-tight">
              Couldn&apos;t claim
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              {error.message}
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
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <UserCheck className="h-5 w-5" aria-hidden />
            </div>
            <h1 className="mt-4 text-lg font-semibold tracking-tight">
              Claim {previewQuery.data?.guestName}&apos;s history
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              All of <strong>{previewQuery.data?.guestName}</strong>&apos;s
              expenses, splits and settlements in this group will move to your
              account. This can&apos;t be undone.
            </p>
            <button
              type="button"
              onClick={() => consumeMutation.mutate({ token })}
              disabled={consumeMutation.isPending}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
            >
              {consumeMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <UserCheck className="h-3.5 w-3.5" aria-hidden />
              )}
              Claim
            </button>
            <Link
              href="/app/groups"
              className="mt-3 block text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Not me — go back
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
