"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Receipt,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import {
  summariseTrip,
  type Expense as TripExpense,
  type Person,
} from "@/lib/calculators/trip-split";
import { formatINR } from "@/lib/format";
import { AddExpense } from "./add-expense";
import { BalancesView } from "./balances-view";

export function GroupDetail({ groupId }: { groupId: string }) {
  const [adding, setAdding] = useState(false);

  const groupQuery = trpc.groups.byId.useQuery({ id: groupId });
  const membersQuery = trpc.groups.members.useQuery({ groupId });
  const expensesQuery = trpc.expenses.listByGroup.useQuery({ groupId });
  const settlementsQuery = trpc.settlements.listByGroup.useQuery({ groupId });
  const utils = trpc.useUtils();

  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      utils.expenses.listByGroup.invalidate({ groupId });
      toast.success("Expense removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const memberById = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    for (const member of membersQuery.data ?? []) {
      m.set(member.userId, { id: member.userId, name: member.displayName });
    }
    return m;
  }, [membersQuery.data]);

  const summary = useMemo(() => {
    if (!membersQuery.data || !expensesQuery.data) return null;
    const people: Person[] = membersQuery.data.map((m) => ({
      id: m.userId,
      name: m.displayName,
    }));
    const tripExpenses: TripExpense[] = expensesQuery.data.map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.convertedAmount,
      payerId: e.payerId,
      splitMode: e.splitMode,
      splits: e.splits.map((s) => ({
        personId: s.userId,
        amount: s.amount,
      })),
    }));
    const recordedSettlements = (settlementsQuery.data ?? []).map((s) => ({
      fromPersonId: s.fromUserId,
      toPersonId: s.toUserId,
      amount: s.amount,
    }));
    return summariseTrip(people, tripExpenses, recordedSettlements);
  }, [membersQuery.data, expensesQuery.data, settlementsQuery.data]);

  const copyInviteLink = async () => {
    if (!groupQuery.data) return;
    const url = `${window.location.origin}/app/join/${groupQuery.data.inviteToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy. Try again.");
    }
  };

  if (groupQuery.isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden />
      </main>
    );
  }

  if (groupQuery.error || !groupQuery.data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link
          href="/app/groups"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to groups
        </Link>
        <p className="mt-6 text-sm text-rose-600 dark:text-rose-400">
          {groupQuery.error?.message ?? "Group not found."}
        </p>
      </main>
    );
  }

  const group = groupQuery.data;
  const members = membersQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/app/groups"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All groups
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {group.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  {members.length} {members.length === 1 ? "member" : "members"}
                </span>
                <span>{expenses.length} {expenses.length === 1 ? "expense" : "expenses"}</span>
                <span>{formatINR(summary?.totalSpent ?? 0, 0)} total · {group.primaryCurrency}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={copyInviteLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden /> Invite
            </button>
          </div>
        </div>

        {summary && summary.balances.length > 0 && (
          <BalancesView
            groupId={groupId}
            summary={summary}
            memberById={memberById}
            recorded={settlementsQuery.data ?? []}
          />
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Receipt className="h-4 w-4 text-emerald-500" aria-hidden />
              Expenses
            </h2>
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {adding ? "Cancel" : "Add expense"}
            </button>
          </div>

          {adding && (
            <div className="mt-4">
              <AddExpense
                groupId={groupId}
                primaryCurrency={group.primaryCurrency}
                members={members.map((m) => ({ id: m.userId, name: m.displayName }))}
                onSuccess={() => {
                  utils.expenses.listByGroup.invalidate({ groupId });
                  setAdding(false);
                  toast.success("Expense added");
                }}
              />
            </div>
          )}

          {expensesQuery.isLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
            </div>
          ) : expenses.length === 0 ? (
            !adding && (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                No expenses yet — add the first one to start splitting.
              </p>
            )
          ) : (
            <ul className="mt-4 space-y-2">
              {expenses.map((e) => {
                const payerName = memberById.get(e.payerId)?.name ?? "?";
                return (
                  <li
                    key={e.id}
                    className="animate-row-in flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {e.description || "Expense"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {payerName} paid {formatINR(e.convertedAmount, 0)} ·{" "}
                        {e.splitMode === "exact" ? "exact" : "equal"} split
                        among {e.splits.length}{" "}
                        {e.splits.length === 1 ? "person" : "people"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Remove this expense?")) {
                          deleteMutation.mutate({ id: e.id });
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                      aria-label="Remove expense"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Users className="h-4 w-4 text-indigo-500" aria-hidden />
            Members
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {members.map((m) => (
              <li
                key={m.userId}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <span
                  className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 text-[10px] font-semibold text-white"
                  aria-hidden
                >
                  {m.displayName.slice(0, 1).toUpperCase()}
                </span>
                {m.displayName}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Tap <strong>Invite</strong> above to add others — they sign in once and join the group.
          </p>
        </section>
      </div>
    </main>
  );
}
