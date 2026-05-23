"use client";

import { Loader2, Pencil, Plus, Trash2, X, History } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/format";
import { CATEGORIES, toCategoryKey } from "@/lib/categories";
import { useUserTimezone } from "@/lib/use-user-timezone";
import { formatDate } from "@/lib/format-date";

/**
 * Per-expense history modal. Surfaces the full audit trail of an
 * expense (created → edits → deleted) with proper before→after diffs
 * for each edit. Trust feature for groups — one member edits, others
 * can see exactly what changed.
 *
 * UX choices:
 *   - Bottom sheet on mobile, centered card on desktop (matches
 *     existing modal pattern)
 *   - Newest-first timeline, with the "created" event always at the
 *     bottom as the anchor
 *   - Diffs are colour-coded: rose for old, emerald for new
 *   - Only fields that actually changed are listed (no noise for
 *     "currency: INR → INR")
 *   - Friendly empty state if the expense hasn't been edited
 */

type PayerLookup = (id: string) => string;

type DiffRow = {
  field: string;
  label: string;
  before: string;
  after: string;
};

const FIELD_LABELS: Record<string, string> = {
  description: "Description",
  amount: "Amount",
  currency: "Currency",
  payerId: "Paid by",
  splitMode: "Split mode",
  category: "Category",
};

function asString(v: unknown): string {
  if (v === null || v === undefined) return "—";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

function formatField(
  field: string,
  value: unknown,
  currency: string,
  resolvePayer: PayerLookup,
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "amount" && typeof value === "number") {
    return formatCurrency(value, currency, 2);
  }
  if (field === "category" && typeof value === "string") {
    const meta = CATEGORIES[toCategoryKey(value)];
    return `${meta.emoji} ${meta.label}`;
  }
  if (field === "payerId" && typeof value === "string") {
    return resolvePayer(value);
  }
  if (field === "splitMode" && typeof value === "string") {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return asString(value);
}

function computeDiff(
  payload: Record<string, unknown>,
  resolvePayer: PayerLookup,
): DiffRow[] {
  const before = (payload.before ?? {}) as Record<string, unknown>;
  const after = (payload.after ?? {}) as Record<string, unknown>;
  const fields = ["description", "amount", "currency", "payerId", "splitMode", "category"];
  const out: DiffRow[] = [];
  // Use the AFTER currency to format amount diffs, falls back to before.
  const currency =
    (after.currency as string | undefined) ??
    (before.currency as string | undefined) ??
    "INR";
  for (const field of fields) {
    const b = before[field];
    const a = after[field];
    // Skip unchanged + cases where both sides are missing.
    if (b === a) continue;
    if (b === undefined && a === undefined) continue;
    out.push({
      field,
      label: FIELD_LABELS[field] ?? field,
      before: formatField(field, b, currency, resolvePayer),
      after: formatField(field, a, currency, resolvePayer),
    });
  }
  return out;
}

export function ItemHistoryModal({
  expenseId,
  open,
  onClose,
  memberById,
}: {
  expenseId: string;
  open: boolean;
  onClose: () => void;
  memberById: Map<string, { id: string; name: string }>;
}) {
  const userTz = useUserTimezone();
  const historyQuery = trpc.events.listByExpense.useQuery(
    { expenseId, limit: 50 },
    { enabled: open, staleTime: 30_000 },
  );

  const resolvePayer: PayerLookup = (id) =>
    memberById.get(id)?.name ?? "Former member";

  if (!open) return null;

  // Sort newest → oldest. Events come back in desc order from the
  // server but resort defensively so a future ordering change doesn't
  // silently break this UI.
  const events = (historyQuery.data ?? []).slice().sort((a, b) => {
    const at = new Date(a.occurredAt).getTime();
    const bt = new Date(b.occurredAt).getTime();
    return bt - at;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Expense history"
      onClick={onClose}
    >
      <div
        className="relative max-h-[80vh] w-full max-w-md overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div>
            <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              <History className="h-3.5 w-3.5" aria-hidden /> History
            </p>
            <h2 className="mt-0.5 text-base font-semibold tracking-tight">
              Every change to this expense
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 sm:px-6">
          {historyQuery.isLoading ? (
            <p className="flex items-center gap-1.5 py-6 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading
              history…
            </p>
          ) : events.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No history yet.
              </p>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Edits made before this feature shipped won&apos;t appear.
              </p>
            </div>
          ) : (
            <ol className="relative space-y-3">
              <span
                aria-hidden
                className="absolute left-[15px] top-1.5 h-[calc(100%-12px)] w-px bg-slate-200 dark:bg-slate-800"
              />
              {events.map((e) => {
                const actor =
                  memberById.get(e.actorId)?.name ?? "Former member";
                const payload = e.payload as Record<string, unknown>;
                const isUpdate = e.eventType === "expense.updated";
                const isDelete = e.eventType === "expense.deleted";
                const isCreate = e.eventType === "expense.added";
                const Icon = isCreate ? Plus : isDelete ? Trash2 : Pencil;
                const iconBg = isCreate
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : isDelete
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                    : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300";

                const diffs =
                  isUpdate && payload.before && payload.after
                    ? computeDiff(payload, resolvePayer)
                    : [];

                return (
                  <li key={e.id} className="relative flex gap-3 pl-0">
                    <span
                      aria-hidden
                      className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-2 ring-white dark:ring-slate-900 ${iconBg}`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-xs leading-snug">
                        <span className="font-semibold">{actor}</span>{" "}
                        <span className="text-slate-500 dark:text-slate-400">
                          {isCreate
                            ? "created this expense"
                            : isDelete
                              ? "removed this expense"
                              : diffs.length > 0
                                ? "edited this expense"
                                : "made a small edit"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-slate-400 dark:text-slate-500">
                        {formatDate(e.occurredAt, userTz, "datetime")}
                      </p>

                      {isUpdate && diffs.length > 0 && (
                        <ul className="mt-2 space-y-1 rounded-lg border border-slate-100 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-800/40">
                          {diffs.map((d) => (
                            <li
                              key={d.field}
                              className="grid grid-cols-[auto_1fr] items-baseline gap-x-2 text-[11px]"
                            >
                              <span className="font-medium text-slate-500 dark:text-slate-400">
                                {d.label}
                              </span>
                              <span className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700 line-through decoration-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:decoration-rose-700">
                                  {d.before}
                                </span>
                                <span aria-hidden className="text-slate-400">
                                  →
                                </span>
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                  {d.after}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {isCreate &&
                        typeof payload.description === "string" &&
                        payload.description && (
                          <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                            “{payload.description}”
                          </p>
                        )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
