"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Info, Landmark, Lock, Percent } from "lucide-react";
import {
  SMALL_SAVINGS_LAST_UPDATED_DATE,
  SMALL_SAVINGS_LAST_UPDATED_QUARTER,
  SMALL_SAVINGS_SCHEMES,
  SMALL_SAVINGS_SOURCE_URL,
  type SmallSavingsScheme,
} from "@/lib/small-savings-rates";

/**
 * Reference panel on /wealth showing current Post Office / small-savings
 * scheme rates. Pure read-only — informational, no mutations, no API
 * calls. Data updated quarterly via PR (see src/lib/small-savings-rates).
 *
 * Filter chips at the top map to real user journeys ("park ₹50k for 2
 * years" → Short ≤3y; "tax-saving instrument" → 80C; "retiree income"
 * → Senior). Without them this is a wall of 12 rows; with them most
 * users see 2-5 relevant schemes.
 */
type FilterKey =
  | "all"
  | "tax-free"
  | "80c"
  | "short"
  | "senior"
  | "children";

const FILTERS: { key: FilterKey; label: string; match: (s: SmallSavingsScheme) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "tax-free", label: "Tax-free", match: (s) => s.taxBenefit === "EEE" },
  { key: "80c", label: "80C", match: (s) => s.taxBenefit === "80C" || s.taxBenefit === "EEE" },
  { key: "short", label: "Short ≤3y", match: (s) => (s.lockInYears ?? 0) <= 3 },
  { key: "senior", label: "Senior", match: (s) => /senior|60\+/i.test(s.forWhom ?? "") },
  { key: "children", label: "Children", match: (s) => /girl|child/i.test(s.forWhom ?? "") },
];

