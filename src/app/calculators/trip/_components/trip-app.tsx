"use client";

import { useMemo, useRef, useState } from "react";
import {
  Trash2,
  Users,
  Receipt,
  Plus,
  ArrowRight,
  RotateCcw,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTripState, type ExpenseInput } from "./use-trip-state";
import {
  equalSplits,
  summariseTrip,
  type Expense,
  type SplitMode,
} from "@/lib/calculators/trip-split";
import { formatINR } from "@/lib/format";

const EPSILON = 0.01;

export function TripApp() {
  const [state, dispatch] = useTripState();
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  const summary = useMemo(
    () => summariseTrip(state.people, state.expenses),
    [state.people, state.expenses],
  );

  const personNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of state.people) m.set(p.id, p.name);
    return m;
  }, [state.people]);

  const editingExpense = useMemo(
    () => (editingId ? state.expenses.find((e) => e.id === editingId) : null),
    [editingId, state.expenses],
  );

  return (
    <div className="space-y-6">
      <TripHeader
        tripName={state.tripName}
        peopleCount={state.people.length}
        expenseCount={state.expenses.length}
        totalSpent={summary.totalSpent}
        onRename={(name) => dispatch({ type: "set-trip-name", name })}
        onReset={() => {
          toast("Reset this trip?", {
            description: "All people and expenses will be cleared.",
            action: {
              label: "Reset",
              onClick: () => {
                dispatch({ type: "reset" });
                setEditingId(null);
                toast.success("Trip reset");
              },
            },
          });
        }}
      />

      <PeopleSection
        people={state.people}
        onAdd={(name) => {
          const trimmed = name.trim();
          if (!trimmed) return;
          const dup = state.people.some(
            (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
          );
          if (dup) {
            toast.error(`${trimmed} is already in this trip`);
            return;
          }
          dispatch({ type: "add-person", name: trimmed });
        }}
        onRemove={(id) => {
          const person = state.people.find((p) => p.id === id);
          dispatch({ type: "remove-person", id });
          if (editingExpense?.payerId === id) setEditingId(null);
          if (person) {
            toast.success(`Removed ${person.name}`, {
              description: "Their expenses and shares were cleared.",
            });
          }
        }}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Receipt className="h-4 w-4 text-emerald-500" aria-hidden />
          Expenses
        </h2>

        {state.people.length < 1 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Add at least one person first.
          </p>
        ) : (
          <div ref={formRef}>
            <ExpenseForm
              key={editingId ?? "new"}
              people={state.people}
              editingExpense={editingExpense ?? null}
              onSubmit={(input) => {
                if (editingId) {
                  dispatch({ type: "update-expense", id: editingId, expense: input });
                  setEditingId(null);
                  toast.success("Expense updated");
                } else {
                  dispatch({ type: "add-expense", expense: input });
                  toast.success(
                    input.description
                      ? `Added “${input.description}”`
                      : "Expense added",
                  );
                }
              }}
              onCancel={editingId ? () => setEditingId(null) : undefined}
            />
          </div>
        )}

        {state.expenses.length > 0 && (
          <ul className="mt-5 space-y-2">
            {state.expenses.map((e) => (
              <ExpenseRow
                key={e.id}
                expense={e}
                personNameById={personNameById}
                isEditing={editingId === e.id}
                onEdit={() => {
                  setEditingId(e.id);
                  setTimeout(() => {
                    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 50);
                }}
                onRemove={() => {
                  const removed = e;
                  dispatch({ type: "remove-expense", id: e.id });
                  if (editingId === e.id) setEditingId(null);
                  toast.success(
                    removed.description
                      ? `Removed “${removed.description}”`
                      : "Expense removed",
                    {
                      action: {
                        label: "Undo",
                        onClick: () => {
                          dispatch({
                            type: "add-expense",
                            expense: {
                              description: removed.description,
                              amount: removed.amount,
                              payerId: removed.payerId,
                              splitMode: removed.splitMode,
                              splits: removed.splits,
                            },
                          });
                        },
                      },
                    },
                  );
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {state.people.length > 0 && state.expenses.length > 0 && (
        <ResultsSection summary={summary} personNameById={personNameById} />
      )}
    </div>
  );
}

function TripHeader({
  tripName,
  peopleCount,
  expenseCount,
  totalSpent,
  onRename,
  onReset,
}: {
  tripName: string;
  peopleCount: number;
  expenseCount: number;
  totalSpent: number;
  onRename: (name: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <input
        value={tripName}
        onChange={(e) => onRename(e.target.value)}
        placeholder="Trip name"
        className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-slate-400"
        aria-label="Trip name"
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
        <span>
          {peopleCount} {peopleCount === 1 ? "person" : "people"}
        </span>
        <span>
          {expenseCount} {expenseCount === 1 ? "expense" : "expenses"}
        </span>
        <span>{formatINR(totalSpent, 0)} spent</span>
        {(peopleCount > 0 || expenseCount > 0) && (
          <button
            type="button"
            onClick={onReset}
            className="ml-auto inline-flex items-center gap-1.5 text-xs hover:text-slate-700 dark:hover:text-slate-200"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset
          </button>
        )}
      </div>
    </div>
  );
}

function PeopleSection({
  people,
  onAdd,
  onRemove,
}: {
  people: { id: string; name: string }[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Users className="h-4 w-4 text-indigo-500" aria-hidden />
        People
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) {
            onAdd(draft);
            setDraft("");
          }
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a person…"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900"
          aria-label="New person name"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add
        </button>
      </form>

      {people.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Add everyone in the trip first.
        </p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-2">
          {people.map((p) => (
            <li
              key={p.id}
              className="animate-row-in inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <span>{p.name}</span>
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                className="grid h-6 w-6 place-items-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                aria-label={`Remove ${p.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ExpenseRow({
  expense,
  personNameById,
  isEditing,
  onEdit,
  onRemove,
}: {
  expense: Expense;
  personNameById: Map<string, string>;
  isEditing: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      className={`animate-row-in flex items-start justify-between gap-3 rounded-xl border p-3 transition ${
        isEditing
          ? "border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/30"
          : "border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {expense.description || "Expense"}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {personNameById.get(expense.payerId) ?? "Unknown"} paid{" "}
          {formatINR(expense.amount, 0)} · {expense.splitMode === "exact" ? "exact" : "equal"} split among {expense.splits.length}{" "}
          {expense.splits.length === 1 ? "person" : "people"}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-pressed={isEditing}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
            isEditing
              ? "bg-indigo-500 text-white"
              : "text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          }`}
          aria-label="Edit expense"
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          aria-label="Remove expense"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}

function ExpenseForm({
  people,
  editingExpense,
  onSubmit,
  onCancel,
}: {
  people: { id: string; name: string }[];
  editingExpense: Expense | null;
  onSubmit: (input: ExpenseInput) => void;
  onCancel?: () => void;
}) {
  const isEditing = editingExpense !== null;

  // Initial state — pulled from editingExpense if present.
  const [description, setDescription] = useState(editingExpense?.description ?? "");
  const [amount, setAmount] = useState<number | "">(editingExpense?.amount ?? "");
  const [payerId, setPayerId] = useState<string>(
    editingExpense?.payerId ?? people[0]?.id ?? "",
  );
  const [splitMode, setSplitMode] = useState<SplitMode>(
    editingExpense?.splitMode ?? "equal",
  );
  const [sharerIds, setSharerIds] = useState<string[]>(
    editingExpense?.splits.map((s) => s.personId) ?? people.map((p) => p.id),
  );
  const [exactByPerson, setExactByPerson] = useState<Record<string, number>>(() => {
    if (editingExpense && editingExpense.splitMode === "exact") {
      const m: Record<string, number> = {};
      for (const s of editingExpense.splits) m[s.personId] = s.amount;
      return m;
    }
    return {};
  });

  // Drop sharers / payer that no longer exist. Computed during render rather
  // than in an effect — React 19's set-state-in-effect rule pushes us this way.
  const safePayerId =
    payerId && people.some((p) => p.id === payerId)
      ? payerId
      : people[0]?.id ?? "";
  if (safePayerId !== payerId) setPayerId(safePayerId);

  const safeSharerIds = sharerIds.filter((id) => people.some((p) => p.id === id));
  if (safeSharerIds.length !== sharerIds.length) setSharerIds(safeSharerIds);

  const numericAmount = typeof amount === "number" ? amount : 0;

  const exactTotal = useMemo(() => {
    return sharerIds.reduce((sum, id) => sum + (exactByPerson[id] ?? 0), 0);
  }, [exactByPerson, sharerIds]);
  const exactDelta = numericAmount - exactTotal;

  const computeSplits = (): { description: string; amount: number; payerId: string; splitMode: SplitMode; splits: { personId: string; amount: number }[] } | null => {
    if (numericAmount <= 0) return null;
    if (!payerId) return null;
    if (sharerIds.length === 0) return null;

    if (splitMode === "equal") {
      return {
        description: description.trim(),
        amount: numericAmount,
        payerId,
        splitMode: "equal",
        splits: equalSplits(numericAmount, sharerIds),
      };
    }
    // exact
    if (Math.abs(exactDelta) > EPSILON) return null;
    const splits = sharerIds.map((id) => ({
      personId: id,
      amount: round2(exactByPerson[id] ?? 0),
    }));
    return {
      description: description.trim(),
      amount: numericAmount,
      payerId,
      splitMode: "exact",
      splits,
    };
  };

  const valid = computeSplits() !== null;

  const handleSubmit = () => {
    const input = computeSplits();
    if (!input) return;
    onSubmit(input);
    if (!isEditing) {
      setDescription("");
      setAmount("");
      setExactByPerson({});
      setSplitMode("equal");
      setSharerIds(people.map((p) => p.id));
    }
  };

  const toggleSharer = (id: string) => {
    setSharerIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // clean exact map of removed sharers
      if (!next.includes(id)) {
        setExactByPerson((m) => {
          const copy = { ...m };
          delete copy[id];
          return copy;
        });
      }
      return next;
    });
  };

  const allSelected = sharerIds.length === people.length;
  const toggleAll = () => {
    setSharerIds(allSelected ? [] : people.map((p) => p.id));
    if (allSelected) setExactByPerson({});
  };

  // When user switches to exact, prefill from equal.
  const onSplitModeChange = (mode: SplitMode) => {
    if (mode === "exact" && numericAmount > 0 && sharerIds.length > 0) {
      const per = round2(numericAmount / sharerIds.length);
      const fresh: Record<string, number> = {};
      for (const id of sharerIds) fresh[id] = per;
      setExactByPerson(fresh);
    }
    setSplitMode(mode);
  };

  // Auto-balance: distribute remainder to last sharer.
  const balanceToLast = () => {
    if (sharerIds.length === 0) return;
    const last = sharerIds[sharerIds.length - 1];
    const rest = sharerIds
      .slice(0, -1)
      .reduce((sum, id) => sum + (exactByPerson[id] ?? 0), 0);
    setExactByPerson((m) => ({ ...m, [last]: round2(numericAmount - rest) }));
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-800/30">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {isEditing ? "Edit expense" : "Add expense"}
        </h3>
        {isEditing && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <X className="h-3 w-3" aria-hidden /> Cancel
          </button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this expense for?"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900"
          aria-label="Expense description"
        />
        <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          <span className="text-sm text-slate-500 dark:text-slate-400">₹</span>
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
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
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
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                  splitMode === mode
                    ? "bg-indigo-500 text-white"
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
            {splitMode === "equal" ? "Split between" : "Amounts each person owes"}
          </span>
          {splitMode === "equal" && (
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              {allSelected ? "Clear" : "Select all"}
            </button>
          )}
        </div>

        {splitMode === "equal" ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {people.map((p) => {
              const selected = sharerIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleSharer(p.id)}
                  aria-pressed={selected}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    selected
                      ? "border-indigo-500 bg-indigo-500 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {people.map((p) => {
              const included = sharerIds.includes(p.id);
              return (
                <div
                  key={p.id}
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
                      onChange={() => toggleSharer(p.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{p.name}</span>
                  </label>
                  {included && (
                    <div className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950">
                      <span className="text-slate-400">₹</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={1}
                        value={exactByPerson[p.id] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setExactByPerson((m) => ({
                            ...m,
                            [p.id]: v === "" ? 0 : Number(v),
                          }));
                        }}
                        placeholder="0"
                        className="w-20 bg-transparent text-right outline-none tabular-nums"
                        aria-label={`${p.name}'s share`}
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
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Auto-balance
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!valid}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition ${
            isEditing
              ? "bg-indigo-600 hover:bg-indigo-500"
              : "bg-emerald-600 hover:bg-emerald-500"
          } disabled:bg-slate-300 disabled:dark:bg-slate-700`}
        >
          {isEditing ? (
            <>Save changes</>
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden /> Add expense
            </>
          )}
        </button>
        {!valid && splitMode === "exact" && Math.abs(exactDelta) > EPSILON && numericAmount > 0 && (
          <span className="text-xs text-rose-600 dark:text-rose-400">
            Amounts must add up to ₹{numericAmount}
          </span>
        )}
      </div>
    </div>
  );
}

function ResultsSection({
  summary,
  personNameById,
}: {
  summary: ReturnType<typeof summariseTrip>;
  personNameById: Map<string, string>;
}) {
  const settlementText = useMemo(() => {
    if (summary.settlements.length === 0) return "Everyone is settled. ";
    return summary.settlements
      .map(
        (s) =>
          `${personNameById.get(s.fromPersonId) ?? "?"} → ${personNameById.get(s.toPersonId) ?? "?"}: ${formatINR(s.amount, 0)}`,
      )
      .join("\n");
  }, [summary.settlements, personNameById]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold tracking-tight">Balances</h2>
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {summary.balances.map((b) => {
            const isOwed = b.amount > 0.01;
            const owes = b.amount < -0.01;
            return (
              <li
                key={b.personId}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="font-medium">
                  {personNameById.get(b.personId) ?? "?"}
                </span>
                <span
                  className={`tabular-nums ${
                    isOwed
                      ? "text-emerald-600 dark:text-emerald-400"
                      : owes
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {isOwed
                    ? `gets ${formatINR(b.amount, 0)}`
                    : owes
                    ? `owes ${formatINR(-b.amount, 0)}`
                    : "settled"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-emerald-50 p-5 dark:border-slate-800 dark:from-indigo-950/40 dark:to-emerald-950/40">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Simplified payments</h2>
          {summary.settlements.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(settlementText).catch(() => {});
                }
              }}
              className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Copy
            </button>
          )}
        </div>

        {summary.settlements.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            Everyone is settled — no transfers needed.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {summary.settlements.map((s, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="font-medium">
                    {personNameById.get(s.fromPersonId) ?? "?"}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
                  <span className="font-medium">
                    {personNameById.get(s.toPersonId) ?? "?"}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
                  {formatINR(s.amount, 0)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {summary.settlements.length > 0 && (
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            {summary.settlements.length} transfer
            {summary.settlements.length === 1 ? "" : "s"} settles everyone — minimum needed.
          </p>
        )}
      </section>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
