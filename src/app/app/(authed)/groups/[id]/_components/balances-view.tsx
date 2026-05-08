"use client";

import { ArrowRight, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import type { TripSummary } from "@/lib/calculators/trip-split";
import { formatINR } from "@/lib/format";
import { useMutationWithQueue } from "@/lib/offline/use-mutation-with-queue";

type RecordedSettlement = {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  note: string | null;
  occurredAt: Date;
};

export function BalancesView({
  groupId,
  summary,
  memberById,
  recorded,
}: {
  groupId: string;
  summary: TripSummary;
  memberById: Map<string, { id: string; name: string }>;
  recorded: RecordedSettlement[];
}) {
  const utils = trpc.useUtils();
  const recordMutation = trpc.settlements.create.useMutation({
    onSuccess: () => {
      utils.settlements.listByGroup.invalidate({ groupId });
    },
  });
  const deleteMutation = trpc.settlements.delete.useMutation({
    onSuccess: () => {
      utils.settlements.listByGroup.invalidate({ groupId });
    },
  });
  const submitRecord = useMutationWithQueue(
    "settlements.create",
    recordMutation,
    {
      onQueued: (rawInput, clientEventId) => {
        const i = rawInput as {
          groupId: string;
          fromUserId: string;
          toUserId: string;
          amount: number;
          note?: string;
        };
        utils.settlements.listByGroup.setData({ groupId: i.groupId }, (old) => {
          if (!old) return old;
          const optimistic = {
            id: clientEventId,
            groupId: i.groupId,
            fromUserId: i.fromUserId,
            toUserId: i.toUserId,
            amount: i.amount,
            note: i.note ?? "",
            occurredAt: new Date(),
            createdAt: new Date(),
            _pending: true,
          } as unknown as (typeof old)[number];
          return [optimistic, ...old];
        });
      },
    },
  );
  const submitDelete = useMutationWithQueue(
    "settlements.delete",
    deleteMutation,
    {
      onQueued: (rawInput) => {
        const i = rawInput as { id: string };
        utils.settlements.listByGroup.setData({ groupId }, (old) =>
          old ? old.filter((s) => s.id !== i.id) : old,
        );
      },
    },
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Balances
        </h2>
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {summary.balances.map((b) => {
            const isOwed = b.amount > 0.01;
            const owes = b.amount < -0.01;
            return (
              <li
                key={b.personId}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="font-medium">
                  {memberById.get(b.personId)?.name ?? "?"}
                </span>
                <span
                  className={`tabular-nums ${
                    isOwed
                      ? "text-emerald-600 dark:text-emerald-400"
                      : owes
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {isOwed
                    ? `gets ${formatINR(b.amount, 0)}`
                    : owes
                    ? `owes ${formatINR(-b.amount, 0)}`
                    : "settled"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {summary.settlements.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-emerald-50 p-5 dark:border-slate-800 dark:from-indigo-950/40 dark:to-emerald-950/40">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Suggested payments
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Minimum number of transfers to settle the group.
          </p>
          <ul className="mt-4 space-y-2">
            {summary.settlements.map((s, idx) => {
              const fromName = memberById.get(s.fromPersonId)?.name ?? "?";
              const toName = memberById.get(s.toPersonId)?.name ?? "?";
              return (
                <li
                  key={`${s.fromPersonId}-${s.toPersonId}-${idx}`}
                  className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 truncate">
                      <span className="font-medium">{fromName}</span>
                      <ArrowRight
                        className="h-4 w-4 text-slate-400"
                        aria-hidden
                      />
                      <span className="font-medium">{toName}</span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatINR(s.amount, 0)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { queued } = await submitRecord({
                          groupId,
                          fromUserId: s.fromPersonId,
                          toUserId: s.toPersonId,
                          amount: s.amount,
                        });
                        if (!queued) toast.success("Settlement recorded");
                      } catch (err) {
                        toast.error(
                          err instanceof Error ? err.message : "Failed",
                        );
                      }
                    }}
                    disabled={recordMutation.isPending}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
                  >
                    {recordMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Mark as paid
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {recorded.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Settlement history
          </h2>
          <ul className="mt-3 space-y-2">
            {recorded.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-medium">
                      {memberById.get(r.fromUserId)?.name ?? "?"}
                    </span>
                    <ArrowRight
                      className="h-4 w-4 text-slate-400"
                      aria-hidden
                    />
                    <span className="font-medium">
                      {memberById.get(r.toUserId)?.name ?? "?"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {formatINR(r.amount, 0)}
                    {r.note ? ` · ${r.note}` : ""} ·{" "}
                    {new Date(r.occurredAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm("Undo this settlement?")) return;
                    try {
                      const { queued } = await submitDelete({ id: r.id });
                      if (!queued) toast.success("Settlement removed");
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Failed",
                      );
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  aria-label="Undo settlement"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
