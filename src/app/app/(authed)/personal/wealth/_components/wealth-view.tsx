"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CreditCard,
  Loader2,
  Pencil,
  Plus,
  TrendingDown,
  TrendingUp,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { formatINR } from "@/lib/format";
import { formatDate } from "@/lib/format-date";
import { useUserTimezone } from "@/lib/use-user-timezone";
import { NetWorthTrajectory } from "./net-worth-trajectory";
import { useConfirm } from "@/components/confirm-dialog";
import { SmallSavingsPanel } from "@/components/small-savings-panel";

type HoldingType = "mutual_fund" | "fd" | "stock" | "gold" | "bond" | "other";

const TYPE_LABEL: Record<HoldingType, string> = {
  mutual_fund: "Mutual Fund",
  fd: "FD",
  stock: "Stock",
  gold: "Gold",
  bond: "Bond",
  other: "Other",
};

const TYPE_HEX: Record<HoldingType, string> = {
  mutual_fund: "#6366f1", // indigo
  fd: "#10b981", // emerald
  stock: "#f43f5e", // rose
  gold: "#f59e0b", // amber
  bond: "#06b6d4", // cyan
  other: "#94a3b8", // slate
};

const TYPE_EMOJI: Record<HoldingType, string> = {
  mutual_fund: "📈",
  fd: "🏦",
  stock: "💹",
  gold: "🏅",
  bond: "📜",
  other: "💼",
};

