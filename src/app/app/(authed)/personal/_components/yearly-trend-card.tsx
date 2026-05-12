"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, LineChart } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { formatINR } from "@/lib/format";

/**
 * Year-over-year + multi-month trend view. Lazy-loads the recharts
 * inner so the bundle only ships when this card is rendered on the
 * personal page. Range pills let users switch between 6 / 12 / 24
 * month windows; YoY chip at the top only appears when the series
 * is long enough (≥13 months) to pair latest month with prior-year
 * same-month.
 */

const RANGE_OPTIONS = [
  { months: 6, label: "6M" },
  { months: 13, label: "1Y" },
  { months: 25, label: "2Y" },
] as const;

const Chart = dynamic(() => import("./yearly-trend-chart-inner"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[200px] place-items-center text-[11px] text-slate-400">
      Loading chart…
    </div>
  ),
});

export function YearlyTrendCard() {
  const [months, setMonths] = useState<6 | 13 | 25>(13);
  const query = trpc.personal.yearlyTrend.useQuery(
    { months },
    { staleTime: 60_000 },
  );
  const data = useMemo(() => query.data ?? null, [query.data]);

  if (query.isLoading) return null;
  if (!data || data.series.every((s) => s.entryCount === 0)) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <LineChart className="h-4 w-4 text-indigo-500" aria-hidden />
            Trend
          </h2>
          {data.yoy && data.yoy.expensesDeltaPct !== null ? (
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span
                className={`inline-flex items-center gap-0.5 font-semibold ${
                  data.yoy.expensesDeltaPct >= 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {data.yoy.expensesDeltaPct >= 0 ? (
                  <ArrowUp className="h-3 w-3" aria-hidden />
                ) : (
                  <ArrowDown className="h-3 w-3" aria-hidden />
                )}
                {(data.yoy.expensesDeltaPct * 100).toFixed(0)}%
              </span>{" "}
              spending vs {data.yoy.priorYearMonth.monthLabel}
              {" · "}
              savings rate{" "}
              <span
                className={
                  data.yoy.savingsRateDelta >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }
              >
                {data.yoy.savingsRateDelta >= 0 ? "+" : ""}
                {(data.yoy.savingsRateDelta * 100).toFixed(1)} pts
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Income vs expenses vs investments per month.
            </p>
          )}
        </div>
        <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 p-0.5 dark:bg-slate-800">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.months}
              type="button"
              onClick={() => setMonths(r.months as 6 | 13 | 25)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                months === r.months
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              aria-pressed={months === r.months}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-2 pb-3 pt-2 sm:px-4">
        <Chart series={data.series} />
      </div>

      {/* Annual roll-up — only for the 1Y / 2Y windows where it's meaningful. */}
      {months >= 13 && <AnnualRollup series={data.series} />}
    </section>
  );
}

function AnnualRollup({
  series,
}: {
  series: Array<{
    income: number;
    expenses: number;
    investments: number;
    savingsRate: number;
  }>;
}) {
  const totals = series.reduce(
    (acc, m) => {
      acc.income += m.income;
      acc.expenses += m.expenses;
      acc.investments += m.investments;
      return acc;
    },
    { income: 0, expenses: 0, investments: 0 },
  );
  const net = totals.income - totals.expenses - totals.investments;
  const avgSavingsRate = totals.income > 0 ? net / totals.income : 0;

  return (
    <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:grid-cols-4 sm:px-5">
      <Stat label="Total income" value={formatINR(totals.income, 0)} tone="emerald" />
      <Stat label="Total spent" value={formatINR(totals.expenses, 0)} tone="rose" />
      <Stat
        label="Invested"
        value={formatINR(totals.investments, 0)}
        tone="cyan"
      />
      <Stat
        label="Avg savings rate"
        value={`${Math.round(avgSavingsRate * 100)}%`}
        tone={avgSavingsRate >= 0.2 ? "emerald" : "amber"}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "rose" | "cyan" | "amber";
}) {
  const TONES: Record<typeof tone, string> = {
    emerald: "text-emerald-700 dark:text-emerald-400",
    rose: "text-rose-700 dark:text-rose-400",
    cyan: "text-cyan-700 dark:text-cyan-400",
    amber: "text-amber-700 dark:text-amber-400",
  };
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${TONES[tone]}`}>
        {value}
      </p>
    </div>
  );
}
