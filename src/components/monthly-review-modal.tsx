"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { formatINR } from "@/lib/format";
import { CATEGORIES, toCategoryKey } from "@/lib/categories";
import { ShareMilestoneButton } from "@/components/share-milestone-button";

/**
 * End-of-month wrap-up modal. Auto-shows the *first* time the user
 * lands on /app/personal in a new calendar month, summarising the
 * previous month's spend / categories / score moves and offering a
 * one-tap share to drive organic acquisition.
 *
 * Dedupe via localStorage by month-key, so it only appears once per
 * month per user — even if they reload mid-session.
 */

const STORAGE_KEY = "easysplits.monthly-review.last-seen";

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonthKey(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function readSeen(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistSeen(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Storage disabled — modal will re-trigger next visit, no harm.
  }
}

export function MonthlyReviewModal() {
  const [shouldFetch, setShouldFetch] = useState(false);
  const [open, setOpen] = useState(false);

  // Decide on mount whether this user should see the modal *at all*.
  // We avoid running the tRPC query unless we'd actually open it, so
  // the dashboard hot-path doesn't pay for the aggregation.
  useEffect(() => {
    const seen = readSeen();
    // Only show if we haven't shown anything for this month boundary yet.
    // `seen` stores the *current* month at last-show time; if seen ===
    // currentMonth, we already greeted them this month.
    if (seen === currentMonthKey()) return;
    queueMicrotask(() => setShouldFetch(true));
  }, []);

  const reviewQuery = trpc.personal.monthlyReview.useQuery(
    { month: previousMonthKey() },
    { enabled: shouldFetch, staleTime: 60_000 },
  );

  // When data arrives, decide to actually open. If the previous month
  // had < 5 entries, silently mark seen so we don't pop an empty modal.
  useEffect(() => {
    if (!shouldFetch || !reviewQuery.data) return;
    if (!reviewQuery.data.hasEnoughData) {
      persistSeen(currentMonthKey());
      return;
    }
    queueMicrotask(() => setOpen(true));
  }, [shouldFetch, reviewQuery.data]);

  const dismiss = () => {
    persistSeen(currentMonthKey());
    setOpen(false);
  };

  if (!open || !reviewQuery.data) return null;
  const r = reviewQuery.data;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Your ${r.monthLabel} review`}
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        {/* Hero */}
        <div className="bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 px-5 py-6 text-white sm:px-6 sm:py-7">
          <p className="text-[10.5px] font-semibold uppercase tracking-widest text-white/85">
            Your wrap-up
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {r.monthLabel}
          </h2>
          <p className="mt-2 text-sm text-white/95">
            {formatINR(r.expenses, 0)} spent across {r.entryCount} entries
          </p>
          {r.savingsRateDelta !== null && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold backdrop-blur">
              {r.savingsRateDelta >= 0 ? (
                <ArrowUp className="h-3 w-3" aria-hidden />
              ) : (
                <ArrowDown className="h-3 w-3" aria-hidden />
              )}
              Savings rate {r.savingsRateDelta >= 0 ? "+" : ""}
              {(r.savingsRateDelta * 100).toFixed(1)} pts vs last month
            </p>
          )}
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5 sm:px-6">
          {r.topCategories.length > 0 && (
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Top spends
              </p>
              <ul className="mt-2 space-y-2">
                {r.topCategories.map((c) => {
                  const meta = CATEGORIES[toCategoryKey(c.category)];
                  return (
                    <li
                      key={c.category}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span aria-hidden>{meta.emoji}</span>
                        {meta.label}
                      </span>
                      <span className="flex items-center gap-2 tabular-nums">
                        {formatINR(c.total, 0)}
                        {c.deltaPct !== null && (
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              c.deltaPct >= 0
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            }`}
                          >
                            {c.deltaPct >= 0 ? (
                              <ArrowUp className="h-2.5 w-2.5" aria-hidden />
                            ) : (
                              <ArrowDown className="h-2.5 w-2.5" aria-hidden />
                            )}
                            {Math.abs(c.deltaPct * 100).toFixed(0)}%
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {r.biggestWin && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                <Sparkles className="h-3 w-3" aria-hidden /> Biggest win
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                {r.biggestWin.label}
              </p>
              <p className="mt-0.5 text-[11.5px] text-emerald-700 dark:text-emerald-300">
                {r.biggestWin.detail}
              </p>
            </div>
          )}

          {r.watchOut && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                <TriangleAlert className="h-3 w-3" aria-hidden /> Watch out
              </p>
              <p className="mt-1 text-sm font-semibold text-amber-900 dark:text-amber-200">
                {CATEGORIES[toCategoryKey(r.watchOut.category)].emoji}{" "}
                {CATEGORIES[toCategoryKey(r.watchOut.category)].label} up{" "}
                {(r.watchOut.deltaPct * 100).toFixed(0)}%
              </p>
              <p className="mt-0.5 text-[11.5px] text-amber-700 dark:text-amber-300">
                {formatINR(r.watchOut.total, 0)} this month — worth a closer
                look.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
            <ShareMilestoneButton
              shareUrl={`/share/monthly-review?month=${encodeURIComponent(r.monthLabel)}&savings=${Math.round(r.savingsRate * 100)}&top=${encodeURIComponent(
                r.topCategories
                  .map((c) => CATEGORIES[toCategoryKey(c.category)].emoji)
                  .join(""),
              )}`}
              title={`My ${r.monthLabel} wrap-up`}
              text={`My ${r.monthLabel} on EasySplits — ${Math.round(r.savingsRate * 100)}% savings rate. Try the free scorecard: `}
              label="Share my month"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:from-emerald-600 hover:to-teal-600"
            />
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Open dashboard
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
