"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc/client";
import { CATEGORIES, toCategoryKey } from "@/lib/categories";
import { formatINR } from "@/lib/format";

const tooltipStyle = {
  background: "rgba(15,23,42,0.95)",
  border: "none",
  borderRadius: 10,
  color: "white",
  fontSize: 12,
  padding: "8px 10px",
  boxShadow: "0 6px 20px -8px rgba(0,0,0,0.4)",
};

const COLORS = {
  income: "#16a34a",
  expense: "#f43f5e",
  investment: "#06b6d4",
};

export function PersonalCharts({ month }: { month: string }) {
  const summaryQuery = trpc.personal.summary.useQuery({ month });
  const trendQuery = trpc.personal.monthlyTrend.useQuery({ months: 6 });
  const listQuery = trpc.personal.list.useQuery({ month, type: "expense" });

  const byCategory = useMemo(() => {
    const list = listQuery.data ?? [];
    const buckets = new Map<string, number>();
    for (const e of list) {
      buckets.set(e.category, (buckets.get(e.category) ?? 0) + e.amount);
    }
    const entries = Array.from(buckets.entries())
      .map(([key, total]) => {
        const meta = CATEGORIES[toCategoryKey(key)];
        return {
          key,
          label: meta.label,
          emoji: meta.emoji,
          hex: meta.hex,
          total: Math.round(total * 100) / 100,
        };
      })
      .filter((e) => e.total > 0)
      .sort((a, b) => b.total - a.total);
    const sum = entries.reduce((s, e) => s + e.total, 0);
    return entries.map((e) => ({ ...e, pct: sum > 0 ? e.total / sum : 0 }));
  }, [listQuery.data]);

  const top = byCategory[0];
  const summary = summaryQuery.data;
  const trend = trendQuery.data ?? [];

  const breakdownData = summary
    ? [
        { name: "Income", value: summary.income, fill: COLORS.income },
        { name: "Expense", value: summary.expenses, fill: COLORS.expense },
        {
          name: "Investment",
          value: summary.investments,
          fill: COLORS.investment,
        },
      ].filter((d) => d.value > 0)
    : [];

  const hasNoData =
    byCategory.length === 0 &&
    breakdownData.length === 0 &&
    !trend.some((t) => t.income + t.expenses + t.investments > 0);

  if (hasNoData) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Add a few entries and charts will fill in.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* In · Out · Invest mini bar — single row, no recharts needed */}
      {summary && (
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            This month at a glance
          </h3>
          {(() => {
            const max = Math.max(
              summary.income,
              summary.expenses,
              summary.investments,
              1,
            );
            const rows = [
              {
                label: "Income",
                value: summary.income,
                hex: COLORS.income,
                emoji: "💰",
              },
              {
                label: "Expense",
                value: summary.expenses,
                hex: COLORS.expense,
                emoji: "💸",
              },
              {
                label: "Investment",
                value: summary.investments,
                hex: COLORS.investment,
                emoji: "📈",
              },
            ];
            return (
              <ul className="mt-2 space-y-2.5 text-sm">
                {rows.map((r) => (
                  <li key={r.label} className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden>{r.emoji}</span>
                        {r.label}
                      </span>
                      <span className="tabular-nums text-slate-700 dark:text-slate-200">
                        {formatINR(r.value, 0)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{
                          width: `${(r.value / max) * 100}%`,
                          background: r.hex,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>
      )}

      {/* Spend by category — donut */}
      {byCategory.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40 sm:p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold tracking-tight">
              Where the money went
            </h3>
            {top && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Top: {top.emoji} {top.label}
              </span>
            )}
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
            <div className="relative mx-auto h-[180px] w-[180px]">
              {/* Explicit pixel dims sidestep the parent-measure race
                  that produced width(-1) height(-1) warnings. */}
              <ResponsiveContainer width={180} height={180}>
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
                    formatter={(value) => formatINR(Number(value ?? 0), 0)}
                    contentStyle={tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
              {top && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl" aria-hidden>
                    {top.emoji}
                  </span>
                  <span className="mt-0.5 text-base font-bold tabular-nums">
                    {Math.round(top.pct * 100)}%
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {top.label}
                  </span>
                </div>
              )}
            </div>
            <ul className="space-y-2 text-sm">
              {byCategory.map((d) => (
                <li key={d.key}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      <span aria-hidden className="text-base leading-none">
                        {d.emoji}
                      </span>
                      <span className="truncate">{d.label}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">
                      {formatINR(d.total, 0)}
                      <span className="ml-1 text-[11px] text-slate-400">
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
      )}

      {/* 6-month trend — grouped bars */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40 sm:p-5">
        <h3 className="text-sm font-semibold tracking-tight">
          Last 6 months
        </h3>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          Income (green) · Expense (rose) · Investment (cyan).
        </p>
        <div className="mt-3 h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={trend}
              margin={{ top: 5, right: 5, bottom: 0, left: 0 }}
            >
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 10, fill: "currentColor" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "currentColor" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatINR(Number(v), 0)}
                width={56}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatINR(Number(value ?? 0), 0),
                  name,
                ]}
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
              />
              <Bar
                dataKey="income"
                fill={COLORS.income}
                radius={[3, 3, 0, 0]}
                isAnimationActive
                animationDuration={700}
              />
              <Bar
                dataKey="expenses"
                fill={COLORS.expense}
                radius={[3, 3, 0, 0]}
                isAnimationActive
                animationDuration={700}
              />
              <Bar
                dataKey="investments"
                fill={COLORS.investment}
                radius={[3, 3, 0, 0]}
                isAnimationActive
                animationDuration={700}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