export function SmallSavingsPanel() {
  // Collapsed by default — this is reference info, not a primary user
  // task. A 12-row table eating /wealth real estate when most visits
  // don't care about it is bad signal-to-noise. Tap the header to
  // unfold; filter state survives across collapse/expand cycles.
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  const sorted = useMemo(
    () => [...SMALL_SAVINGS_SCHEMES].sort((a, b) => b.ratePct - a.ratePct),
    [],
  );
  const filterFn = FILTERS.find((f) => f.key === filter)?.match ?? (() => true);
  const visible = sorted.filter(filterFn);
  // Top rate within the CURRENT filter so the visualisation bars
  // re-normalise per filter (otherwise filtering to Short ≤3y shows
  // every bar at <80% which feels broken).
  const topRate = visible[0]?.ratePct ?? sorted[0]?.ratePct ?? 0;
  // Pre-count each filter for the chip badges so users see the
  // distribution at a glance and don't get an empty list on tap.
  const counts = useMemo(() => {
    const m: Record<FilterKey, number> = {
      all: sorted.length,
      "tax-free": 0,
      "80c": 0,
      short: 0,
      senior: 0,
      children: 0,
    };
    for (const f of FILTERS) {
      if (f.key === "all") continue;
      m[f.key] = sorted.filter(f.match).length;
    }
    return m;
  }, [sorted]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="small-savings-body"
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            <Landmark className="h-4 w-4 text-indigo-500" aria-hidden />
            Small Savings rates
          </h2>
          <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
            {sorted.length} Post Office &amp; Govt schemes · tap to{" "}
            {expanded ? "collapse" : "view"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold tabular-nums text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            Up to {sorted[0]?.ratePct.toFixed(1) ?? "—"}%
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </div>
      </button>

      {!expanded ? null : (
      <div id="small-savings-body">

      {/* Filter chips — horizontally scrollable on mobile so we don't
          force a 2-row wrap. Active chip uses indigo to match the brand
          accent; inactive stays neutral so they read as filters not CTAs. */}
      <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = counts[f.key];
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition ${
                active
                  ? "bg-indigo-500 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {f.label}
              <span
                className={`ml-1 tabular-nums ${
                  active ? "text-white/80" : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <ul className="mt-3 space-y-2">
        {visible.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-[12px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            No schemes match this filter.
          </li>
        ) : (
          visible.map((s) => (
            <SchemeRow key={s.key} scheme={s} topRate={topRate} />
          ))
        )}
      </ul>

      <footer className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span>
          Last updated{" "}
          <strong className="font-semibold text-slate-700 dark:text-slate-300">
            {SMALL_SAVINGS_LAST_UPDATED_QUARTER}
          </strong>{" "}
          ({SMALL_SAVINGS_LAST_UPDATED_DATE})
        </span>
        <a
          href={SMALL_SAVINGS_SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 font-medium text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400"
        >
          Verify on indiapost.gov.in →
        </a>
      </footer>
      </div>
      )}
    </section>
  );
}

function taxBadgeClass(taxBenefit: SmallSavingsScheme["taxBenefit"]): string {
  if (taxBenefit === "EEE")
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (taxBenefit === "80C")
    return "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300";
  return "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
}

function taxBadgeLabel(taxBenefit: SmallSavingsScheme["taxBenefit"]): string {
  if (taxBenefit === "EEE") return "EEE";
  if (taxBenefit === "80C") return "80C";
  return "Taxable";
}

function SchemeRow({
  scheme,
  topRate,
}: {
  scheme: SmallSavingsScheme;
  topRate: number;
}) {
  const [open, setOpen] = useState(false);
  // Bar width relative to the top rate in the visible list. Gives a
  // visual anchor even when rates bunch between 4% and 8.2%.
  const widthPct = topRate > 0 ? (scheme.ratePct / topRate) * 100 : 0;
  const taxClass = taxBadgeClass(scheme.taxBenefit);
  const taxLabel = taxBadgeLabel(scheme.taxBenefit);

  return (
    <li className="rounded-xl border border-slate-100 bg-slate-50/40 transition hover:border-slate-200 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <span aria-hidden className="text-lg leading-none">
          {scheme.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
              {scheme.name}
            </p>
            <p className="shrink-0 text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {scheme.ratePct.toFixed(1)}%
            </p>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-[width] duration-700"
              style={{ width: `${widthPct}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span
              className={`rounded-md px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider ${taxClass}`}
            >
              {taxLabel}
            </span>
            {scheme.lockInYears !== undefined && (
              <span className="inline-flex items-center gap-0.5">
                <Lock className="h-2.5 w-2.5" aria-hidden />
                {scheme.lockInYears}y lock
              </span>
            )}
            <span className="truncate">
              {scheme.forWhom ?? scheme.tenure}
            </span>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-100 px-3 py-3 text-[12px] text-slate-600 dark:border-slate-800 dark:text-slate-300">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Full name
          </p>
          <p className="font-medium text-slate-800 dark:text-slate-200">
            {scheme.name}
            {scheme.shortName ? ` (${scheme.shortName})` : ""}
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1">
            <Detail
              icon={<Percent className="h-3 w-3" aria-hidden />}
              label="Min"
              value={scheme.minInvestment}
            />
            {scheme.maxInvestment && (
              <Detail
                icon={<Percent className="h-3 w-3" aria-hidden />}
                label="Max"
                value={scheme.maxInvestment}
              />
            )}
            <Detail
              icon={<Lock className="h-3 w-3" aria-hidden />}
              label="Tenure"
              value={scheme.tenure}
            />
            <Detail
              icon={
                <span
                  aria-hidden
                  className={`inline-block rounded px-1 text-[9px] font-semibold ${taxClass}`}
                >
                  {taxLabel}
                </span>
              }
              label="Tax"
              value={
                scheme.taxBenefit === "EEE"
                  ? "Tax-free at all stages"
                  : scheme.taxBenefit === "80C"
                  ? "Principal under 80C"
                  : "Interest fully taxable"
              }
            />
          </dl>
          {scheme.notes && (
            <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-[11.5px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              {scheme.notes}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400 dark:text-slate-500">{icon}</span>
      <dt className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className="ml-auto text-right font-medium text-slate-700 dark:text-slate-200">
        {value}
      </dd>
    </div>
  );
}