export function WealthView() {
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const userTz = useUserTimezone();

  const netQuery = trpc.personal.holdings.netWorth.useQuery();
  const listQuery = trpc.personal.holdings.list.useQuery();
  const utils = trpc.useUtils();

  const archiveMutation = trpc.personal.holdings.archive.useMutation({
    onSuccess: () => {
      utils.personal.holdings.list.invalidate();
      utils.personal.holdings.netWorth.invalidate();
      utils.personal.holdings.netWorthHistory.invalidate();
      toast.success("Holding archived");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.personal.holdings.delete.useMutation({
    onSuccess: () => {
      utils.personal.holdings.list.invalidate();
      utils.personal.holdings.netWorth.invalidate();
      utils.personal.holdings.netWorthHistory.invalidate();
      toast.success("Holding deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const items = listQuery.data ?? [];
  const summary = netQuery.data;

  const totalForBars = useMemo(() => {
    if (!summary) return 0;
    return summary.byType.reduce((s, x) => s + x.value, 0);
  }, [summary]);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href="/app/personal"
              className="inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden /> Back to Personal
            </Link>
            <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
              <Wallet className="h-5 w-5 text-indigo-500" aria-hidden /> Net worth
            </h1>
          </div>
        </div>

        {/* Hero net-worth card */}
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 p-4 text-white shadow-sm sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
            Net worth
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
            {netQuery.isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin opacity-80" aria-hidden />
            ) : summary ? (
              formatINR(summary.netWorth, 0)
            ) : (
              "—"
            )}
          </p>
          {summary && summary.totalInvested > 0 && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold backdrop-blur">
              {summary.totalGain >= 0 ? (
                <ArrowUp className="h-3 w-3" aria-hidden />
              ) : (
                <ArrowDown className="h-3 w-3" aria-hidden />
              )}
              {summary.totalGain >= 0 ? "+" : "−"}
              {formatINR(Math.abs(summary.totalGain), 0)} (
              {(summary.totalGainPct * 100).toFixed(1)}%) overall
            </p>
          )}

          <div
            className={`mt-4 grid gap-2 text-xs ${
              summary && summary.debtsValue > 0
                ? "grid-cols-3"
                : "grid-cols-2"
            }`}
          >
            <div className="rounded-lg bg-white/15 px-3 py-2 backdrop-blur">
              <p className="text-[10px] uppercase tracking-wider text-white/90">
                Liquid savings
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums sm:text-base">
                {summary ? formatINR(summary.liquidSavings, 0) : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-white/15 px-3 py-2 backdrop-blur">
              <p className="text-[10px] uppercase tracking-wider text-white/90">
                Holdings
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums sm:text-base">
                {summary ? formatINR(summary.holdingsValue, 0) : "—"}
              </p>
            </div>
            {summary && summary.debtsValue > 0 && (
              <div className="rounded-lg bg-rose-500/30 px-3 py-2 backdrop-blur">
                <p className="text-[10px] uppercase tracking-wider text-white/90">
                  Debts
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums sm:text-base">
                  −{formatINR(summary.debtsValue, 0)}
                </p>
              </div>
            )}
          </div>

          <p className="mt-3 text-[10.5px] text-white/90">
            🔐 Each amount is encrypted. Net worth = liquid + holdings
            {summary && summary.debtsValue > 0 ? " − active debts" : ""}.
          </p>
        </section>

        {/* Trajectory chart */}
        <NetWorthTrajectory />

        {/* Type breakdown */}
        {summary && summary.holdingsCount > 0 && totalForBars > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <h2 className="text-sm font-semibold tracking-tight">By type</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {summary.byType.map((b) => {
                const t = b.type as HoldingType;
                const pct = (b.value / totalForBars) * 100;
                return (
                  <li key={t} className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden>{TYPE_EMOJI[t]}</span>
                        {TYPE_LABEL[t]}
                      </span>
                      <span className="tabular-nums text-slate-600 dark:text-slate-300">
                        {formatINR(b.value, 0)}
                        <span className="ml-1 text-[11px] text-slate-400">
                          · {Math.round(pct)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${pct}%`, background: TYPE_HEX[t] }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Holdings list */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <TrendingUp className="h-4 w-4 text-emerald-500" aria-hidden />
              Holdings ({items.length})
            </h2>
            {!adding && !editingId && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add holding
              </button>
            )}
          </div>

          {(adding || editingId) && (
            <HoldingForm
              key={editingId ?? "new"}
              editing={
                editingId ? items.find((i) => i.id === editingId) ?? null : null
              }
              onDone={() => {
                setAdding(false);
                setEditingId(null);
              }}
            />
          )}

          {listQuery.isLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
            </div>
          ) : items.length === 0 ? (
            !adding && (
              <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-indigo-50/40 p-6 text-center dark:border-slate-700 dark:from-slate-900/40 dark:to-indigo-950/20">
                <span
                  aria-hidden
                  className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-xl text-white shadow-sm"
                >
                  📈
                </span>
                <p className="mt-3 text-base font-semibold tracking-tight">
                  Add your first holding
                </p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
                  Mutual funds, FDs, stocks, gold — track total value per
                  holding (no need to log every transaction).
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                  {[
                    { emoji: "🪙", label: "Gold" },
                    { emoji: "📈", label: "MF / SIP" },
                    { emoji: "🏦", label: "FD" },
                    { emoji: "💼", label: "Stocks" },
                  ].map((s) => (
                    <span
                      key={s.label}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <span aria-hidden>{s.emoji}</span>
                      {s.label}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  <Plus className="h-4 w-4" aria-hidden /> Add a holding
                </button>
              </div>
            )
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((h) => {
                const t = h.type as HoldingType;
                const gainTone =
                  h.gain > 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : h.gain < 0
                      ? "text-rose-700 dark:text-rose-400"
                      : "text-slate-500 dark:text-slate-400";
                return (
                  <li
                    key={h.id}
                    className={`flex items-center gap-3 rounded-xl border p-2.5 sm:p-3 ${
                      editingId === h.id
                        ? "border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/30"
                        : "border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg"
                      style={{
                        background: `${TYPE_HEX[t]}20`,
                        color: TYPE_HEX[t],
                      }}
                    >
                      {TYPE_EMOJI[t]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{h.name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {TYPE_LABEL[t]} ·{" "}
                        {h.units < 1000
                          ? `${h.units.toFixed(2)} units`
                          : `${formatINR(h.units, 0)} units`}{" "}
                        · as of {formatDate(h.asOf, userTz, "short")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="whitespace-nowrap text-sm font-bold tabular-nums">
                        {formatINR(h.currentValue, 0)}
                      </span>
                      <span
                        className={`whitespace-nowrap text-[11px] font-medium tabular-nums ${gainTone}`}
                      >
                        {h.gain >= 0 ? "+" : "−"}
                        {formatINR(Math.abs(h.gain), 0)}
                        {" "}({(h.gainPct * 100).toFixed(1)}%)
                      </span>
                      <div className="flex gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAdding(false);
                            setEditingId(h.id);
                          }}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"
                          aria-label="Edit holding"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => archiveMutation.mutate({ id: h.id })}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"
                          aria-label="Archive (sold/closed)"
                          title="Archive — for sold or closed positions"
                        >
                          <Archive className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              await confirm({
                                title: `Delete "${h.name}"?`,
                                description:
                                  "Permanently removes this holding from your net worth. This cannot be undone — archive instead if you might want it back.",
                                confirmLabel: "Delete",
                                destructive: true,
                              })
                            ) {
                              deleteMutation.mutate({ id: h.id });
                            }
                          }}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40"
                          aria-label="Delete holding"
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
        </section>

        <DebtsSection />

        <SmallSavingsPanel />
      </div>
    </main>
  );
}

function HoldingForm({
  editing,
  onDone,
}: {
  editing: {
    id: string;
    name: string;
    type: HoldingType;
    units: number;
    avgCost: number;
    currentValue: number;
    asOf: Date;
    notes: string;
  } | null;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<HoldingType>(editing?.type ?? "mutual_fund");
  const [units, setUnits] = useState<number | "">(editing?.units ?? "");
  const [avgCost, setAvgCost] = useState<number | "">(editing?.avgCost ?? "");
  const [currentValue, setCurrentValue] = useState<number | "">(
    editing?.currentValue ?? "",
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");
  // Most holdings only need name + type + current value. Units / avg
  // cost / notes are useful for stocks & MFs where you want gain/loss
  // — hide them until the user asks. Pre-expanded when editing a row
  // that already has any of those fields set, so the user sees what's
  // there without an extra tap.
  const [showDetails, setShowDetails] = useState<boolean>(
    Boolean(
      editing &&
        (editing.units != null ||
          editing.avgCost != null ||
          (editing.notes && editing.notes.length > 0)),
    ),
  );

  const createMutation = trpc.personal.holdings.create.useMutation({
    onSuccess: () => {
      utils.personal.holdings.list.invalidate();
      utils.personal.holdings.netWorth.invalidate();
      utils.personal.holdings.netWorthHistory.invalidate();
      toast.success("Holding added");
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.personal.holdings.update.useMutation({
    onSuccess: () => {
      utils.personal.holdings.list.invalidate();
      utils.personal.holdings.netWorth.invalidate();
      utils.personal.holdings.netWorthHistory.invalidate();
      toast.success("Holding updated");
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !name.trim() ||
      units === "" ||
      avgCost === "" ||
      currentValue === ""
    ) {
      toast.error("Fill name, units, avg cost, current value");
      return;
    }
    if (Number(units) <= 0) {
      toast.error("Units must be > 0");
      return;
    }
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        name: name.trim(),
        type,
        units: Number(units),
        avgCost: Number(avgCost),
        currentValue: Number(currentValue),
        notes,
      });
    } else {
      createMutation.mutate({
        name: name.trim(),
        type,
        units: Number(units),
        avgCost: Number(avgCost),
        currentValue: Number(currentValue),
        notes,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form
      onSubmit={submit}
      className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-700 dark:bg-slate-800/40"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {editing ? "Edit holding" : "New holding"}
        </p>
        <button
          type="button"
          onClick={onDone}
          className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <label className="block">
        <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Parag Parikh Flexi Cap, SBI FD #1, INFY"
          autoFocus
          maxLength={80}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
      </label>

      <label className="block">
        <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Type
        </span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as HoldingType)}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          {(
            [
              "mutual_fund",
              "fd",
              "stock",
              "gold",
              "bond",
              "other",
            ] as HoldingType[]
          ).map((t) => (
            <option key={t} value={t}>
              {TYPE_EMOJI[t]} {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Current total value (₹)
          <span className="ml-1 font-normal text-slate-400">
            — what it&apos;s worth today
          </span>
        </span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={currentValue}
          onChange={(e) =>
            setCurrentValue(
              e.target.value === "" ? "" : Number(e.target.value),
            )
          }
          placeholder="55000"
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
      </label>

      {!showDetails ? (
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="flex w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left text-[11.5px] text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/20"
        >
          <span className="min-w-0 flex-1 truncate">
            Add units, avg cost, notes
            <span className="ml-1 text-slate-400">
              (optional — for gain/loss tracking)
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        </button>
      ) : (
      <>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Units / qty
          </span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={units}
            onChange={(e) =>
              setUnits(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="100.5"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Avg cost / unit (₹)
          </span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={avgCost}
            onChange={(e) =>
              setAvgCost(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="500"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Notes (optional)
        </span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ELSS lock-in until 2027 / Tax-saver / 5-year FD"
          maxLength={200}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
      </label>
      </>
      )}

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
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
        >
          {isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
          {editing ? "Save changes" : "Add holding"}
        </button>
      </div>
    </form>
  );
}

/* ----- Debts section (Phase 2.5 v5.2) ----------------------------------- */

type DebtType = "home" | "car" | "personal" | "education" | "credit_card" | "other";

const DEBT_LABEL: Record<DebtType, string> = {
  home: "Home loan",
  car: "Car loan",
  personal: "Personal loan",
  education: "Education loan",
  credit_card: "Credit card",
  other: "Other",
};

const DEBT_EMOJI: Record<DebtType, string> = {
  home: "🏠",
  car: "🚗",
  personal: "👤",
  education: "🎓",
  credit_card: "💳",
  other: "📄",
};

function DebtsSection() {
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const listQuery = trpc.personal.debts.list.useQuery();
  const utils = trpc.useUtils();

  const archiveMutation = trpc.personal.debts.archive.useMutation({
    onSuccess: () => {
      utils.personal.debts.list.invalidate();
      utils.personal.holdings.netWorth.invalidate();
      utils.personal.holdings.netWorthHistory.invalidate();
      toast.success("Debt archived");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.personal.debts.delete.useMutation({
    onSuccess: () => {
      utils.personal.debts.list.invalidate();
      utils.personal.holdings.netWorth.invalidate();
      utils.personal.holdings.netWorthHistory.invalidate();
      toast.success("Debt deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const items = listQuery.data ?? [];
  const editing = editingId ? items.find((d) => d.id === editingId) ?? null : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <CreditCard className="h-4 w-4 text-rose-500" aria-hidden />
          Debts ({items.length})
        </h2>
        {!adding && !editingId && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add debt
          </button>
        )}
      </div>

      {(adding || editing) && (
        <DebtForm
          key={editingId ?? "new"}
          editing={editing}
          onCancel={() => {
            setAdding(false);
            setEditingId(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditingId(null);
          }}
        />
      )}

      {!adding && !editingId && items.length === 0 ? (
        <p className="mt-4 text-center text-[12.5px] text-slate-500 dark:text-slate-400">
          No debts tracked. Add a home loan, EMI, or any loan and we&apos;ll
          subtract the outstanding balance from net worth and project it
          shrinking month-by-month.
        </p>
      ) : (
        !adding &&
        !editingId && (
          <ul className="mt-3 space-y-2">
            {items.map((d) => {
              const dt = d.debtType as DebtType;
              return (
                <li
                  key={d.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-800/30"
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-100 text-base text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                    >
                      {DEBT_EMOJI[dt]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="truncate text-sm font-semibold">
                          {d.name}
                        </span>
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {DEBT_LABEL[dt]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        EMI {formatINR(d.emi, 0)} · {d.annualRatePct}% p.a.
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {d.isUnderwater ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            ⚠ EMI doesn&apos;t cover interest — balance is
                            growing.
                          </span>
                        ) : d.monthsRemaining === null ? (
                          ""
                        ) : d.monthsRemaining === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            Fully paid off
                          </span>
                        ) : (
                          <>
                            {Math.floor(d.monthsRemaining / 12)}y{" "}
                            {d.monthsRemaining % 12}m left
                            {d.finishDate && (
                              <>
                                {" "}
                                · debt-free{" "}
                                {d.finishDate.toLocaleDateString(undefined, {
                                  month: "short",
                                  year: "numeric",
                                })}
                              </>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                        −{formatINR(d.currentOutstanding, 0)}
                      </p>
                      <p className="text-[10px] text-slate-400">outstanding</p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(d.id)}
                      className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-950/40"
                      aria-label="Edit debt"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: `Archive "${d.name}"?`,
                            description:
                              "Stops counting toward net worth but isn't deleted. Useful for closed/paid-off loans you want to remember.",
                            confirmLabel: "Archive",
                            destructive: true,
                          })
                        ) {
                          archiveMutation.mutate({ id: d.id });
                        }
                      }}
                      className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-950/40"
                      aria-label="Archive debt"
                      title="Archive"
                    >
                      <Archive className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: `Delete "${d.name}"?`,
                            description:
                              "Permanently removes this debt from your records. Archive instead if you might want it back.",
                            confirmLabel: "Delete",
                            destructive: true,
                          })
                        ) {
                          deleteMutation.mutate({ id: d.id });
                        }
                      }}
                      className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40"
                      aria-label="Delete debt"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}
    </section>
  );
}

function DebtForm({
  editing,
  onCancel,
  onSaved,
}: {
  editing: {
    id: string;
    name: string;
    debtType: DebtType;
    principal: number;
    emi: number;
    annualRatePct: number;
    startDate: Date;
  } | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isEditing = Boolean(editing);
  const [name, setName] = useState(editing?.name ?? "");
  const [debtType, setDebtType] = useState<DebtType>(editing?.debtType ?? "home");
  const [principal, setPrincipal] = useState<number | "">(editing?.principal ?? "");
  const [emi, setEmi] = useState<number | "">(editing?.emi ?? "");
  const [rate, setRate] = useState<number | "">(editing?.annualRatePct ?? "");

  const utils = trpc.useUtils();
  const createMutation = trpc.personal.debts.create.useMutation({
    onSuccess: () => {
      utils.personal.debts.list.invalidate();
      utils.personal.holdings.netWorth.invalidate();
      utils.personal.holdings.netWorthHistory.invalidate();
      toast.success("Debt added");
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.personal.debts.update.useMutation({
    onSuccess: () => {
      utils.personal.debts.list.invalidate();
      utils.personal.holdings.netWorth.invalidate();
      utils.personal.holdings.netWorthHistory.invalidate();
      toast.success("Debt updated");
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });

  const numericPrincipal = typeof principal === "number" ? principal : 0;
  const numericEmi = typeof emi === "number" ? emi : 0;
  const numericRate = typeof rate === "number" ? rate : 0;
  const valid =
    name.trim().length > 0 &&
    numericPrincipal > 0 &&
    numericEmi > 0 &&
    numericRate >= 0;

  // Live preview: at current inputs, what does the math say about
  // months-to-freedom and EMI sufficiency? Helps users catch typos
  // before saving (e.g. EMI < interest = predatory).
  const preview = (() => {
    if (!valid) return null;
    const r = numericRate / 12 / 100;
    if (numericEmi <= numericPrincipal * r) {
      return { underwater: true, monthsLeft: null };
    }
    const monthsLeft =
      r === 0
        ? Math.ceil(numericPrincipal / numericEmi)
        : Math.ceil(
            Math.log(numericEmi / (numericEmi - numericPrincipal * r)) /
              Math.log(1 + r),
          );
    return { underwater: false, monthsLeft };
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    if (editing) {
      await updateMutation.mutateAsync({
        id: editing.id,
        name: name.trim(),
        debtType,
        principal: numericPrincipal,
        emi: numericEmi,
        annualRatePct: numericRate,
      });
    } else {
      await createMutation.mutateAsync({
        name: name.trim(),
        debtType,
        principal: numericPrincipal,
        emi: numericEmi,
        annualRatePct: numericRate,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-rose-200 bg-rose-50/40 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="HDFC Home Loan"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            maxLength={80}
          />
        </label>
        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
          Type
          <select
            value={debtType}
            onChange={(e) => setDebtType(e.target.value as DebtType)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {(Object.keys(DEBT_LABEL) as DebtType[]).map((t) => (
              <option key={t} value={t}>
                {DEBT_EMOJI[t]} {DEBT_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
          Outstanding (₹)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            value={principal}
            onChange={(e) =>
              setPrincipal(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="4000000"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
          Monthly EMI (₹)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            value={emi}
            onChange={(e) =>
              setEmi(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="35000"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
          Interest rate (% p.a.)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={99.99}
            step={0.01}
            value={rate}
            onChange={(e) =>
              setRate(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="8.5"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>

      {preview && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11.5px] dark:border-slate-700 dark:bg-slate-900">
          {preview.underwater ? (
            <p className="text-rose-600 dark:text-rose-400">
              ⚠ EMI ≤ monthly interest — at these numbers the balance
              would grow, not shrink. Double-check your inputs.
            </p>
          ) : (
            <p className="text-slate-600 dark:text-slate-300">
              <TrendingDown className="-mt-0.5 mr-1 inline h-3 w-3 text-emerald-600" aria-hidden />
              At this EMI + rate, debt-free in{" "}
              <strong>
                {Math.floor((preview.monthsLeft ?? 0) / 12)}y{" "}
                {(preview.monthsLeft ?? 0) % 12}m
              </strong>{" "}
              ({preview.monthsLeft} EMIs).
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!valid || isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {isEditing ? "Save changes" : "Add debt"}
        </button>
      </div>
    </form>
  );
}
