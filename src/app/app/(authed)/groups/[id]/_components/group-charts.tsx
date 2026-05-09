"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CATEGORIES, toCategoryKey } from "@/lib/categories";
import { formatINR } from "@/lib/format";

type ExpenseRow = {
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

function dayLabel(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function fullDayLabel(key: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function GroupCharts({
  expenses,
  members,
}: {
  expenses: ExpenseRow[];
  members: Member[];
}) {
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

  const byCategory = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const e of expenses) {
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
  }, [expenses]);

  const topCategory = byCategory[0];

  const byDay = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const e of expenses) {
      const key = dayKey(e.occurredAt);
      buckets.set(key, (buckets.get(key) ?? 0) + e.convertedAmount);
    }
    const series = Array.from(buckets.entries())
      .map(([key, total]) => ({
        key,
        label: dayLabel(key),
        full: fullDayLabel(key),
        total: Math.round(total * 100) / 100,
      }))
      .sort((a, b) => (a.key < b.key ? -1 : 1))
      .slice(-14);
    const peak = series.reduce<(typeof series)[number] | null>(
      (best, cur) => (best === null || cur.total > best.total ? cur : best),
      null,
    );
    return { series, peak };
  }, [expenses]);

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
      <div className="rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-5 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
          Total spent
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
          {formatINR(totals.total, 0)}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="min-w-0 rounded-lg bg-white/15 px-2 py-2 backdrop-blur sm:px-3">
            <p className="text-[10px] uppercase tracking-wider text-white/70">
              Expenses
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base">
              {totals.count}
            </p>
          </div>
          <div className="min-w-0 rounded-lg bg-white/15 px-2 py-2 backdrop-blur sm:px-3">
            <p className="text-[10px] uppercase tracking-wider text-white/70">
              Active days
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base">
              {totals.days}
            </p>
          </div>
          <div className="min-w-0 rounded-lg bg-white/15 px-2 py-2 backdrop-blur sm:px-3">
            <p className="text-[10px] uppercase tracking-wider text-white/70">
              Daily avg
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base">
              {formatINR(totals.dailyAvg, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Category breakdown — donut with center label + horizontal bar list */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/40">
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
                  formatter={(value) => formatINR(Number(value ?? 0), 0)}
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
                    {formatINR(d.total, 0)}{" "}
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

      {/* Daily trend — area chart with gradient + peak callout */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold tracking-tight">
            Daily spend
          </h3>
          {byDay.peak && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Peak: {byDay.peak.full} ·{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {formatINR(byDay.peak.total, 0)}
              </span>
            </span>
          )}
        </div>
        <div className="mt-3 h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={byDay.series}
              margin={{ top: 5, right: 5, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="dailyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "currentColor" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "currentColor" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatINR(Number(v), 0)}
                width={48}
              />
              <Tooltip
                formatter={(value) => formatINR(Number(value ?? 0), 0)}
                labelFormatter={(label, payload) => {
                  const p = payload?.[0]?.payload as
                    | { full?: string }
                    | undefined;
                  return p?.full ?? String(label);
                }}
                contentStyle={tooltipStyle}
                cursor={{ stroke: "#6366f1", strokeOpacity: 0.4, strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#dailyFill)"
                isAnimationActive
                animationDuration={700}
                dot={{ r: 3, fill: "#6366f1", stroke: "white", strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: "#6366f1", stroke: "white", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Who's paying — custom HTML list. Recharts is overkill here and
          per-row avatars + gradient bars look much better than a chart. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/40">
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
                    {formatINR(p.total, 0)}{" "}
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
