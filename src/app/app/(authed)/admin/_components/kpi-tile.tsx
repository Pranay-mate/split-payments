"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

/**
 * Compact KPI tile with optional inline SVG sparkline + week-over-week
 * delta chip. Avoids recharts here — the sparkline is 60×24px and
 * recharts' minimum chunk would be 50× bigger than the SVG path we draw.
 */
export function KpiTile({
  label,
  value,
  delta,
  sparkline,
  tooltip,
  loading,
}: {
  label: string;
  value: number | string | undefined;
  delta?: number;
  sparkline?: number[];
  tooltip?: string;
  loading?: boolean;
}) {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      title={tooltip}
    >
      <p className="truncate text-[10.5px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
          {loading ? (
            <span className="inline-block h-6 w-12 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          ) : value === undefined || value === null ? (
            "—"
          ) : (
            value
          )}
        </span>
        {typeof delta === "number" && delta !== 0 && !loading && (
          <DeltaChip delta={delta} />
        )}
      </div>
      {sparkline && sparkline.length > 1 && !loading && (
        <Sparkline data={sparkline} />
      )}
    </div>
  );
}

function DeltaChip({ delta }: { delta: number }) {
  const positive = delta > 0;
  const sign = positive ? "+" : "";
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
        positive
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
          : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
      }`}
    >
      {positive ? (
        <TrendingUp className="h-3 w-3" aria-hidden />
      ) : (
        <TrendingDown className="h-3 w-3" aria-hidden />
      )}
      {sign}
      {delta}
    </span>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const w = 100;
  const h = 24;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(1, max - min);
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-2 h-6 w-full text-indigo-500 dark:text-indigo-400"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
