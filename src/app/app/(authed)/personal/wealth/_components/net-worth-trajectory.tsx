"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, LineChart as LineIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { formatINR } from "@/lib/format";
import { formatDate } from "@/lib/format-date";
import { useUserTimezone } from "@/lib/use-user-timezone";

/**
 * Net-worth trajectory — line chart of total net worth over time. Powered
 * by the personal_net_worth_snapshots table; one row per user per day.
 *
 * The chart is recharts-based and lazy-loaded so the bundle only ships
 * to users who actually open /wealth (it's a heavy import).
 */

type Snapshot = {
  snapshotDate: string;
  totalValue: number;
  liquidSavings: number;
  holdingsValue: number;
};

const tooltipStyle = {
  background: "rgba(15,23,42,0.96)",
  border: "none",
  borderRadius: 10,
  color: "white",
  fontSize: 12,
  padding: "8px 10px",
  boxShadow: "0 6px 20px -8px rgba(0,0,0,0.4)",
};

const RANGE_OPTIONS: Array<{ days: number; label: string }> = [
  { days: 30, label: "1M" },
  { days: 90, label: "3M" },
  { days: 180, label: "6M" },
  { days: 365, label: "1Y" },
];

const Chart = dynamic(() => import("./net-worth-chart-inner"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[160px] place-items-center text-[11px] text-slate-400">
      Loading chart…
    </div>
  ),
});

export function NetWorthTrajectory() {
  const userTz = useUserTimezone();
  const [days, setDays] = useState(90);
  const historyQuery = trpc.personal.holdings.netWorthHistory.useQuery(
    { days },
    { staleTime: 60_000 },
  );
  const data = useMemo<Snapshot[]>(
    () => historyQuery.data ?? [],
    [historyQuery.data],
  );

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const first = data[0];
    const last = data[data.length - 1];
    const change = last.totalValue - first.totalValue;
    const pct = first.totalValue > 0 ? change / first.totalValue : 0;
    const peak = data.reduce<Snapshot>(
      (best, cur) => (cur.totalValue > best.totalValue ? cur : best),
      first,
    );
    return { first, last, change, pct, peak };
  }, [data]);

  if (historyQuery.isLoading) return null;

  // Empty state — encourage a first edit so a snapshot lands.
  if (data.length === 0) return null;

  // Single-point state — show value + nudge instead of a flat line.
  if (data.length < 2) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <LineIcon className="h-4 w-4 text-emerald-500" aria-hidden />
          Trajectory
        </h2>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          One snapshot so far ({formatINR(data[0].totalValue, 0)} on{" "}
          {formatDate(`${data[0].snapshotDate}T00:00:00`, userTz, "short")}).
          Update a holding tomorrow to see the curve start to form.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <LineIcon className="h-4 w-4 text-emerald-500" aria-hidden />
            Trajectory
          </h2>
          {stats && (
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span
                className={`inline-flex items-center gap-0.5 font-semibold ${
                  stats.change >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {stats.change >= 0 ? (
                  <ArrowUp className="h-3 w-3" aria-hidden />
                ) : (
                  <ArrowDown className="h-3 w-3" aria-hidden />
                )}
                {stats.change >= 0 ? "+" : "−"}
                {formatINR(Math.abs(stats.change), 0)}
              </span>
              {" · "}
              {(stats.pct * 100).toFixed(1)}% over the last{" "}
              {RANGE_OPTIONS.find((r) => r.days === days)?.label.toLowerCase()}
              {" · "}
              peak {formatINR(stats.peak.totalValue, 0)}
            </p>
          )}
        </div>
        <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 p-0.5 dark:bg-slate-800">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                days === r.days
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              aria-pressed={days === r.days}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <Chart data={data} userTz={userTz} tooltipStyle={tooltipStyle} />
      </div>
    </section>
  );
}
