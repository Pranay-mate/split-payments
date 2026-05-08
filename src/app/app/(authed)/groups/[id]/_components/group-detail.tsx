"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Link2,
  MessageSquare,
  Pencil,
  Plus,
  Receipt,
  Share2,
  Trash2,
  UserPlus,
  Users,
  UserMinus,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import {
  summariseTrip,
  type Expense as TripExpense,
  type Person,
} from "@/lib/calculators/trip-split";
import { formatINR } from "@/lib/format";
import { CATEGORIES, toCategoryKey } from "@/lib/categories";
import { AddExpense } from "./add-expense";
import { BalancesView } from "./balances-view";
import { GroupSettings } from "./group-settings";
import { CommentsThread } from "./comments-thread";
import { ActivityFeed } from "./activity-feed";
import { useMutationWithQueue } from "@/lib/offline/use-mutation-with-queue";

const RECENT_EXPENSE_COUNT = 10;

export function GroupDetail({ groupId }: { groupId: string }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [viewMode, setViewMode] = useState<"recent" | "byDay">("recent");
  const [guestName, setGuestName] = useState("");
  const formRef = useRef<HTMLDivElement | null>(null);

  const focusForm = () => {
    // Run after the panel has expanded — give React a microtask + paint.
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const meQuery = trpc.profiles.me.useQuery();
  const groupQuery = trpc.groups.byId.useQuery({ id: groupId });
  const membersQuery = trpc.groups.members.useQuery({ groupId });
  const expensesQuery = trpc.expenses.listByGroup.useQuery({ groupId });
  const settlementsQuery = trpc.settlements.listByGroup.useQuery({ groupId });
  const utils = trpc.useUtils();

  const removeMemberMutation = trpc.groups.removeMember.useMutation({
    onSuccess: () => {
      utils.groups.members.invalidate({ groupId });
      toast.success("Member removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const addGuestMutation = trpc.groups.addGuest.useMutation({
    onSuccess: () => {
      utils.groups.members.invalidate({ groupId });
      setGuestName("");
      toast.success("Guest added");
    },
    onError: (err) => toast.error(err.message),
  });

  const claimTokenMutation = trpc.groups.createClaimToken.useMutation({
    onSuccess: async ({ token }) => {
      const url = `${window.location.origin}/app/claim/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Claim link copied — share it with your guest");
      } catch {
        toast.success(`Link: ${url}`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      utils.expenses.listByGroup.invalidate({ groupId });
    },
  });
  const submitDelete = useMutationWithQueue("expenses.delete", deleteMutation, {
    onQueued: (rawInput) => {
      const i = rawInput as { id: string };
      utils.expenses.listByGroup.setData({ groupId }, (old) =>
        old ? old.filter((e) => e.id !== i.id) : old,
      );
    },
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
  const isCreator = !!meQuery.data && group.createdBy === meQuery.data.id;

  type ExpenseRow = (typeof expenses)[number];
  type DisplayItem =
    | { kind: "day"; key: string; label: string; total: number; count: number }
    | { kind: "expense"; expense: ExpenseRow };

  const visibleExpenses = showAllExpenses
    ? expenses
    : expenses.slice(0, RECENT_EXPENSE_COUNT);

  const displayItems: DisplayItem[] = (() => {
    if (viewMode === "recent") {
      return visibleExpenses.map((e) => ({ kind: "expense" as const, expense: e }));
    }
    // By-day: interleave a day-header before the first expense of each new date.
    const totals = new Map<
      string,
      { total: number; count: number; label: string }
    >();
    for (const e of visibleExpenses) {
      const d = new Date(e.occurredAt);
      const key = d.toISOString().slice(0, 10);
      if (!totals.has(key)) {
        totals.set(key, {
          total: 0,
          count: 0,
          label: d.toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
          }),
        });
      }
      const entry = totals.get(key)!;
      entry.total += e.convertedAmount;
      entry.count += 1;
    }
    const out: DisplayItem[] = [];
    let prevKey: string | null = null;
    for (const e of visibleExpenses) {
      const key = new Date(e.occurredAt).toISOString().slice(0, 10);
      if (key !== prevKey) {
        const meta = totals.get(key)!;
        out.push({
          kind: "day",
          key,
          label: meta.label,
          total: meta.total,
          count: meta.count,
        });
        prevKey = key;
      }
      out.push({ kind: "expense", expense: e });
    }
    return out;
  })();

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/app/groups"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All groups
        </Link>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {/* SR-only h1 keeps the page accessible without visually duplicating
              the name (which is already in the top-nav GroupSwitcher). */}
          <h1 className="sr-only">{group.name}</h1>
          {/* Brand strip — gradient header. Avatar gives visual identity;
              tagline gives context (currency + member count). */}
          <div className="relative bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 px-5 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15 text-base font-bold text-white shadow-sm backdrop-blur"
                  aria-hidden
                >
                  {group.name.slice(0, 2).toUpperCase()}
                </span>
                <p className="min-w-0 truncate text-sm font-medium text-white/95">
                  {group.primaryCurrency} ·{" "}
                  {members.length} {members.length === 1 ? "member" : "members"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-white/25"
                >
                  <Share2 className="h-3.5 w-3.5" aria-hidden /> Invite
                </button>
                <GroupSettings
                  group={{
                    id: group.id,
                    name: group.name,
                    primaryCurrency: group.primaryCurrency,
                  }}
                  expenseCount={expenses.length}
                  isCreator={isCreator}
                />
              </div>
            </div>
          </div>
          {/* Stats row — split out of the gradient for legibility */}
          <div className="grid grid-cols-2 divide-x divide-slate-200 px-5 py-4 sm:px-6 dark:divide-slate-800">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total spent
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">
                {formatINR(summary?.totalSpent ?? 0, 0)}
              </p>
            </div>
            <div className="pl-5 sm:pl-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Expenses
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">
                {expenses.length}
              </p>
            </div>
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
              onClick={() => {
                setEditingId(null);
                const next = !adding;
                setAdding(next);
                if (next) focusForm();
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {adding ? "Cancel" : "Add expense"}
            </button>
          </div>

          {(adding || editingId) && (
            <div ref={formRef} className="mt-4 scroll-mt-20">
              {(() => {
                const ed = editingId
                  ? expenses.find((e) => e.id === editingId)
                  : null;
                return (
                  <AddExpense
                    key={editingId ?? "new"}
                    groupId={groupId}
                    primaryCurrency={group.primaryCurrency}
                    members={members.map((m) => ({
                      id: m.userId,
                      name: m.displayName,
                    }))}
                    editing={
                      ed
                        ? {
                            id: ed.id,
                            description: ed.description,
                            amount: ed.amount, // original currency amount
                            currency: ed.currency,
                            fxRate: ed.fxRate,
                            payerId: ed.payerId,
                            splitMode: ed.splitMode,
                            category: (ed as unknown as { category?: string })
                              .category,
                            splits: ed.splits,
                          }
                        : null
                    }
                onSuccess={(queued) => {
                  if (!queued) utils.expenses.listByGroup.invalidate({ groupId });
                  if (editingId) {
                    setEditingId(null);
                    if (!queued) toast.success("Expense updated");
                  } else {
                    setAdding(false);
                    if (!queued) toast.success("Expense added");
                  }
                }}
                onCancel={editingId ? () => setEditingId(null) : undefined}
              />
                );
              })()}
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
            <>
            <div className="mt-4 inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
              {(["recent", "byDay"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  className={`rounded-md px-2.5 py-1 transition ${
                    viewMode === mode
                      ? "bg-emerald-500 text-white"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {mode === "recent" ? "Recent" : "By day"}
                </button>
              ))}
            </div>
            <ul className="mt-3 space-y-2">
              {displayItems.map((item) => {
                if (item.kind === "day") {
                  return (
                    <li
                      key={`day:${item.key}`}
                      className="sticky top-0 z-10 flex items-center justify-between rounded-md bg-slate-100/90 px-3 py-1.5 text-xs font-semibold text-slate-700 backdrop-blur dark:bg-slate-800/80 dark:text-slate-200"
                    >
                      <span>{item.label}</span>
                      <span className="tabular-nums text-slate-500 dark:text-slate-400">
                        {formatINR(item.total, 0)} · {item.count}{" "}
                        {item.count === 1 ? "expense" : "expenses"}
                      </span>
                    </li>
                  );
                }
                const e = item.expense;
                const payerName = memberById.get(e.payerId)?.name ?? "?";
                const showOriginal = e.currency !== group.primaryCurrency;
                const pending = (e as unknown as { _pending?: boolean })._pending;
                return (
                  <li
                    key={e.id}
                    className={`animate-row-in rounded-xl border p-3 transition ${
                      editingId === e.id
                        ? "border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/30"
                        : pending
                        ? "border-amber-200 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20"
                        : "border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        <span className="truncate">
                          {e.description || "Expense"}
                        </span>
                        {(() => {
                          const cat =
                            CATEGORIES[
                              toCategoryKey(
                                (e as unknown as { category?: string }).category,
                              )
                            ];
                          return (
                            <span
                              className={`shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cat.chipClass}`}
                              title={cat.label}
                            >
                              <span aria-hidden>{cat.emoji}</span>
                              {cat.label}
                            </span>
                          );
                        })()}
                        {pending && (
                          <span className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
                            Pending sync
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {payerName} paid{" "}
                        {showOriginal
                          ? `${e.amount.toFixed(0)} ${e.currency} (≈ ${formatINR(e.convertedAmount, 0)})`
                          : formatINR(e.convertedAmount, 0)}{" "}
                        ·{" "}
                        {e.splitMode === "exact" ? "exact" : "equal"} split
                        among {e.splits.length}{" "}
                        {e.splits.length === 1 ? "person" : "people"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setCommentingOn((id) => (id === e.id ? null : e.id))
                        }
                        aria-pressed={commentingOn === e.id}
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
                          commentingOn === e.id
                            ? "bg-violet-500 text-white"
                            : "text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                        }`}
                        aria-label="Show comments"
                      >
                        <MessageSquare className="h-4 w-4" aria-hidden />
                      </button>
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
                        aria-label="Edit expense"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm("Remove this expense?")) return;
                          if (editingId === e.id) setEditingId(null);
                          try {
                            const { queued } = await submitDelete({ id: e.id });
                            if (!queued) toast.success("Expense removed");
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "Delete failed",
                            );
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                        aria-label="Remove expense"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    </div>
                    {commentingOn === e.id && meQuery.data?.id && (
                      <CommentsThread
                        expenseId={e.id}
                        currentUserId={meQuery.data.id}
                        memberById={memberById}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            {expenses.length > RECENT_EXPENSE_COUNT && (
              <button
                type="button"
                onClick={() => setShowAllExpenses((v) => !v)}
                className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {showAllExpenses
                  ? `Show recent ${RECENT_EXPENSE_COUNT}`
                  : `View all ${expenses.length} expenses`}
              </button>
            )}
            </>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Users className="h-4 w-4 text-indigo-500" aria-hidden />
            Members
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {members.map((m) => {
              const isSelf = m.userId === meQuery.data?.id;
              const isGuest = m.isGuest;
              return (
                <li
                  key={m.userId}
                  className={`inline-flex items-center gap-2 rounded-full border py-1 pl-3 pr-1 text-sm ${
                    isGuest
                      ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
                      : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold text-white ${
                      isGuest
                        ? "bg-gradient-to-br from-amber-500 to-rose-500"
                        : "bg-gradient-to-br from-indigo-500 to-emerald-500"
                    }`}
                    aria-hidden
                  >
                    {m.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    {m.displayName}
                    {isSelf ? " (you)" : ""}
                    {isGuest && (
                      <span className="ml-1.5 rounded-full bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                        guest
                      </span>
                    )}
                  </span>
                  {isGuest && isCreator && (
                    <button
                      type="button"
                      onClick={() =>
                        claimTokenMutation.mutate({
                          groupId,
                          shadowProfileId: m.userId,
                        })
                      }
                      disabled={claimTokenMutation.isPending}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-amber-700 transition hover:bg-amber-200 dark:text-amber-300 dark:hover:bg-amber-900"
                      aria-label={`Generate claim link for ${m.displayName}`}
                      title="Copy a single-use claim link to share with this guest"
                    >
                      <Link2 className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                  {!isSelf && (isGuest || isCreator) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove ${m.displayName} from this group?`)) {
                          removeMemberMutation.mutate({
                            groupId,
                            userId: m.userId,
                          });
                        }
                      }}
                      disabled={removeMemberMutation.isPending}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-rose-600 dark:hover:bg-slate-700"
                      aria-label={`Remove ${m.displayName}`}
                    >
                      <UserMinus className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = guestName.trim();
              if (!name) return;
              addGuestMutation.mutate({ groupId, name });
            }}
            className="mt-4 flex flex-wrap items-center gap-2"
          >
            <label className="sr-only" htmlFor="guest-name">
              Guest name
            </label>
            <input
              id="guest-name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Add by name (no signup)"
              maxLength={60}
              className="flex-1 min-w-[12rem] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950"
            />
            <button
              type="submit"
              disabled={!guestName.trim() || addGuestMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
            >
              {addGuestMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <UserPlus className="h-3.5 w-3.5" aria-hidden />
              )}
              Add guest
            </button>
          </form>

          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Add friends by name even if they don&apos;t have an account — share a one-shot claim
            link later to merge their history when they sign up. For people on EasySplits, tap{" "}
            <strong>Invite</strong> above instead.
          </p>
        </section>

        <ActivityFeed groupId={groupId} memberById={memberById} />
      </div>
    </main>
  );
}
