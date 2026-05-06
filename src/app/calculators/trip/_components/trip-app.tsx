"use client";

import { useMemo, useState } from "react";
import { Trash2, Users, Receipt, Plus, ArrowRight, RotateCcw } from "lucide-react";
import { useTripState } from "./use-trip-state";
import { summariseTrip } from "@/lib/calculators/trip-split";
import { formatINR } from "@/lib/format";

export function TripApp() {
  const [state, dispatch] = useTripState();
  const summary = useMemo(
    () => summariseTrip(state.people, state.expenses),
    [state.people, state.expenses],
  );

  const personNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of state.people) m.set(p.id, p.name);
    return m;
  }, [state.people]);

  return (
    <div className="space-y-6">
      <TripHeader
        tripName={state.tripName}
        peopleCount={state.people.length}
        expenseCount={state.expenses.length}
        totalSpent={summary.totalSpent}
        onRename={(name) => dispatch({ type: "set-trip-name", name })}
        onReset={() => {
          if (confirm("Clear all people and expenses for this trip?")) {
            dispatch({ type: "reset" });
          }
        }}
      />

      <PeopleSection
        people={state.people}
        onAdd={(name) => dispatch({ type: "add-person", name })}
        onRemove={(id) => dispatch({ type: "remove-person", id })}
      />

      <ExpensesSection
        people={state.people}
        expenses={state.expenses}
        personNameById={personNameById}
        onAdd={(expense) => dispatch({ type: "add-expense", expense })}
        onRemove={(id) => dispatch({ type: "remove-expense", id })}
      />

      {state.people.length > 0 && state.expenses.length > 0 && (
        <ResultsSection
          summary={summary}
          personNameById={personNameById}
        />
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
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1 text-sm dark:border-slate-700 dark:bg-slate-800"
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

function ExpensesSection({
  people,
  expenses,
  personNameById,
  onAdd,
  onRemove,
}: {
  people: { id: string; name: string }[];
  expenses: import("@/lib/calculators/trip-split").Expense[];
  personNameById: Map<string, string>;
  onAdd: (expense: Omit<import("@/lib/calculators/trip-split").Expense, "id">) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Receipt className="h-4 w-4 text-emerald-500" aria-hidden />
        Expenses
      </h2>

      {people.length < 1 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Add at least one person first.
        </p>
      ) : (
        <ExpenseForm people={people} onAdd={onAdd} />
      )}

      {expenses.length > 0 && (
        <ul className="mt-5 space-y-2">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {e.description || "Expense"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {personNameById.get(e.payerId) ?? "Unknown"} paid{" "}
                  {formatINR(e.amount, 0)} · split among {e.sharerIds.length}{" "}
                  {e.sharerIds.length === 1 ? "person" : "people"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(e.id)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                aria-label="Remove expense"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ExpenseForm({
  people,
  onAdd,
}: {
  people: { id: string; name: string }[];
  onAdd: (expense: Omit<import("@/lib/calculators/trip-split").Expense, "id">) => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [payerId, setPayerId] = useState<string>(people[0]?.id ?? "");
  const [sharerIds, setSharerIds] = useState<string[]>(people.map((p) => p.id));

  // Keep payer + sharers in sync if people list changes (rare during normal use).
  if (payerId && !people.some((p) => p.id === payerId)) {
    setPayerId(people[0]?.id ?? "");
  }
  if (sharerIds.some((id) => !people.some((p) => p.id === id))) {
    setSharerIds(sharerIds.filter((id) => people.some((p) => p.id === id)));
  }

  const handleAdd = () => {
    if (typeof amount !== "number" || amount <= 0) return;
    if (!payerId) return;
    if (sharerIds.length === 0) return;

    onAdd({
      description: description.trim(),
      amount,
      payerId,
      sharerIds,
    });
    setDescription("");
    setAmount("");
  };

  const toggleSharer = (id: string) => {
    setSharerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const allSelected = sharerIds.length === people.length;
  const toggleAll = () => {
    setSharerIds(allSelected ? [] : people.map((p) => p.id));
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-800/30">
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

      <div className="grid gap-2 sm:grid-cols-2">
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
          <div className="flex items-baseline justify-between">
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Split between
            </span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              {allSelected ? "Clear" : "Select all"}
            </button>
          </div>
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
        </div>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={typeof amount !== "number" || amount <= 0 || sharerIds.length === 0}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:bg-slate-300 disabled:dark:bg-slate-700 sm:w-auto"
      >
        <Plus className="h-4 w-4" aria-hidden /> Add expense
      </button>
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
