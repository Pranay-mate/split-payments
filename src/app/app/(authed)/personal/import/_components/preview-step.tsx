"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { CATEGORIES, CATEGORY_KEYS, toCategoryKey } from "@/lib/categories";
import { formatINR } from "@/lib/format";
import type { ParseResult, ParsedTransaction } from "@/lib/bank-parsers/types";

type RowState = {
  selected: boolean;
  type: ParsedTransaction["type"];
  amount: number;
  description: string;
  category: string;
  occurredAt: Date;
};

const TYPE_OPTIONS = [
  { value: "expense" as const, label: "Expense", chip: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
  { value: "income" as const, label: "Income", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  { value: "investment" as const, label: "Investment", chip: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300" },
];

export function PreviewStep({
  parsed,
  filename,
  onCancel,
  onComplete,
}: {
  parsed: ParseResult;
  filename: string;
  onCancel: () => void;
  onComplete: (imported: number, skipped: number, failed: number) => void;
}) {
  // Initialise per-row state. Self-transfer flagged rows default to
  // unselected so a user with multiple bank accounts doesn't double-count.
  const [rows, setRows] = useState<Map<string, RowState>>(() => {
    const m = new Map<string, RowState>();
    for (const t of parsed.transactions) {
      m.set(t.clientEventId, {
        selected: !t.isLikelySelfTransfer,
        type: t.type,
        amount: t.amount,
        description: t.description,
        category: t.category,
        occurredAt: t.occurredAt,
      });
    }
    return m;
  });

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const updateRow = (id: string, patch: Partial<RowState>) => {
    setRows((prev) => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) next.set(id, { ...existing, ...patch });
      return next;
    });
  };

  const selectedTransactions = useMemo(
    () =>
      parsed.transactions.filter((t) => rows.get(t.clientEventId)?.selected),
    [parsed.transactions, rows],
  );

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let investment = 0;
    let earliest: Date | null = null;
    let latest: Date | null = null;
    for (const t of selectedTransactions) {
      const r = rows.get(t.clientEventId)!;
      if (r.type === "income") income += r.amount;
      else if (r.type === "expense") expense += r.amount;
      else investment += r.amount;
      if (!earliest || r.occurredAt < earliest) earliest = r.occurredAt;
      if (!latest || r.occurredAt > latest) latest = r.occurredAt;
    }
    return { income, expense, investment, earliest, latest };
  }, [selectedTransactions, rows]);

  const setAll = (selected: boolean) => {
    setRows((prev) => {
      const next = new Map(prev);
      for (const [id, r] of next) next.set(id, { ...r, selected });
      return next;
    });
  };

  const createMutation = trpc.personal.create.useMutation();
  const utils = trpc.useUtils();

  const handleImport = async () => {
    if (selectedTransactions.length === 0) {
      toast.error("Nothing selected.");
      return;
    }
    setImporting(true);
    setProgress({ done: 0, total: selectedTransactions.length });

    // Concurrency 4: a small pool so we don't stampede the personal.create
    // endpoint, but enough to import 50 rows in seconds rather than minutes.
    let done = 0;
    let failed = 0;
    const queue = [...selectedTransactions];
    const workers: Promise<void>[] = [];

    const worker = async () => {
      while (queue.length > 0) {
        const t = queue.shift();
        if (!t) break;
        const r = rows.get(t.clientEventId);
        if (!r) continue;
        try {
          await createMutation.mutateAsync({
            type: r.type,
            amount: r.amount,
            currency: "INR",
            category: toCategoryKey(r.category),
            description: r.description,
            occurredAt: r.occurredAt,
            clientEventId: t.clientEventId,
          });
        } catch (err) {
          console.error("Import row failed:", err);
          failed++;
        } finally {
          done++;
          setProgress({ done, total: selectedTransactions.length });
        }
      }
    };
    for (let i = 0; i < 4; i++) workers.push(worker());
    await Promise.all(workers);

    // Refresh dashboard data so newly imported entries show up.
    utils.personal.list.invalidate();
    utils.personal.summary.invalidate();
    utils.personal.topCategoriesThisMonth.invalidate();
    utils.personal.availableMonths.invalidate();

    onComplete(
      done - failed,
      parsed.transactions.length - selectedTransactions.length,
      failed,
    );
  };

  return (
    <section className="space-y-4">
      {/* Summary card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {filename}{" "}
            <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {parsed.format}
            </span>
          </h2>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {parsed.transactions.length} parsed
            {parsed.skipped.length > 0 ? ` · ${parsed.skipped.length} skipped` : ""}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <SummaryStat label="Income" value={summary.income} colour="emerald" />
          <SummaryStat label="Expense" value={summary.expense} colour="rose" />
          <SummaryStat label="Investment" value={summary.investment} colour="cyan" />
        </div>
        {summary.earliest && summary.latest && (
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            {summary.earliest.toLocaleDateString()} →{" "}
            {summary.latest.toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Bulk toggles */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {selectedTransactions.length} of {parsed.transactions.length} selected
        </span>
        <button
          type="button"
          onClick={() => setAll(true)}
          className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={() => setAll(false)}
          className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Deselect all
        </button>
      </div>

      {/* Transactions list — card per row on mobile, denser on desktop */}
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {parsed.transactions.map((t) => {
          const r = rows.get(t.clientEventId)!;
          const typeMeta = TYPE_OPTIONS.find((o) => o.value === r.type)!;
          return (
            <li
              key={t.clientEventId}
              className={`flex flex-col gap-2 px-3 py-3 transition sm:px-4 ${
                r.selected ? "" : "opacity-60"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={r.selected}
                  onChange={(e) =>
                    updateRow(t.clientEventId, { selected: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="truncate text-sm font-medium">
                      {r.description}
                    </span>
                    {t.isLikelySelfTransfer && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        Self transfer?
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {r.occurredAt.toLocaleDateString()} · row{" "}
                    {t.sourceRow}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatINR(r.amount)}
                  </p>
                  <span
                    className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ${typeMeta.chip}`}
                  >
                    {typeMeta.label}
                  </span>
                </div>
              </div>

              {r.selected && (
                <div className="ml-7 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                  <label className="block">
                    <span className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Type
                    </span>
                    <select
                      value={r.type}
                      onChange={(e) =>
                        updateRow(t.clientEventId, {
                          type: e.target.value as RowState["type"],
                        })
                      }
                      className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[11.5px] dark:border-slate-700 dark:bg-slate-950"
                    >
                      {TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Category
                    </span>
                    <select
                      value={r.category}
                      onChange={(e) =>
                        updateRow(t.clientEventId, { category: e.target.value })
                      }
                      className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[11.5px] dark:border-slate-700 dark:bg-slate-950"
                    >
                      {CATEGORY_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {CATEGORIES[k].emoji} {CATEGORIES[k].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-1 col-span-2">
                    <span className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Amount (₹)
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={r.amount}
                      onChange={(e) =>
                        updateRow(t.clientEventId, {
                          amount: Number(e.target.value) || 0,
                        })
                      }
                      className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-[11.5px] tabular-nums dark:border-slate-700 dark:bg-slate-950"
                    />
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Skipped rows callout */}
      {parsed.skipped.length > 0 && (
        <details className="rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2 text-[12px] dark:border-slate-700 dark:bg-slate-800/30">
          <summary className="cursor-pointer font-medium">
            {parsed.skipped.length} rows couldn&apos;t be parsed
          </summary>
          <ul className="mt-1 space-y-0.5 text-slate-600 dark:text-slate-300">
            {parsed.skipped.map((s) => (
              <li key={s.sourceRow}>
                Row {s.sourceRow}: {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Sticky action bar */}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-20 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-md dark:border-slate-800 dark:bg-slate-900 sm:bottom-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[11.5px] text-slate-500 dark:text-slate-400">
          {importing
            ? `Importing ${progress.done} of ${progress.total}…`
            : `Re-uploads of the same statement won't create duplicates — we deduplicate by date + amount + description.`}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={importing}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || selectedTransactions.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
          >
            {importing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            )}
            Import {selectedTransactions.length} transactions
          </button>
        </div>
      </div>
    </section>
  );
}

function SummaryStat({
  label,
  value,
  colour,
}: {
  label: string;
  value: number;
  colour: "emerald" | "rose" | "cyan";
}) {
  const ringClass =
    colour === "emerald"
      ? "border-emerald-200 dark:border-emerald-900/40"
      : colour === "rose"
        ? "border-rose-200 dark:border-rose-900/40"
        : "border-cyan-200 dark:border-cyan-900/40";
  const textClass =
    colour === "emerald"
      ? "text-emerald-700 dark:text-emerald-400"
      : colour === "rose"
        ? "text-rose-700 dark:text-rose-400"
        : "text-cyan-700 dark:text-cyan-400";
  return (
    <div className={`rounded-lg border ${ringClass} px-2.5 py-2`}>
      <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${textClass}`}>
        {formatINR(value)}
      </p>
    </div>
  );
}
