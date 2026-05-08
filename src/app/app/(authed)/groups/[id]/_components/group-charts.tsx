"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
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

const SLATE_HEX = "#64748b";
const HEXES = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#0ea5e9",
  "#8b5cf6",
  "#f43f5e",
  "#22c55e",
  "#a855f7",
  "#ef4444",
  "#06b6d4",
];

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

  // Pie: spend share by category.
  const byCategory = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const e of expenses) {
      const key = toCategoryKey(e.category ?? null);
      buckets.set(key, (buckets.get(key) ?? 0) + e.convertedAmount);
    }
    return Array.from(buckets.entries())
      .map(([key, total]) => ({
        key,
        label: CATEGORIES[toCategoryKey(key)].label,
        emoji: CATEGORIES[toCategoryKey(key)].emoji,
        hex: CATEGORIES[toCategoryKey(key)].hex,
        total: Math.round(total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  // Bar: total spent per day, last 14 days that have any expense.
  const byDay = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const e of expenses) {
      const key = new Date(e.occurredAt).toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + e.convertedAmount);
    }
    return Array.from(buckets.entries())
      .map(([key, total]) => ({
        key,
        label: new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
        }),
        total: Math.round(total * 100) / 100,
      }))
      .sort((a, b) => (a.key < b.key ? -1 : 1))
      .slice(-14);
  }, [expenses]);

  // Bar: total paid per member.
  const byPayer = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const e of expenses) {
      buckets.set(e.payerId, (buckets.get(e.payerId) ?? 0) + e.convertedAmount);
    }
    return Array.from(buckets.entries())
      .map(([userId, total], i) => ({
        userId,
        label: memberById.get(userId) ?? "?",
        total: Math.round(total * 100) / 100,
        hex: HEXES[i % HEXES.length],
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, memberById]);

  if (expenses.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No expenses yet — charts unlock once you add your first one.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">By category</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-[220px_1fr] sm:items-center">
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="total"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="90%"
                  paddingAngle={2}
                >
                  {byCategory.map((d) => (
                    <Cell key={d.key} fill={d.hex} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatINR(Number(value ?? 0), 0)}
                  contentStyle={{
                    background: "rgba(15,23,42,0.92)",
                    border: "none",
                    borderRadius: 8,
                    color: "white",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 text-xs">
            {byCategory.map((d) => (
              <li key={d.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: d.hex }}
                  />
                  {d.emoji} {d.label}
                </span>
                <span className="tabular-nums text-slate-500 dark:text-slate-400">
                  {formatINR(d.total, 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold tracking-tight">
          Daily spend (last 14 active days)
        </h3>
        <div className="mt-2 h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDay} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "currentColor" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "currentColor" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatINR(Number(v), 0)}
                width={60}
              />
              <Tooltip
                formatter={(value) => formatINR(Number(value ?? 0), 0)}
                contentStyle={{
                  background: "rgba(15,23,42,0.92)",
                  border: "none",
                  borderRadius: 8,
                  color: "white",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="total" fill={SLATE_HEX} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold tracking-tight">Paid by</h3>
        <div className="mt-2 h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={byPayer}
              layout="vertical"
              margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "currentColor" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatINR(Number(v), 0)}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11, fill: "currentColor" }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                formatter={(value) => formatINR(Number(value ?? 0), 0)}
                contentStyle={{
                  background: "rgba(15,23,42,0.92)",
                  border: "none",
                  borderRadius: 8,
                  color: "white",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {byPayer.map((d) => (
                  <Cell key={d.userId} fill={d.hex} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
