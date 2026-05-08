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

/**
 * Settlement progress ring + headline. Ring is the headline KPI: at a
 * glance you see how close the group is to "fully settled". Math:
 *
 *   settled    = sum of recorded settlements (in primary currency)
 *   remaining  = sum of remaining positive balances (the amount still
 *                owed across the group)
 *   progress   = settled / (settled + remaining)
 *
 * remaining is the positive sum specifically because positives ≡ |negatives|
 * after summariseTrip closes the books — counting both would double-count.
 *
 * Hides itself for the no-expenses case (totalToSettle === 0) so we don't
 * flash a misleading 100% on an empty group.
 */
function BalancesHeader({
  summary,
  recorded,
}: {
  summary: TripSummary;
  recorded: RecordedSettlement[];
}) {
  const settled = recorded.reduce((s, r) => s + r.amount, 0);
  const remaining = summary.balances.reduce(
    (s, b) => s + Math.max(0, b.amount),
    0,
  );
  const totalToSettle = settled + remaining;
  const progress = totalToSettle > 0 ? settled / totalToSettle : null;
  const pct = progress === null ? 0 : Math.round(progress * 100);

  if (progress === null) {
    return (
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Balances
      </h2>
    );
  }

  const size = 56;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - (progress ?? 0));
  const ringColor = pct >= 100 ? "#10b981" : "#6366f1";

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative shrink-0 text-slate-200 dark:text-slate-700"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeDasharray={C}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-[11px] font-bold tabular-nums">
          {pct}%
        </span>
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Balances
        </h2>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
          {pct >= 100
            ? "All settled — nice."
            : settled === 0
              ? `${formatINR(remaining, 0)} to settle across the group`
              : `${formatINR(settled, 0)} settled · ${formatINR(remaining, 0)} to go`}
        </p>
      </div>
    </div>
  );
}

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
        <BalancesHeader summary={summary} recorded={recorded} />
        <ul className="mt-4 space-y-3">
          {(() => {
            const maxAbs = Math.max(
              0.01,
              ...summary.balances.map((b) => Math.abs(b.amount)),
            );
            return summary.balances.map((b) => {
              const isOwed = b.amount > 0.01;
              const owes = b.amount < -0.01;
              const abs = Math.abs(b.amount);
              const pct = (abs / maxAbs) * 100;
              return (
                <li key={b.personId} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">
                      {memberById.get(b.personId)?.name ?? "?"}
                    </span>
                    <span
                      className={`tabular-nums text-xs font-semibold ${
                        isOwed
                          ? "text-emerald-700 dark:text-emerald-400"
                          : owes
                            ? "text-rose-700 dark:text-rose-400"
                            : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {isOwed
                        ? `+${formatINR(abs, 0)} · gets`
                        : owes
                          ? `−${formatINR(abs, 0)} · owes`
                          : "settled"}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    {(isOwed || owes) && (
                      <div
                        className={`h-full rounded-full transition-[width] duration-700 ${
                          isOwed
                            ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
                            : "bg-gradient-to-r from-rose-400 to-rose-600"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    )}
                  </div>
                </li>
              );
            });
          })()}
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
