"use client";

import { useMemo } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CATEGORIES, toCategoryKey } from "@/lib/categories";
import { formatCurrency } from "@/lib/format";
import { useGroupCurrency } from "@/lib/group-currency-context";
import { formatDate } from "@/lib/format-date";
import { useUserTimezone } from "@/lib/use-user-timezone";

type ExpenseRow = {
  id: string;
  description: string;
  payerId: string;
  convertedAmount: number;
  occurredAt: Date | string;
  category?: string | null;
};

type Member = { id: string; name: string };

const PAYER_PALETTE = [
  ["#6366f1", "#818cf8"], // indigo
  ["#10b981", "#34d399"], // emerald
  ["#f59e0b", "#fbbf24"], // amber
  ["#0ea5e9", "#38bdf8"], // sky
  ["#8b5cf6", "#a78bfa"], // violet
  ["#f43f5e", "#fb7185"], // rose
  ["#22c55e", "#4ade80"], // green
  ["#a855f7", "#c084fc"], // purple
];

function dayKey(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

export function GroupCharts({
  expenses,
  members,
}: {
  expenses: ExpenseRow[];
  members: Member[];
}) {
  const userTz = useUserTimezone();
  const currency = useGroupCurrency();
  const memberById = useMemo(() => {
    const m = new Map<string, string>();
    for (const member of members) m.set(member.id, member.name);
    return m;
  }, [members]);

  const totals = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.convertedAmount, 0);
    const dayKeys = new Set(expenses.map((e) => dayKey(e.occurredAt)));
    const days = dayKeys.size;
    const dailyAvg = days > 0 ? total / days : 0;
    return {
      total: Math.round(total * 100) / 100,
      count: expenses.length,
      days,
      dailyAvg: Math.round(dailyAvg * 100) / 100,
    };
  }, [expenses]);

  // "Where the money goes" is a spend-direction story — including
  // category="income" or "investment" entries (reimbursements, etc.)
  // distorts the percentages and lists. Filter to actual spend
  // categories before bucketing. The Total spent KPI at the top is
  // untouched on purpose: it sums every transaction, which is the
  // right view for "what did this group transact".
  const spendExpenses = useMemo(
    () =>
      expenses.filter((e) => {
        const k = toCategoryKey(e.category ?? null);
        return k !== "income" && k !== "investment";
      }),
    [expenses],
  );

  const byCategory = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const e of spendExpenses) {
      const key = toCategoryKey(e.category ?? null);
      buckets.set(key, (buckets.get(key) ?? 0) + e.convertedAmount);
    }
    const entries = Array.from(buckets.entries())
      .map(([key, total]) => ({
        key,
        label: CATEGORIES[toCategoryKey(key)].label,
        emoji: CATEGORIES[toCategoryKey(key)].emoji,
        hex: CATEGORIES[toCategoryKey(key)].hex,
        total: Math.round(total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total);
    const sum = entries.reduce((s, e) => s + e.total, 0);
    return entries.map((e) => ({
      ...e,
      pct: sum > 0 ? e.total / sum : 0,
    }));
  }, [spendExpenses]);

  const topCategory = byCategory[0];

  // Top 5 biggest expenses — same spend-only filter so an "income"
  // tagged row doesn't show up in the "Biggest expenses" leaderboard.
  const topExpenses = useMemo(() => {
    return [...spendExpenses]
      .sort((a, b) => b.convertedAmount - a.convertedAmount)
      .slice(0, 5)
      .map((e) => {
        const cat = CATEGORIES[toCategoryKey(e.category ?? null)];
        return {
          id: e.id,
          description: e.description?.trim() || "Untitled expense",
          amount: Math.round(e.convertedAmount * 100) / 100,
          category: cat,
          payerName: memberById.get(e.payerId) ?? "Unknown",
          occurredAt: e.occurredAt,
          pct: totals.total > 0 ? e.convertedAmount / totals.total : 0,
        };
      });
  }, [expenses, memberById, totals.total]);

  const byPayer = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const e of expenses) {
      buckets.set(e.payerId, (buckets.get(e.payerId) ?? 0) + e.convertedAmount);
    }
    const total = totals.total;
    return Array.from(buckets.entries())
      .map(([userId, sum], i) => ({
        userId,
        label: memberById.get(userId) ?? "Unknown",
        total: Math.round(sum * 100) / 100,
        pct: total > 0 ? sum / total : 0,
        gradient: PAYER_PALETTE[i % PAYER_PALETTE.length],
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, memberById, totals.total]);

  if (expenses.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No expenses yet — charts unlock once you add your first one.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero KPIs — sets the headline before any chart */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-4 text-white shadow-sm sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
          Total spent
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
          {formatCurrency(totals.total, currency, 0)}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="min-w-0 rounded-lg bg-white/15 px-2 py-2 backdrop-blur sm:px-3">
            <p className="text-[10px] uppercase tracking-wider text-white/90">
              Expenses
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base">
              {totals.count}
            </p>
          </div>
          <div className="min-w-0 rounded-lg bg-white/15 px-2 py-2 backdrop-blur sm:px-3">
            <p className="text-[10px] uppercase tracking-wider text-white/90">
              Active days
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base">
              {totals.days}
            </p>
          </div>
          <div className="min-w-0 rounded-lg bg-white/15 px-2 py-2 backdrop-blur sm:px-3">
            <p className="text-[10px] uppercase tracking-wider text-white/90">
              Daily avg
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base">
              {formatCurrency(totals.dailyAvg, currency, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Category breakdown — donut with center label + horizontal bar list */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40 sm:p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold tracking-tight">
            Where the money goes
          </h3>
          {topCategory && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Top: {topCategory.emoji} {topCategory.label}
            </span>
          )}
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
          <div className="relative mx-auto h-[180px] w-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="total"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius="65%"
                  outerRadius="95%"
                  paddingAngle={3}
                  stroke="none"
                  isAnimationActive
                  animationBegin={50}
                  animationDuration={700}
                >
                  {byCategory.map((d) => (
                    <Cell key={d.key} fill={d.hex} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0), currency, 0)}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                />
              </PieChart>
            </ResponsiveContainer>
            {topCategory && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl" aria-hidden>
                  {topCategory.emoji}
                </span>
                <span className="mt-0.5 text-base font-bold tabular-nums">
                  {Math.round(topCategory.pct * 100)}%
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {topCategory.label}
                </span>
              </div>
            )}
          </div>
          <ul className="space-y-2 text-sm">
            {byCategory.map((d) => (
              <li key={d.key}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    <span className="text-base leading-none" aria-hidden>
                      {d.emoji}
                    </span>
                    <span className="truncate">{d.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">
                    {formatCurrency(d.total, currency, 0)}{" "}
                    <span className="text-[11px] text-slate-400">
                      · {Math.round(d.pct * 100)}%
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${d.pct * 100}%`, background: d.hex }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Biggest expenses — discrete leaderboard replacing the old
          daily-trend area chart. Expenses are discrete events, not a
          time series; the area chart implied continuity and gave a
          high-resolution view of a low-signal question. Top-5 by
          amount answers "where did the money really go" in one glance. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40 sm:p-5">
        <h3 className="text-sm font-semibold tracking-tight">
          Biggest expenses
        </h3>
        <ul className="mt-3 space-y-3">
          {topExpenses.map((e) => (
            <li key={e.id} className="space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {e.description}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span aria-hidden className="mr-1">{e.category.emoji}</span>
                    {e.category.label} · {e.payerName} paid ·{" "}
                    {formatDate(e.occurredAt, userTz, "short")}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatCurrency(e.amount, currency, 0)}
                </p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${e.pct * 100}%`, background: e.category.hex }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Who's paying — custom HTML list. Recharts is overkill here and
          per-row avatars + gradient bars look much better than a chart. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40 sm:p-5">
        <h3 className="text-sm font-semibold tracking-tight">Who&apos;s paying</h3>
        <ul className="mt-3 space-y-3">
          {byPayer.map((p, idx) => {
            const initial = p.label.slice(0, 1).toUpperCase();
            return (
              <li key={p.userId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${p.gradient[0]}, ${p.gradient[1]})`,
                      }}
                      aria-hidden
                    >
                      {initial}
                    </span>
                    <span className="truncate text-sm font-medium">
                      {p.label}
                      {idx === 0 && (
                        <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                          Top
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-slate-700 dark:text-slate-200">
                    {formatCurrency(p.total, currency, 0)}{" "}
                    <span className="text-[11px] text-slate-400">
                      · {Math.round(p.pct * 100)}%
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${p.pct * 100}%`,
                      background: `linear-gradient(90deg, ${p.gradient[0]}, ${p.gradient[1]})`,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "rgba(15,23,42,0.95)",
  border: "none",
  borderRadius: 10,
  color: "white",
  fontSize: 12,
  padding: "8px 10px",
  boxShadow: "0 6px 20px -8px rgba(0,0,0,0.4)",
};
