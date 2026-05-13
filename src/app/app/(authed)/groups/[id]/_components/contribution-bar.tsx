"use client";

import { useMemo } from "react";
import { formatINR } from "@/lib/format";

const PALETTE = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#0ea5e9", // sky
  "#8b5cf6", // violet
  "#f43f5e", // rose
  "#22c55e", // green
  "#a855f7", // purple
  "#ef4444", // red
  "#06b6d4", // cyan
];

type Expense = { payerId: string; convertedAmount: number };
type Member = { id: string; name: string };

/**
 * A stacked horizontal bar showing what share of the group's total spend
 * each payer is carrying. Sits at the top of the group page so the
 * who's-bankrolling-this-trip picture is visible at a glance — without
 * scrolling to the Charts panel.
 *
 * Returns null when there's nothing to chart so the caller can render
 * unconditionally.
 */
export function ContributionBar({
  expenses,
  members,
}: {
  expenses: Expense[];
  members: Member[];
}) {
  /**
   * Beyond ~6 colored segments the stacked bar turns into visual mush
   * (and the legend below wraps to 3+ lines). Cap to the top 6 named
   * contributors and lump the rest into one neutral "Others" segment.
   */
  const TOP_N = 6;
  const segments = useMemo(() => {
    const totals = new Map<string, number>();
    let sum = 0;
    for (const e of expenses) {
      totals.set(e.payerId, (totals.get(e.payerId) ?? 0) + e.convertedAmount);
      sum += e.convertedAmount;
    }
    if (sum <= 0) return null;
    const ranked = members
      .map((m) => ({
        id: m.id,
        name: m.name,
        total: Math.round((totals.get(m.id) ?? 0) * 100) / 100,
      }))
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total);
    const named = ranked.slice(0, TOP_N).map((s, i) => ({
      ...s,
      pct: s.total / sum,
      color: PALETTE[i % PALETTE.length],
    }));
    if (ranked.length <= TOP_N) return named;
    const rest = ranked.slice(TOP_N);
    const restTotal = rest.reduce((acc, x) => acc + x.total, 0);
    return [
      ...named,
      {
        id: "__others__",
        name: `Others (${rest.length})`,
        total: Math.round(restTotal * 100) / 100,
        pct: restTotal / sum,
        color: "#94a3b8", // slate-400 — intentionally neutral so it
                          // doesn't compete with the named segments.
      },
    ];
  }, [expenses, members]);

  if (!segments || segments.length === 0) return null;

  const total = segments.reduce((s, x) => s + x.total, 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Who paid
        </h2>
        <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {formatINR(total, 0)} total
        </span>
      </div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {segments.map((s) => (
          <div
            key={s.id}
            className="transition-[width] duration-700"
            style={{ width: `${s.pct * 100}%`, background: s.color }}
            title={`${s.name}: ${formatINR(s.total, 0)} (${Math.round(s.pct * 100)}%)`}
            aria-label={`${s.name} ${Math.round(s.pct * 100)} percent`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs">
        {segments.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: s.color }}
            />
            <span className="font-medium">{s.name}</span>
            <span className="text-slate-500 dark:text-slate-400">
              · {Math.round(s.pct * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
