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
 * Visual goal: high info density without being a wall of numbers. Each
 * row collapses to a single-line "scheme name · rate · tenure" by
 * default; tapping expands to show eligibility / cap / tax notes.
 */
export function SmallSavingsPanel() {
  const sorted = useMemo(
    () => [...SMALL_SAVINGS_SCHEMES].sort((a, b) => b.ratePct - a.ratePct),
    [],
  );
  const topRate = sorted[0]?.ratePct ?? 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            <Landmark className="h-4 w-4 text-indigo-500" aria-hidden />
            Small Savings rates
          </h2>
          <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
            Post Office &amp; Govt of India schemes · current quarter
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold tabular-nums text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          Up to {topRate.toFixed(1)}%
        </span>
      </header>

      <ul className="mt-4 space-y-2">
        {sorted.map((s) => (
          <SchemeRow key={s.key} scheme={s} topRate={topRate} />
        ))}
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
    </section>
  );
}

function SchemeRow({
  scheme,
  topRate,
}: {
  scheme: SmallSavingsScheme;
  topRate: number;
}) {
  const [open, setOpen] = useState(false);
  // Bar width relative to the top rate in the list. Gives a visual
  // anchor even though rates are bunched between 4% and 8.2%.
  const widthPct = topRate > 0 ? (scheme.ratePct / topRate) * 100 : 0;
  const taxLabel = scheme.taxBenefit ?? "Taxable";
  const taxClass =
    scheme.taxBenefit === "EEE"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : scheme.taxBenefit === "80C"
      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";

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
              {scheme.shortName ?? scheme.name}
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
          <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {scheme.tenure}
            {scheme.forWhom ? ` · ${scheme.forWhom}` : ""}
          </p>
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
          <p className="font-medium text-slate-800 dark:text-slate-200">
            {scheme.name}
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
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
            {scheme.lockInYears !== undefined && (
              <Detail
                icon={<Lock className="h-3 w-3" aria-hidden />}
                label="Lock-in"
                value={`${scheme.lockInYears} yr`}
              />
            )}
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
                  ? "Principal under section 80C"
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
