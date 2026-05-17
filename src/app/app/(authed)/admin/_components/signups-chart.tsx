"use client";

import {
  ResponsiveContainer,
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * 90-day signups area + 7-day rolling avg line overlay.
 * Lazy-loaded by the parent — recharts is ~50KB gzipped, not worth pulling
 * into the main app bundle.
 */
export function SignupsChart({
  data,
  loading,
}: {
  data: { day: string; count: number; rolling7: number }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="h-[260px] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
    );
  }
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
        No signups yet. Once users start arriving they&apos;ll show up here.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="signupsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(148,163,184,0.18)" vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(v: string) => v.slice(5)}
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(15,23,42,0.92)",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
            color: "white",
          }}
          labelFormatter={(v) => v}
        />
        <Area
          type="monotone"
          dataKey="count"
          name="Signups"
          stroke="#6366f1"
          strokeWidth={1.5}
          fill="url(#signupsFill)"
        />
        <Line
          type="monotone"
          dataKey="rolling7"
          name="7-day avg"
          stroke="#10b981"
          strokeWidth={1.5}
          dot={false}
          strokeDasharray="4 3"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
