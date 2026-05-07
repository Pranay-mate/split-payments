"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { equalSplits, type SplitMode } from "@/lib/calculators/trip-split";
import { formatINR } from "@/lib/format";

const EPSILON = 0.01;

type EditingExpense = {
  id: string;
  description: string;
  amount: number;
  payerId: string;
  splitMode: SplitMode;
  splits: { userId: string; amount: number }[];
};

export function AddExpense({
  groupId,
  primaryCurrency,
  members,
  editing,
  onSuccess,
  onCancel,
}: {
  groupId: string;
  primaryCurrency: string;
  members: { id: string; name: string }[];
  editing?: EditingExpense | null;
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const isEditing = Boolean(editing);

  const [description, setDescription] = useState(editing?.description ?? "");
  const [amount, setAmount] = useState<number | "">(editing?.amount ?? "");
  const [payerId, setPayerId] = useState<string>(
    editing?.payerId ?? members[0]?.id ?? "",
  );
  const [splitMode, setSplitMode] = useState<SplitMode>(
    editing?.splitMode ?? "equal",
  );
  const [sharerIds, setSharerIds] = useState<string[]>(
    editing?.splits.map((s) => s.userId) ?? members.map((m) => m.id),
  );
  const [exactByPerson, setExactByPerson] = useState<Record<string, number>>(
    () => {
      if (editing && editing.splitMode === "exact") {
        const m: Record<string, number> = {};
        for (const s of editing.splits) m[s.userId] = s.amount;
        return m;
      }
      return {};
    },
  );

  const numericAmount = typeof amount === "number" ? amount : 0;

  const exactTotal = useMemo(
    () => sharerIds.reduce((sum, id) => sum + (exactByPerson[id] ?? 0), 0),
    [exactByPerson, sharerIds],
  );
  const exactDelta = numericAmount - exactTotal;

  const createMutation = trpc.expenses.create.useMutation({
    onSuccess: () => {
      setDescription("");
      setAmount("");
      setExactByPerson({});
      setSplitMode("equal");
      setSharerIds(members.map((m) => m.id));
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.expenses.update.useMutation({
    onSuccess: () => onSuccess(),
    onError: (err) => toast.error(err.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const buildSplits = () => {
    if (splitMode === "equal") {
      return equalSplits(numericAmount, sharerIds).map((s) => ({
        userId: s.personId,
        amount: s.amount,
      }));
    }
    return sharerIds.map((id) => ({
      userId: id,
      amount: exactByPerson[id] ?? 0,
    }));
  };

  const valid = (() => {
    if (numericAmount <= 0) return false;
    if (!payerId) return false;
    if (sharerIds.length === 0) return false;
    if (splitMode === "exact" && Math.abs(exactDelta) > EPSILON) return false;
    return true;
  })();

  const onSplitModeChange = (mode: SplitMode) => {
    if (mode === "exact" && numericAmount > 0 && sharerIds.length > 0) {
      const per = Math.round((numericAmount / sharerIds.length) * 100) / 100;
      const fresh: Record<string, number> = {};
      for (const id of sharerIds) fresh[id] = per;
      setExactByPerson(fresh);
    }
    setSplitMode(mode);
  };

  const balanceToLast = () => {
    if (sharerIds.length === 0) return;
    const last = sharerIds[sharerIds.length - 1];
    const rest = sharerIds
      .slice(0, -1)
      .reduce((sum, id) => sum + (exactByPerson[id] ?? 0), 0);
    setExactByPerson((m) => ({
      ...m,
      [last]: Math.round((numericAmount - rest) * 100) / 100,
    }));
  };

  const toggleSharer = (id: string) => {
    setSharerIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      if (!next.includes(id)) {
        setExactByPerson((m) => {
          const c = { ...m };
          delete c[id];
          return c;
        });
      }
      return next;
    });
  };

  const allSelected = sharerIds.length === members.length;
  const toggleAll = () => {
    setSharerIds(allSelected ? [] : members.map((m) => m.id));
    if (allSelected) setExactByPerson({});
  };

  const handleSubmit = () => {
    if (!valid) return;
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        description: description.trim(),
        amount: numericAmount,
        payerId,
        splitMode,
        splits: buildSplits(),
      });
    } else {
      createMutation.mutate({
        groupId,
        description: description.trim(),
        amount: numericAmount,
        currency: primaryCurrency as "INR",
        payerId,
        splitMode,
        splits: buildSplits(),
      });
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-800/30">
      {isEditing && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Edit expense</h3>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              <X className="h-3 w-3" aria-hidden /> Cancel
            </button>
          )}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this expense for?"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900"
          aria-label="Expense description"
        />
        <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {primaryCurrency === "INR" ? "₹" : primaryCurrency}
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="0"
            className="w-full bg-transparent text-base outline-none tabular-nums"
            aria-label="Amount"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Paid by
          </span>
          <select
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            Split mode
          </span>
          <div className="mt-1 grid grid-cols-2 gap-1.5 rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            {(["equal", "exact"] as SplitMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onSplitModeChange(mode)}
                aria-pressed={splitMode === mode}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  splitMode === mode
                    ? "bg-emerald-500 text-white"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {mode === "equal" ? "Equal" : "Exact ₹"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            {splitMode === "equal" ? "Split between" : "Each person owes"}
          </span>
          {splitMode === "equal" && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              {allSelected ? "Clear" : "Select all"}
            </button>
          )}
        </div>

        {splitMode === "equal" ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {members.map((m) => {
              const selected = sharerIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleSharer(m.id)}
                  aria-pressed={selected}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    selected
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {members.map((m) => {
              const included = sharerIds.includes(m.id);
              return (
                <div
                  key={m.id}
                  className={`flex items-center gap-2 rounded-lg border p-2 ${
                    included
                      ? "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
                      : "border-slate-200 bg-slate-50/60 opacity-60 dark:border-slate-800 dark:bg-slate-800/40"
                  }`}
                >
                  <label className="flex flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() => toggleSharer(m.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{m.name}</span>
                  </label>
                  {included && (
                    <div className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950">
                      <span className="text-slate-400">
                        {primaryCurrency === "INR" ? "₹" : primaryCurrency}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={1}
                        value={exactByPerson[m.id] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setExactByPerson((map) => ({
                            ...map,
                            [m.id]: v === "" ? 0 : Number(v),
                          }));
                        }}
                        placeholder="0"
                        className="w-20 bg-transparent text-right outline-none tabular-nums"
                        aria-label={`${m.name}'s share`}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">
              <span className="text-slate-600 dark:text-slate-300">
                {formatINR(exactTotal, 2)} of {formatINR(numericAmount, 2)}
                {Math.abs(exactDelta) > EPSILON && (
                  <span className="ml-2 font-medium text-rose-600 dark:text-rose-400">
                    ({exactDelta > 0 ? "+" : "−"}
                    {formatINR(Math.abs(exactDelta), 2)} off)
                  </span>
                )}
              </span>
              {Math.abs(exactDelta) > EPSILON && sharerIds.length > 0 && (
                <button
                  type="button"
                  onClick={balanceToLast}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  Auto-balance
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!valid || isPending}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:bg-slate-300 disabled:dark:bg-slate-700 sm:w-auto ${
          isEditing
            ? "bg-indigo-600 hover:bg-indigo-500"
            : "bg-emerald-600 hover:bg-emerald-500"
        }`}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : isEditing ? null : (
          <Plus className="h-4 w-4" aria-hidden />
        )}
        {isEditing ? "Save changes" : "Add expense"}
      </button>
    </div>
  );
}
