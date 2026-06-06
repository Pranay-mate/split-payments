"use client";

import { useState } from "react";
import {
  ChevronDown,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { CATEGORIES, CATEGORY_KEYS, toCategoryKey } from "@/lib/categories";
import { formatINR } from "@/lib/format";
import { formatDate } from "@/lib/format-date";
import { useUserTimezone } from "@/lib/use-user-timezone";
import { useConfirm } from "@/components/confirm-dialog";

type EntryType = "income" | "expense" | "investment";

const TYPE_TONE: Record<EntryType, string> = {
  income: "text-emerald-700 dark:text-emerald-400",
  expense: "text-rose-700 dark:text-rose-400",
  investment: "text-cyan-700 dark:text-cyan-400",
};

const TYPE_SIGN: Record<EntryType, string> = {
  income: "+",
  expense: "−",
  investment: "↗",
};

export function RecurrencesCard() {
  const confirm = useConfirm();
  const utils = trpc.useUtils();
  const listQuery = trpc.personal.recurrences.list.useQuery();
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const userTz = useUserTimezone();
  const [editingId, setEditingId] = useState<string | null>(null);

  const items = listQuery.data ?? [];
  const active = items.filter((r) => r.pausedAt === null);
  const paused = items.filter((r) => r.pausedAt !== null);

  // Monthly burn / earn summary across active recurrences. Paused
  // rows are excluded because they won't fire. Mirrors the sign
  // convention used per-row: income positive, expense + investment
  // subtract from net.
  const activeSums = active.reduce(
    (acc, r) => {
      if (r.type === "income") acc.income += r.amount;
      else if (r.type === "expense") acc.expense += r.amount;
      else if (r.type === "investment") acc.investment += r.amount;
      return acc;
    },
    { income: 0, expense: 0, investment: 0 },
  );
  const netMonthly =
    activeSums.income - activeSums.expense - activeSums.investment;

  // Default-collapsed when no items; auto-open when adding.
  const isOpen = expanded || items.length > 0 || adding;

  const pauseMutation = trpc.personal.recurrences.pause.useMutation({
    onSuccess: () => {
      utils.personal.recurrences.list.invalidate();
      toast.success("Paused");
    },
    onError: (err) => toast.error(err.message),
  });
  const resumeMutation = trpc.personal.recurrences.resume.useMutation({
    onSuccess: () => {
      utils.personal.recurrences.list.invalidate();
      toast.success("Resumed");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.personal.recurrences.delete.useMutation({
    onSuccess: () => {
      utils.personal.recurrences.list.invalidate();
      toast.success("Recurrence deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  if (listQuery.isLoading) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left dark:border-slate-800 sm:px-5"
        aria-expanded={isOpen}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Repeat className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
          <h2 className="min-w-0 text-sm font-semibold tracking-tight">
            Recurring · {active.length}
            {paused.length > 0 && (
              <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                + {paused.length} paused
              </span>
            )}
            {active.length > 0 && (
              <span
                className={`ml-2 text-[11px] font-medium tabular-nums ${
                  netMonthly >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                · {netMonthly >= 0 ? "+" : "−"}
                {formatINR(Math.abs(netMonthly), 0)}/mo
              </span>
            )}
          </h2>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {isOpen && (
        <div className="px-4 py-3 sm:px-5">
          {items.length === 0 && !adding ? (
            <div className="py-3 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Auto-add salary, rent, SIPs, subscriptions every month.
              </p>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add first recurrence
              </button>
            </div>
          ) : (
            <>
              {items.length > 0 && (
                <ul className="space-y-2">
                  {items.map((r) => {
                    const meta = CATEGORIES[toCategoryKey(r.category)];
                    const t = r.type as EntryType;
                    const due = new Date(r.nextDueAt);
                    const isPaused = r.pausedAt !== null;
                    return (
                      <li
                        key={r.id}
                        className={`flex items-center gap-3 rounded-xl border p-2.5 sm:p-3 ${
                          editingId === r.id
                            ? "border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/30"
                            : isPaused
                              ? "border-slate-200 bg-slate-50/60 opacity-60 dark:border-slate-700 dark:bg-slate-800/40"
                              : "border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40"
                        }`}
                      >
                        <span
                          aria-hidden
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-100 text-base text-violet-700 dark:bg-violet-950/60 dark:text-violet-200"
                        >
                          {meta.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {r.description || meta.label}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                            Day {r.scheduleDay} · {meta.label} ·{" "}
                            {isPaused
                              ? "Paused"
                              : `Next ${formatDate(due, userTz, "short")}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={`whitespace-nowrap text-sm font-bold tabular-nums ${TYPE_TONE[t]}`}
                          >
                            {TYPE_SIGN[t]}
                            {formatINR(r.amount, 0)}
                          </span>
                          <div className="flex gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setAdding(false);
                                setEditingId(r.id);
                              }}
                              aria-pressed={editingId === r.id}
                              className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition ${
                                editingId === r.id
                                  ? "bg-indigo-500 text-white"
                                  : "text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"
                              }`}
                              aria-label="Edit recurrence"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            {isPaused ? (
                              <button
                                type="button"
                                onClick={() =>
                                  resumeMutation.mutate({ id: r.id })
                                }
                                disabled={resumeMutation.isPending}
                                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-emerald-600 transition hover:bg-emerald-100 dark:hover:bg-emerald-950/40"
                                aria-label="Resume recurrence"
                              >
                                <Play className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  pauseMutation.mutate({ id: r.id })
                                }
                                disabled={pauseMutation.isPending}
                                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-amber-600 transition hover:bg-amber-100 dark:hover:bg-amber-950/40"
                                aria-label="Pause recurrence"
                              >
                                <Pause className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                if (
                                  await confirm({
                                    title: "Delete this recurrence?",
                                    description:
                                      "Past auto-created entries stay in your records. Only the schedule stops.",
                                    confirmLabel: "Delete schedule",
                                    destructive: true,
                                  })
                                ) {
                                  deleteMutation.mutate({ id: r.id });
                                }
                              }}
                              disabled={deleteMutation.isPending}
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40"
                              aria-label="Delete recurrence"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {!adding && !editingId && (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add recurrence
                </button>
              )}

              {(adding || editingId) && (
                <RecurrenceForm
                  key={editingId ?? "new"}
                  editing={
                    editingId
                      ? items.find((r) => r.id === editingId) ?? null
                      : null
                  }
                  onDone={() => {
                    setAdding(false);
                    setEditingId(null);
                  }}
                />
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function RecurrenceForm({
  editing,
  onDone,
}: {
  editing: {
    id: string;
    type: "income" | "expense" | "investment";
    amount: number;
    description: string;
    category: string;
    currency: string;
    scheduleDay: number;
  } | null;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const [type, setType] = useState<"income" | "expense" | "investment">(
    editing?.type ?? "expense",
  );
  const [amount, setAmount] = useState<number | "">(editing?.amount ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [category, setCategory] = useState(editing?.category ?? "other");
  const [scheduleDay, setScheduleDay] = useState<number>(
    editing?.scheduleDay ?? 1,
  );
  // Backfill is only meaningful on NEW recurrences whose chosen day
  // has already passed in the current month — in that case nextDueAt
  // skips to next month, so the user loses this month's occurrence
  // unless they opt in to a one-off entry for it.
  const [backfill, setBackfill] = useState(false);
  const today = new Date();
  const showBackfill = !editing && scheduleDay < today.getDate();
  const backfillDate = (() => {
    if (!showBackfill) return null;
    const lastDay = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    ).getDate();
    const day = Math.min(scheduleDay, lastDay);
    return new Date(today.getFullYear(), today.getMonth(), day);
  })();

  const createMutation = trpc.personal.recurrences.create.useMutation({
    onSuccess: (created) => {
      utils.personal.recurrences.list.invalidate();
      // If the server materialized an entry (fire-on-create or
      // backfill), refresh the surfaces that show personal entries.
      if (
        (created as unknown as { fired?: boolean; backfilled?: boolean })
          ?.fired ||
        (created as unknown as { fired?: boolean; backfilled?: boolean })
          ?.backfilled
      ) {
        utils.personal.list.invalidate();
        utils.personal.summary.invalidate();
        utils.personal.topCategoriesThisMonth.invalidate();
        utils.personal.availableMonths.invalidate();
        utils.personal.monthlyTrend.invalidate();
      }
      toast.success("Recurrence saved");
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.personal.recurrences.update.useMutation({
    onSuccess: () => {
      utils.personal.recurrences.list.invalidate();
      toast.success("Recurrence updated");
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  const numericAmount = typeof amount === "number" ? amount : 0;
  const valid = numericAmount > 0;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      toast.error("Amount must be greater than 0");
      return;
    }
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        type,
        amount: Number(amount),
        description,
        category: category as (typeof CATEGORY_KEYS)[number],
        scheduleDay,
      });
    } else {
      createMutation.mutate({
        type,
        amount: Number(amount),
        description,
        category: category as (typeof CATEGORY_KEYS)[number],
        scheduleDay,
        ...(showBackfill && backfill && { backfillCurrentMonth: true }),
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form
      onSubmit={submit}
      className="mt-3 space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-900/40 dark:bg-violet-950/20"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
          {editing ? "Edit recurrence" : "New recurrence"}
        </p>
        <button
          type="button"
          onClick={onDone}
          className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <div
        className="inline-flex w-full rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900"
        role="tablist"
        aria-label="Type"
      >
        {(["income", "expense", "investment"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            onClick={() => setType(t)}
            className={`flex-1 rounded-md px-2 py-1 capitalize transition ${
              type === t
                ? t === "income"
                  ? "bg-emerald-500 text-white"
                  : t === "expense"
                    ? "bg-rose-500 text-white"
                    : "bg-cyan-500 text-white"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Amount (₹)
          </span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="50000"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Day of month
          </span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="31"
            value={scheduleDay}
            onChange={(e) =>
              setScheduleDay(
                Math.min(31, Math.max(1, Number(e.target.value) || 1)),
              )
            }
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
      </div>

      {showBackfill && backfillDate && (
        <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-2 text-[11.5px] text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
          <input
            type="checkbox"
            checked={backfill}
            onChange={(e) => setBackfill(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5"
          />
          <span>
            Day {scheduleDay} has already passed this month — also log
            an entry for{" "}
            <strong className="font-semibold">
              {backfillDate.toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
              })}
            </strong>
            ? Future months fire normally.
          </span>
        </label>
      )}

      <label className="block">
        <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Description
        </span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Salary / Rent / SIP / Netflix…"
          maxLength={200}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
      </label>

      <label className="block">
        <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Category
        </span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          {CATEGORY_KEYS.map((k) => {
            const meta = CATEGORIES[k];
            return (
              <option key={k} value={k}>
                {meta.emoji} {meta.label}
              </option>
            );
          })}
        </select>
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !valid}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
        >
          {isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
          {editing ? "Save changes" : "Create"}
        </button>
      </div>
      {!valid && !isPending && (
        <p className="-mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          Enter an amount greater than 0.
        </p>
      )}
    </form>
  );
}
