"use client";

import { ArrowRight } from "lucide-react";
import type { TripSummary } from "@/lib/calculators/trip-split";
import { formatINR } from "@/lib/format";

export function BalancesView({
  summary,
  memberById,
}: {
  summary: TripSummary;
  memberById: Map<string, { id: string; name: string }>;
}) {
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
            Simplified payments
          </h2>
          <ul className="mt-3 space-y-2">
            {summary.settlements.map((s, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="font-medium">
                    {memberById.get(s.fromPersonId)?.name ?? "?"}
                  </span>
                  <ArrowRight
                    className="h-4 w-4 text-slate-400"
                    aria-hidden
                  />
                  <span className="font-medium">
                    {memberById.get(s.toPersonId)?.name ?? "?"}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
                  {formatINR(s.amount, 0)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {summary.settlements.length} transfer
            {summary.settlements.length === 1 ? "" : "s"} settles everyone — minimum needed.
          </p>
        </section>
      )}
    </div>
  );
}
