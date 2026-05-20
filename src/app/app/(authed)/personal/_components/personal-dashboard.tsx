"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  TrendingUp,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { CATEGORIES, toCategoryKey } from "@/lib/categories";
import { formatINR } from "@/lib/format";
import { formatDate } from "@/lib/format-date";
import { useUserTimezone } from "@/lib/use-user-timezone";
import { AddPersonalEntry, type EntryType } from "./add-personal-entry";
import { AnomalyBanner } from "./anomaly-banner";
import { GoalsCard } from "./goals-card";
import { RecurrencesCard } from "./recurrences-card";
import { Scorecard } from "./scorecard";
import { YearlyTrendCard } from "./yearly-trend-card";
import { MonthlyReviewModal } from "@/components/monthly-review-modal";
import { useMutationWithQueue } from "@/lib/offline/use-mutation-with-queue";
import { useConfirm } from "@/components/confirm-dialog";

const PersonalCharts = dynamic(
  () => import("./personal-charts").then((m) => m.PersonalCharts),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-32 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Loading
        charts…
      </div>
    ),
  },
);

const PAGE_SIZE = 10;

function monthKeyForDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthKey(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

function formatMonthLabel(key: string): string {
  return parseMonthKey(key).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/** Tinted background for the leading emoji avatar in a transaction row.
 *  The colour conveys type (green/rose/cyan) so the row no longer needs
 *  a separate "income/expense/investment" text chip. */
const TYPE_AVATAR: Record<EntryType, string> = {
  income:
    "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-800/60",
  expense:
    "bg-rose-100 text-rose-700 ring-1 ring-rose-200/60 dark:bg-rose-950/60 dark:text-rose-200 dark:ring-rose-800/60",
  investment:
    "bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200/60 dark:bg-cyan-950/60 dark:text-cyan-200 dark:ring-cyan-800/60",
};

export function PersonalDashboard() {
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "income" | "expense" | "investment"
  >("all");
  const [month, setMonth] = useState<string>(monthKeyForDate(new Date()));
  // Tracks the month that was "current" the last time we computed it.
  // When the user lands on this row (via auto-default OR manual pick of
  // the row labelled current at that moment) and the calendar later
  // rolls over to a new month, the visibilitychange handler below snaps
  // them forward — but only if they haven't drifted to a different
  // historical month, which we infer from `month === lastCurrentRef`.
  const lastCurrentRef = useRef<string>(monthKeyForDate(new Date()));

  // Snap to the current month when the tab regains visibility on a new
  // calendar day. Long-lived PWA tabs would otherwise stay stuck on the
  // old month past midnight on month-end. Only fires when the user is
  // ALREADY on what was the current month — preserves any deliberate
  // historical-month browsing they're doing.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const today = monthKeyForDate(new Date());
      if (today === lastCurrentRef.current) return;
      const wasOnCurrent = month === lastCurrentRef.current;
      lastCurrentRef.current = today;
      if (wasOnCurrent) {
        queueMicrotask(() => {
          setMonth(today);
          setVisibleCount(PAGE_SIZE);
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [month]);
  const [showCharts, setShowCharts] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);
  const userTz = useUserTimezone();

  const focusForm = () => {
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const summaryQuery = trpc.personal.summary.useQuery({ month });
  const listQuery = trpc.personal.list.useQuery({ month });
  const topCatsQuery = trpc.personal.topCategoriesThisMonth.useQuery({ month });
  const monthsQuery = trpc.personal.availableMonths.useQuery();
  const profileQuery = trpc.personal.profile.get.useQuery();

  const utils = trpc.useUtils();
  const deleteMutation = trpc.personal.delete.useMutation({
    onSuccess: () => {
      utils.personal.list.invalidate();
      utils.personal.summary.invalidate();
      utils.personal.topCategoriesThisMonth.invalidate();
      utils.personal.availableMonths.invalidate();
    },
  });
  const submitDelete = useMutationWithQueue("personal.delete", deleteMutation, {
    onQueued: (rawInput) => {
      const i = rawInput as { id: string };
      utils.personal.list.setData({ month }, (old) =>
        old ? old.filter((e) => e.id !== i.id) : old,
      );
    },
  });

  const summary = summaryQuery.data;
  const entries = listQuery.data ?? [];
  const topCats = topCatsQuery.data ?? [];

  // Always include the current month even if it has no entries yet, so the
  // user can switch back to "this month" after browsing history.
  const months = useMemo(() => {
    const set = new Set(monthsQuery.data ?? []);
    set.add(monthKeyForDate(new Date()));
    return Array.from(set).sort().reverse();
  }, [monthsQuery.data]);

  // Client-side search + type filter over the already-fetched month. The
  // month is filtered server-side; this further narrows by free-text
  // match on description/category/amount and an income/expense/investment
  // chip. Browser-fast at ≤500 rows (our practical month max).
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (!q) return true;
      // Numeric-ish queries should match amount loosely (allow "1500" to
      // match a 1500.00 row). Text queries match description + category.
      if (/^\d/.test(q) && String(e.amount).includes(q)) return true;
      if (e.description.toLowerCase().includes(q)) return true;
      if (e.category.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [entries, searchQuery, typeFilter]);
  const visibleEntries = filteredEntries.slice(0, visibleCount);
  const editing = editingId ? entries.find((e) => e.id === editingId) : null;

  const savingsPct =
    summary && summary.income > 0
      ? Math.round(summary.savingsRate * 100)
      : null;
  const netClass =
    summary && summary.net >= 0 ? "text-emerald-100" : "text-rose-200";

  return (
    <main className="flex-1">
      <MonthlyReviewModal />
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {/* Heading + month picker */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Personal
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span aria-hidden className="mr-1">
                🔐
              </span>
              Your salary is your secret. We encrypt every amount before
              storing — our database only ever sees scrambled text.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <select
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900"
              aria-label="Select month"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
            <div className="flex gap-1.5">
              <Link
                href="/app/personal/import"
                title="Import transactions from a bank CSV statement"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                ⬇ Import
              </Link>
              <Link
                href="/app/personal/wealth"
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
              >
                💼 Net worth
              </Link>
            </div>
          </div>
        </div>

        {/* Hero KPI card */}
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 p-4 text-white shadow-sm sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
            Net this month
          </p>
          <p
            className={`mt-1 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl ${netClass}`}
          >
            {summaryQuery.isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin opacity-80" aria-hidden />
            ) : summary ? (
              `${summary.net >= 0 ? "+" : "−"}${formatINR(Math.abs(summary.net), 0)}`
            ) : (
              "—"
            )}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="min-w-0 rounded-lg bg-white/15 px-2 py-2 backdrop-blur sm:px-3">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/90">
                <ArrowDown className="h-3 w-3" aria-hidden /> In
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base">
                {summary ? formatINR(summary.income, 0) : "—"}
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-white/15 px-2 py-2 backdrop-blur sm:px-3">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/90">
                <ArrowUp className="h-3 w-3" aria-hidden /> Out
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base">
                {summary ? formatINR(summary.expenses + summary.investments, 0) : "—"}
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-white/15 px-2 py-2 backdrop-blur sm:px-3">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/90">
                <Wallet className="h-3 w-3" aria-hidden /> Saved
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold tabular-nums sm:text-base">
                {savingsPct === null ? "—" : `${savingsPct}%`}
              </p>
            </div>
          </div>
          {summary && summary.investments > 0 && (
            <p className="mt-3 flex items-center gap-1 text-[11px] text-white/90">
              <TrendingUp className="h-3 w-3" aria-hidden />
              {formatINR(summary.investments, 0)} invested · counted as money
              that left your account but built your future
            </p>
          )}
        </section>

        {/* Anomaly heads-up — only renders when there's something to flag */}
        <AnomalyBanner />

        {/* Scorecard — the differentiator */}
        <Scorecard
          score={profileQuery.data?.score ?? null}
          exists={profileQuery.data?.exists ?? false}
          loading={profileQuery.isLoading}
        />

        {/* Goals — only meaningful once the profile exists */}
        {profileQuery.data?.exists && profileQuery.data?.score?.hasEnoughData && (
          <GoalsCard />
        )}

        {/* Top categories */}
        {topCats.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Top spending categories
            </h2>
            <ul className="mt-3 space-y-2">
              {topCats.map((c) => {
                const meta = CATEGORIES[toCategoryKey(c.category)];
                const max = topCats[0]?.total ?? 1;
                const pct = (c.total / max) * 100;
                return (
                  <li key={c.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden>{meta.emoji}</span>
                        {meta.label}
                      </span>
                      <span className="tabular-nums text-slate-600 dark:text-slate-300">
                        {formatINR(c.total, 0)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${pct}%`, background: meta.hex }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Recurring entries (v5.0) — auto-fill salary/rent/SIP each month */}
        <RecurrencesCard />

        {/* Multi-month / year-over-year trend — only renders once the
            user has at least one month of entries, so brand-new users
            don't see an empty chart. */}
        <YearlyTrendCard />

        {/* Transactions list — primary daily content surfaces above
            charts/forms (charts are derived; FAB scrolls to add form). */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Transactions
              <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">
                ({filteredEntries.length}
                {filteredEntries.length !== entries.length
                  ? ` of ${entries.length}`
                  : ""}
                )
              </span>
            </h2>
          </div>

          {/* Search + type filter — only renders when the user has
              enough entries that scanning the list would be slow. Keeps
              the dashboard uncluttered for new users. */}
          {entries.length >= 8 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="Search description, category, amount…"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900"
              />
              <div className="inline-flex shrink-0 rounded-full border border-slate-200 bg-white p-0.5 text-[11px] font-medium dark:border-slate-700 dark:bg-slate-900">
                {(["all", "income", "expense", "investment"] as const).map(
                  (opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setTypeFilter(opt);
                        setVisibleCount(PAGE_SIZE);
                      }}
                      aria-pressed={typeFilter === opt}
                      className={`rounded-full px-2 py-0.5 transition ${
                        typeFilter === opt
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      {opt === "all"
                        ? "All"
                        : opt[0].toUpperCase() + opt.slice(1)}
                    </button>
                  ),
                )}
              </div>
              {(searchQuery || typeFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setTypeFilter("all");
                  }}
                  className="shrink-0 text-[11px] text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>
          )}
          {listQuery.isLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
            </div>
          ) : entries.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-emerald-50/40 p-6 text-center dark:border-slate-700 dark:from-slate-900/40 dark:to-emerald-950/20">
              <span
                aria-hidden
                className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-xl text-white shadow-sm"
              >
                💸
              </span>
              <p className="mt-3 text-base font-semibold tracking-tight">
                Log your first entry
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
                Track income, expenses, and investments. Encrypted before storage — your numbers stay yours.
              </p>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                <Plus className="h-4 w-4" aria-hidden /> Add an entry
              </button>
            </div>
          ) : filteredEntries.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              No matches.{" "}
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setTypeFilter("all");
                }}
                className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
              >
                Clear filters
              </button>
              {" "}to see all {entries.length} entries.
            </p>
          ) : (
            <>
              <ul className="mt-4 space-y-2">
                {visibleEntries.map((e) => {
                  const meta = CATEGORIES[toCategoryKey(e.category)];
                  const t = e.type as EntryType;
                  const sign =
                    t === "income" ? "+" : t === "expense" ? "−" : "↗";
                  return (
                    <li
                      key={e.id}
                      className={`animate-row-in flex items-center gap-3 rounded-xl border p-2.5 transition sm:p-3 ${
                        editingId === e.id
                          ? "border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/30"
                          : "border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40"
                      }`}
                    >
                      {/* Type-tinted emoji avatar — color carries the
                          type signal, emoji carries the category. Replaces
                          the old type+category chip pair. */}
                      <span
                        aria-hidden
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ${TYPE_AVATAR[t]}`}
                      >
                        {meta.emoji}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {e.description || meta.label}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {meta.label}
                          {" · "}
                          {formatDate(e.occurredAt, userTz, "short")}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={`whitespace-nowrap text-sm font-bold tabular-nums ${
                            t === "income"
                              ? "text-emerald-700 dark:text-emerald-400"
                              : t === "expense"
                                ? "text-rose-700 dark:text-rose-400"
                                : "text-cyan-700 dark:text-cyan-400"
                          }`}
                        >
                          {sign}
                          {formatINR(e.amount, 0)}
                        </span>
                        <div className="flex gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAdding(false);
                              setEditingId(e.id);
                              focusForm();
                            }}
                            aria-pressed={editingId === e.id}
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition ${
                              editingId === e.id
                                ? "bg-indigo-500 text-white"
                                : "text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                            }`}
                            aria-label="Edit entry"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (
                                !(await confirm({
                                  title: "Remove this entry?",
                                  description:
                                    "This personal entry will be removed from your monthly totals and scorecard inputs.",
                                  confirmLabel: "Remove",
                                  destructive: true,
                                }))
                              )
                                return;
                              if (editingId === e.id) setEditingId(null);
                              try {
                                const { queued } = await submitDelete({
                                  id: e.id,
                                });
                                if (!queued) toast.success("Entry removed");
                              } catch (err) {
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : "Delete failed",
                                );
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                            aria-label="Remove entry"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {filteredEntries.length > visibleCount && (
                <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount((n) =>
                        Math.min(n + PAGE_SIZE, filteredEntries.length),
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
                  >
                    Show {Math.min(PAGE_SIZE, filteredEntries.length - visibleCount)} more
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleCount(filteredEntries.length)}
                    className="text-xs font-medium text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                  >
                    Show all {filteredEntries.length}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Charts (collapsible — recharts is lazy-loaded). Now sits
            below Transactions because charts are derived from the data
            above; user sees the source of truth first. */}
        {summary && summary.entryCounts.expense + summary.entryCounts.income + summary.entryCounts.investment > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <button
              type="button"
              onClick={() => setShowCharts((v) => !v)}
              aria-expanded={showCharts}
              className="flex w-full items-center justify-between"
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <BarChart3 className="h-4 w-4 text-fuchsia-500" aria-hidden />
                Charts
              </h2>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition ${showCharts ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {showCharts && (
              <div className="mt-4">
                <PersonalCharts month={month} />
              </div>
            )}
          </section>
        )}

        {/* Add / Edit form — last on the page since the FAB scrolls
            this into view when triggered. Keeps the default-scroll
            view focused on data, not on an empty form. */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Plus className="h-4 w-4 text-emerald-500" aria-hidden />
              {editing ? "Edit entry" : adding ? "Add entry" : "Add"}
            </h2>
            {!editing && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  const next = !adding;
                  setAdding(next);
                  if (next) focusForm();
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {adding ? "Cancel" : "New"}
              </button>
            )}
          </div>

          {(adding || editing) && (
            <div ref={formRef} className="mt-4 scroll-mt-20">
              <AddPersonalEntry
                key={editingId ?? "new"}
                editing={
                  editing
                    ? {
                        id: editing.id,
                        type: editing.type as EntryType,
                        amount: editing.amount,
                        currency: editing.currency,
                        category: editing.category,
                        description: editing.description,
                        occurredAt: editing.occurredAt,
                      }
                    : null
                }
                onDone={() => {
                  setAdding(false);
                  setEditingId(null);
                }}
                onCancel={
                  editing ? () => setEditingId(null) : () => setAdding(false)
                }
              />
            </div>
          )}
        </section>
      </div>

      {/* FAB */}
      {!adding && !editingId && (
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setAdding(true);
            focusForm();
          }}
          aria-label="Add entry"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-5 z-30 flex items-center gap-2 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40 transition-transform duration-150 hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6"
        >
          <Plus className="h-5 w-5" aria-hidden />
          <span className="hidden sm:inline">Add entry</span>
        </button>
      )}
    </main>
  );
}
