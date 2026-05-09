"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc/client";

type Snapshot = {
  id: string;
  total: number;
  band: "red" | "amber" | "emerald" | "green";
  snapshottedAt: Date | string;
};

const tooltipStyle = {
  background: "rgba(15,23,42,0.95)",
  border: "none",
  borderRadius: 10,
  color: "white",
  fontSize: 12,
  padding: "8px 10px",
  boxShadow: "0 6px 20px -8px rgba(0,0,0,0.4)",
};

function monthKey(d: Date | string): string {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function shortDateLabel(d: Date | string): string {
  return new Date(d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function timeLabel(d: Date | string): string {
  return new Date(d).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * If multiple snapshots share the same calendar day, dedupe the x-axis
 * by appending HH:mm — otherwise recharts shows "9 May" 7 times in a
 * row, which conveys nothing. When dates already differ across the
 * series, leave the simple "DD MMM" labels.
 */
function buildLabels(history: Array<{ snapshottedAt: Date | string }>): string[] {
  const dates = history.map((s) => shortDateLabel(s.snapshottedAt));
  const unique = new Set(dates);
  if (unique.size === dates.length) return dates;
  return history.map((s) => `${shortDateLabel(s.snapshottedAt)} ${timeLabel(s.snapshottedAt)}`);
}

export type ScoreSummary = {
  current: number | null;
  delta: number | null;
  /** Calendar months in a row ending in green band (counting back). */
  streakMonths: number;
  history: Snapshot[];
};

/**
 * Pure-function summary of a snapshot list. Exported separately so the
 * scorecard hero can show the delta + streak text without re-pulling the
 * full chart data.
 */
export function summariseSnapshots(history: Snapshot[]): ScoreSummary {
  if (history.length === 0) {
    return { current: null, delta: null, streakMonths: 0, history };
  }
  const latest = history[history.length - 1];
  const previous = history.length >= 2 ? history[history.length - 2] : null;
  const delta = previous ? latest.total - previous.total : null;

  // Streak: walk backwards through months. Pick the most recent snapshot
  // for each calendar month (ignoring earlier snapshots in the same
  // month). Count consecutive months ending in green.
  const byMonth = new Map<string, Snapshot>();
  for (const s of history) {
    byMonth.set(monthKey(s.snapshottedAt), s); // overwrites earlier in same month
  }
  const months = Array.from(byMonth.entries()).sort(([a], [b]) =>
    a < b ? -1 : 1,
  );
  let streakMonths = 0;
  for (let i = months.length - 1; i >= 0; i--) {
    if (months[i][1].band === "green") streakMonths++;
    else break;
  }
  return { current: latest.total, delta, streakMonths, history };
}

export function ScoreTrajectory() {
  const q = trpc.personal.profile.history.useQuery({ limit: 24 });
  const history = useMemo(() => q.data ?? [], [q.data]);

  const chartData = useMemo(() => {
    const labels = buildLabels(history);
    return history.map((s, i) => ({ label: labels[i], total: s.total }));
  }, [history]);

  if (q.isLoading) return null;
  if (history.length < 2) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Update your score next month and a trajectory chart will appear
        here. One snapshot so far.
      </p>
    );
  }

  const min = Math.max(0, Math.min(...history.map((s) => s.total)) - 10);
  const max = Math.min(100, Math.max(...history.map((s) => s.total)) + 10);

  return (
    <div className="h-[140px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 5, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="trajectoryFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
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
            domain={[min, max]}
            width={32}
          />
          <ReferenceLine
            y={80}
            stroke="#10b981"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
            label={{
              value: "green band",
              position: "right",
              fontSize: 10,
              fill: "#10b981",
            }}
          />
          <Tooltip
            formatter={(value) => `${value} / 100`}
            contentStyle={tooltipStyle}
            cursor={{ stroke: "#10b981", strokeOpacity: 0.4, strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#trajectoryFill)"
            isAnimationActive
            animationDuration={700}
            dot={{
              r: 3,
              fill: "#10b981",
              stroke: "white",
              strokeWidth: 1.5,
            }}
            activeDot={{
              r: 5,
              fill: "#10b981",
              stroke: "white",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
