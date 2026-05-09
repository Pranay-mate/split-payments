"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
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
import { AddPersonalEntry, type EntryType } from "./add-personal-entry";
import { AnomalyBanner } from "./anomaly-banner";
import { Scorecard } from "./scorecard";

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

const TYPE_BADGE: Record<EntryType, string> = {
  income:
    "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300",
  expense: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  investment:
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300",
};

export function PersonalDashboard() {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [month, setMonth] = useState<string>(monthKeyForDate(new Date()));
  const [showCharts, setShowCharts] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);

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

  const visibleEntries = entries.slice(0, visibleCount);
  const editing = editingId ? entries.find((e) => e.id === editingId) : null;

  const savingsPct =
    summary && summary.income > 0
      ? Math.round(summary.savingsRate * 100)
      : null;
  const netClass =
    summary && summary.net >= 0 ? "text-emerald-100" : "text-rose-200";

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {/* Heading + month picker */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Personal
            </h1>
            <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <span aria-hidden>🔐</span>
              Your salary is your secret. We encrypt every amount before
              storing — our database only ever sees scrambled text, not
              your numbers.
            </p>
          </div>
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900"
            aria-label="Select month"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </div>

        {/* Hero KPI card */}
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 p-5 text-white shadow-sm">
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
            <div className="rounded-lg bg-white/15 px-3 py-2 backdrop-blur">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/70">
                <ArrowDown className="h-3 w-3" aria-hidden /> In
              </p>
              <p className="mt-0.5 text-base font-semibold tabular-nums">
                {summary ? formatINR(summary.income, 0) : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-white/15 px-3 py-2 backdrop-blur">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/70">
                <ArrowUp className="h-3 w-3" aria-hidden /> Out
              </p>
              <p className="mt-0.5 text-base font-semibold tabular-nums">
                {summary ? formatINR(summary.expenses + summary.investments, 0) : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-white/15 px-3 py-2 backdrop-blur">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/70">
                <Wallet className="h-3 w-3" aria-hidden /> Saved
              </p>
              <p className="mt-0.5 text-base font-semibold tabular-nums">
                {savingsPct === null ? "—" : `${savingsPct}%`}
              </p>
            </div>
          </div>
          {summary && summary.investments > 0 && (
            <p className="mt-3 flex items-center gap-1 text-[11px] text-white/70">
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

        {/* Top categories */}
        {topCats.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
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

        {/* Charts (collapsible — recharts is lazy-loaded) */}
        {summary && summary.entryCounts.expense + summary.entryCounts.income + summary.entryCounts.investment > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
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

        {/* Add / Edit form */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
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

        {/* Transactions list */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Transactions ({entries.length})
          </h2>
          {listQuery.isLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
            </div>
          ) : entries.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              No entries this month yet — add the first one above.
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
                      className={`animate-row-in rounded-xl border p-3 transition ${
                        editingId === e.id
                          ? "border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/30"
                          : "border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-sm font-medium">
                            <span className="truncate">
                              {e.description || meta.label}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_BADGE[t]}`}
                            >
                              {t}
                            </span>
                            <span
                              className={`shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.chipClass}`}
                            >
                              <span aria-hidden>{meta.emoji}</span>
                              {meta.label}
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {new Date(e.occurredAt).toLocaleDateString(
                              undefined,
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-semibold tabular-nums ${
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
                          <div className="flex">
                            <button
                              type="button"
                              onClick={() => {
                                setAdding(false);
                                setEditingId(e.id);
                                focusForm();
                              }}
                              aria-pressed={editingId === e.id}
                              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
                                editingId === e.id
                                  ? "bg-indigo-500 text-white"
                                  : "text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                              }`}
                              aria-label="Edit entry"
                            >
                              <Pencil className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm("Remove this entry?")) return;
                                if (editingId === e.id) setEditingId(null);
                                try {
                                  await deleteMutation.mutateAsync({ id: e.id });
                                  toast.success("Entry removed");
                                } catch (err) {
                                  toast.error(
                                    err instanceof Error
                                      ? err.message
                                      : "Delete failed",
                                  );
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                              aria-label="Remove entry"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {entries.length > visibleCount && (
                <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount((n) =>
                        Math.min(n + PAGE_SIZE, entries.length),
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
                  >
                    Show {Math.min(PAGE_SIZE, entries.length - visibleCount)} more
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleCount(entries.length)}
                    className="text-xs font-medium text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                  >
                    Show all {entries.length}
                  </button>
                </div>
              )}
            </>
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
          className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40 transition-transform duration-150 hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6"
        >
          <Plus className="h-5 w-5" aria-hidden />
          <span className="hidden sm:inline">Add entry</span>
        </button>
      )}
    </main>
  );
}
