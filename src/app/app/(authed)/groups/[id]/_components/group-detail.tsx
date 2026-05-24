"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  Download,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Pencil,
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
import { formatCurrency } from "@/lib/format";
import { GroupCurrencyProvider } from "@/lib/group-currency-context";
import { formatDate } from "@/lib/format-date";
import { useUserTimezone } from "@/lib/use-user-timezone";
import { CATEGORIES, toCategoryKey } from "@/lib/categories";
import { AddExpenseModal } from "./add-expense-modal";
import { BalancesView } from "./balances-view";
import { RecordPaymentModal } from "./record-payment-modal";
import { disambiguateMembers } from "@/lib/disambiguate-names";
import { useConfirm } from "@/components/confirm-dialog";
import { ContributionBar } from "./contribution-bar";
import { GroupSettings } from "./group-settings";
import { InviteModal } from "./invite-modal";
import { ItemHistoryModal } from "./item-history-modal";
import { SubscriptionAudit } from "./subscription-audit";
import { CommentsThread } from "./comments-thread";
import { ActivityFeed } from "./activity-feed";
import { useMutationWithQueue } from "@/lib/offline/use-mutation-with-queue";
import { downloadCsv, downloadPdf, type ExportInput } from "@/lib/export";

// Recharts is heavy (~100kb gz). Lazy-load so the default group view stays
// snappy; only paid for once the user expands the Charts panel.
const GroupCharts = dynamic(
  () => import("./group-charts").then((m) => m.GroupCharts),
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

const PAGE_SIZE = 5;

export function GroupDetail({ groupId }: { groupId: string }) {
  const searchParams = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const confirm = useConfirm();
  const [commentingOn, setCommentingOn] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewMode, setViewMode] = useState<"recent" | "byDay">("recent");
  const [showCharts, setShowCharts] = useState(false);
  // Secondary sections collapsed by default — the main page was reading
  // too dense, so contribution share / activity log / member roster
  // now wait for a deliberate tap. Balances + Expenses (the headline
  // answers) stay open.
  const [showContrib, setShowContrib] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [historyForExpense, setHistoryForExpense] = useState<string | null>(null);
  const [expenseSearch, setExpenseSearch] = useState("");

  // ?add=1 deep-link from the groups-list FAB — opens the AddExpense
  // modal immediately on mount. Done in an effect (not a useState
  // initializer) because useSearchParams() can hydrate empty on the
  // first render pass; the effect runs after hydration with the real
  // query.
  useEffect(() => {
    if (searchParams?.get("add") === "1") {
      setAdding(true);
    }
  }, [searchParams]);

  const userTz = useUserTimezone();
  const meQuery = trpc.profiles.me.useQuery();
  const groupQuery = trpc.groups.byId.useQuery({ id: groupId });
  const membersQuery = trpc.groups.members.useQuery({ groupId });
  const expensesQuery = trpc.expenses.listByGroup.useQuery({ groupId });
  const settlementsQuery = trpc.settlements.listByGroup.useQuery({ groupId });
  const utils = trpc.useUtils();

  // Member-management mutations now live inside <GroupSettings />.

  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      utils.expenses.listByGroup.invalidate({ groupId });
      utils.events.listByGroup.invalidate({ groupId });
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

  // Memo'd separately so BalancesView's "Why?" expander can use the
  // raw expense ledger to compute per-person breakdowns without a
  // duplicate transformation.
  const tripExpenses = useMemo<TripExpense[]>(() => {
    if (!expensesQuery.data) return [];
    return expensesQuery.data.map((e) => ({
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
  }, [expensesQuery.data]);

  const summary = useMemo(() => {
    if (!membersQuery.data || !expensesQuery.data) return null;
    const people: Person[] = membersQuery.data.map((m) => ({
      id: m.userId,
      name: m.displayName,
    }));
    const recordedSettlements = (settlementsQuery.data ?? []).map((s) => ({
      fromPersonId: s.fromUserId,
      toPersonId: s.toUserId,
      amount: s.amount,
    }));
    return summariseTrip(people, tripExpenses, recordedSettlements);
  }, [membersQuery.data, expensesQuery.data, settlementsQuery.data, tripExpenses]);

  const openInvite = () => {
    if (!groupQuery.data) return;
    setInviteOpen(true);
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
  const rawMembers = membersQuery.data ?? [];
  // Disambiguate duplicated display names (e.g. a guest "Pranay Mate"
  // added by hand + the real Pranay Mate joining via Google). Without
  // this the split-picker / payer-dropdown / member list all render
  // identical-looking chips for different people.
  const members = (() => {
    const labels = disambiguateMembers(
      rawMembers.map((m) => ({
        id: m.userId,
        name: m.displayName,
        isGuest: m.isGuest,
      })),
      meQuery.data?.id ?? null,
    );
    const byId = new Map(labels.map((l) => [l.id, l.name]));
    return rawMembers.map((m) => ({
      ...m,
      displayName: byId.get(m.userId) ?? m.displayName,
    }));
  })();
  const expenses = expensesQuery.data ?? [];
  const isCreator = !!meQuery.data && group.createdBy === meQuery.data.id;

  type ExpenseRow = (typeof expenses)[number];
  type DisplayItem =
    | { kind: "day"; key: string; label: string; total: number; count: number }
    | { kind: "expense"; expense: ExpenseRow };

  // Client-side search across the loaded expenses. Matches description,
  // category, payer name, and (loose) amount. Inline (not memoized) —
  // expensesQuery already lives behind a useQuery cache, and even a
  // 500-row .filter() is sub-millisecond in practice. Memoizing here
  // would also fight the early-return-before-this-line rule of hooks.
  const filteredExpenses = (() => {
    const q = expenseSearch.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter((e) => {
      if (e.description?.toLowerCase().includes(q)) return true;
      if (e.category?.toLowerCase().includes(q)) return true;
      const payerName = memberById.get(e.payerId)?.name ?? "";
      if (payerName.toLowerCase().includes(q)) return true;
      if (/^\d/.test(q) && String(e.convertedAmount).includes(q)) return true;
      return false;
    });
  })();

  // Pagination only applies in Recent mode — By day mode is already
  // visually broken up by date headers so truncating there fights the layout.
  const visibleExpenses =
    viewMode === "byDay"
      ? filteredExpenses
      : filteredExpenses.slice(0, visibleCount);

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
          label: formatDate(d, userTz, "weekday-short"),
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
    <GroupCurrencyProvider currency={group.primaryCurrency}>
    <main className="flex-1">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href="/app/groups"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All groups
        </Link>

        <div className="animate-section-in overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
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
                  onClick={openInvite}
                  aria-label="Show invite QR + link"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-white/25"
                >
                  <Share2 className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden sm:inline">Invite</span>
                </button>
                <GroupSettings
                  group={{
                    id: group.id,
                    name: group.name,
                    primaryCurrency: group.primaryCurrency,
                    archivedAt: group.archivedAt ?? null,
                  }}
                  expenseCount={expenses.length}
                  isCreator={isCreator}
                  members={members.map((m) => ({
                    userId: m.userId,
                    displayName: m.displayName,
                    isGuest: m.isGuest,
                  }))}
                  meId={meQuery.data?.id ?? null}
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
                {formatCurrency(summary?.totalSpent ?? 0, group.primaryCurrency, 0)}
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

        {/* Soft warning past 30 members — purely advisory. Doesn't cap
            the group, just nudges toward sub-grouping for trip-specific
            spending. localStorage flag so the user can dismiss for a
            week. */}
        <LargeGroupNudge groupId={groupId} memberCount={members.length} />

        {/* Balances first — answers the #1 user question ("do I owe anyone?")
            before showing supporting context like contribution share. */}
        {summary && summary.balances.length > 0 && (
          <div className="animate-section-in [animation-delay:60ms]">
            <BalancesView
              groupId={groupId}
              groupName={group.name}
              summary={summary}
              memberById={memberById}
              recorded={settlementsQuery.data ?? []}
              tripExpenses={tripExpenses}
              currentUserId={meQuery.data?.id ?? null}
            />
          </div>
        )}

        {expenses.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setShowContrib((v) => !v)}
              aria-expanded={showContrib}
              className="flex w-full items-center justify-between p-4 text-left sm:p-5"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Who paid
              </h2>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition ${showContrib ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {showContrib && (
              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <ContributionBar
                  expenses={expenses.map((e) => ({
                    payerId: e.payerId,
                    convertedAmount: e.convertedAmount,
                  }))}
                  members={members.map((m) => ({
                    id: m.userId,
                    name: m.displayName,
                  }))}
                />
              </div>
            )}
          </section>
        )}

        <SubscriptionAudit
          expenses={expenses.map((e) => ({
            description: e.description,
            convertedAmount: e.convertedAmount,
            occurredAt: e.occurredAt,
            category: (e as unknown as { category?: string | null }).category,
          }))}
          primaryCurrency={group.primaryCurrency}
        />

        <section className="animate-section-in [animation-delay:120ms] rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Receipt className="h-4 w-4 text-emerald-500" aria-hidden />
              Expenses
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRecordingPayment(true)}
                title="Log a member-to-member payment (cash, UPI, advance)"
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Record payment</span>
                <span className="sm:hidden">Payment</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setAdding(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add expense
              </button>
            </div>
          </div>


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
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
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
              {expenses.length >= 8 && (
                <input
                  type="search"
                  value={expenseSearch}
                  onChange={(e) => {
                    setExpenseSearch(e.target.value);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  placeholder="Search description, category, payer, amount…"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-900"
                />
              )}
              {expenseSearch && (
                <button
                  type="button"
                  onClick={() => setExpenseSearch("")}
                  className="shrink-0 text-[11px] text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>
            {expenseSearch && (
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {filteredExpenses.length} of {expenses.length} match
                &ldquo;{expenseSearch}&rdquo;
              </p>
            )}
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
                        {formatCurrency(item.total, group.primaryCurrency, 0)} · {item.count}{" "}
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
                    <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {/* Description on its own line — chip row drops below
                          on narrow screens via flex-wrap, no truncation. */}
                      <p className="truncate text-sm font-medium">
                        {e.description || "Expense"}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5">
                        {(() => {
                          const cat =
                            CATEGORIES[
                              toCategoryKey(
                                (e as unknown as { category?: string }).category,
                              )
                            ];
                          return (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cat.chipClass}`}
                              title={cat.label}
                            >
                              <span aria-hidden>{cat.emoji}</span>
                              {cat.label}
                            </span>
                          );
                        })()}
                        {pending && (
                          <span className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
                            Pending sync
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {payerName} paid{" "}
                        {showOriginal
                          ? `${e.amount.toFixed(0)} ${e.currency} (≈ ${formatCurrency(e.convertedAmount, group.primaryCurrency, 0)})`
                          : formatCurrency(e.convertedAmount, group.primaryCurrency, 0)}{" "}
                        ·{" "}
                        {(() => {
                          const itemCount =
                            (e as unknown as { items?: unknown[] }).items
                              ?.length ?? 0;
                          if (itemCount > 0) {
                            return `${itemCount} ${itemCount === 1 ? "item" : "items"}, ${e.splits.length} ${e.splits.length === 1 ? "person" : "people"}`;
                          }
                          return `${e.splitMode === "exact" ? "exact" : "equal"} split among ${e.splits.length} ${e.splits.length === 1 ? "person" : "people"}`;
                        })()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setHistoryForExpense(e.id)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                        aria-label="Show edit history"
                        title="History"
                      >
                        <History className="h-4 w-4" aria-hidden />
                      </button>
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
                          if (
                            !(await confirm({
                              title: "Remove this expense?",
                              description:
                                "Splits, comments, and edit history for this expense will be deleted. Balances update immediately.",
                              confirmLabel: "Remove",
                              destructive: true,
                            }))
                          )
                            return;
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
                        groupId={groupId}
                        expenseId={e.id}
                        currentUserId={meQuery.data.id}
                        memberById={memberById}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            {viewMode === "recent" && filteredExpenses.length > visibleCount && (
              <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((n) =>
                      Math.min(n + PAGE_SIZE, filteredExpenses.length),
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
                >
                  Show {Math.min(PAGE_SIZE, filteredExpenses.length - visibleCount)} more
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleCount(filteredExpenses.length)}
                  className="text-xs font-medium text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  Show all {filteredExpenses.length}
                </button>
              </div>
            )}
            {viewMode === "recent" &&
              visibleCount > PAGE_SIZE &&
              visibleCount >= filteredExpenses.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(PAGE_SIZE)}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Show recent {PAGE_SIZE}
                </button>
              )}
            </>
          )}

          {/* Export footer — sits inside the Expenses card so it's
              semantically tied to the data above it. Hairline divider
              separates the buttons from the list/pagination controls. */}
          {expenses.length > 0 && (() => {
            const buildExportData = (): ExportInput => ({
              groupName: group.name,
              primaryCurrency: group.primaryCurrency,
              members: members.map((m) => ({ id: m.userId, name: m.displayName })),
              expenses: expenses.map((e) => ({
                description: e.description,
                amount: e.amount,
                currency: e.currency,
                convertedAmount: e.convertedAmount,
                payerId: e.payerId,
                category: (e as unknown as { category?: string | null }).category,
                occurredAt: e.occurredAt,
                splits: e.splits,
              })),
              settlements: (settlementsQuery.data ?? []).map((s) => ({
                fromUserId: s.fromUserId,
                toUserId: s.toUserId,
                amount: s.amount,
                note: s.note,
                occurredAt: s.occurredAt,
              })),
              balances: (summary?.balances ?? []).map((b) => ({
                userId: b.personId,
                net: b.amount,
              })),
            });
            const handleCsv = () => {
              try {
                downloadCsv(buildExportData());
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Export failed");
              }
            };
            const handlePdf = async () => {
              setExportingPdf(true);
              try {
                await downloadPdf(buildExportData());
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "PDF export failed",
                );
              } finally {
                setExportingPdf(false);
              }
            };
            const btnClass =
              "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
            return (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <Download className="h-3 w-3 text-sky-500" aria-hidden />
                  Export
                </span>
                <button type="button" onClick={handleCsv} className={btnClass}>
                  <Download className="h-3 w-3" aria-hidden /> CSV
                </button>
                <button
                  type="button"
                  disabled={exportingPdf}
                  onClick={handlePdf}
                  className={btnClass}
                >
                  {exportingPdf ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  ) : (
                    <FileText className="h-3 w-3" aria-hidden />
                  )}
                  PDF
                </button>
              </div>
            );
          })()}
        </section>

        {/* Charts — collapsed by default; lives below Expenses since
            it's a derived view of the same data. */}
        {expenses.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setShowCharts((v) => !v)}
              aria-expanded={showCharts}
              className="flex w-full items-center justify-between p-4 text-left sm:p-5"
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
              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <GroupCharts
                  expenses={expenses.map((e) => ({
                    id: e.id,
                    description: e.description,
                    payerId: e.payerId,
                    convertedAmount: e.convertedAmount,
                    occurredAt: e.occurredAt,
                    category: (e as unknown as { category?: string | null })
                      .category,
                  }))}
                  members={members.map((m) => ({
                    id: m.userId,
                    name: m.displayName,
                  }))}
                />
              </div>
            )}
          </section>
        )}

        {showActivity ? (
          <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setShowActivity(false)}
              aria-expanded
              className="flex w-full items-center justify-between p-5 text-left"
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Activity className="h-4 w-4 text-violet-500" aria-hidden />
                Activity
              </h2>
              <ChevronDown className="h-4 w-4 rotate-180 text-slate-400" aria-hidden />
            </button>
            <div className="px-5 pb-5">
              <ActivityFeed groupId={groupId} memberById={memberById} embedded />
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setShowActivity(true)}
              aria-expanded={false}
              className="flex w-full items-center justify-between p-4 text-left sm:p-5"
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Activity className="h-4 w-4 text-violet-500" aria-hidden />
                Activity
              </h2>
              <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
            </button>
          </section>
        )}

        {/* Members — read-only chips. Add/remove/claim controls live in
            Settings (header) since they're admin-mode actions. */}
        <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setShowMembers((v) => !v)}
            aria-expanded={showMembers}
            className="flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5"
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Users className="h-4 w-4 text-indigo-500" aria-hidden />
              Members
            </h2>
            <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {members.length}
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition ${showMembers ? "rotate-180" : ""}`}
                aria-hidden
              />
            </span>
          </button>
          {showMembers && (
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <ul className="flex flex-wrap gap-1.5">
            {members.map((m) => {
              const isGuest = m.isGuest;
              return (
                <li
                  key={m.userId}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                    isGuest
                      ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
                      : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-white ${
                      isGuest
                        ? "bg-gradient-to-br from-amber-500 to-rose-500"
                        : "bg-gradient-to-br from-indigo-500 to-emerald-500"
                    }`}
                  >
                    {m.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span>{m.displayName}</span>
                  {isGuest && (
                    <span className="rounded-full bg-amber-200/70 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                      guest
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            Add or remove members from{" "}
            <strong className="font-semibold">Settings</strong> in the header.
          </p>
          </div>
          )}
        </section>
      </div>

      {/* Floating Action Button — single-tap "Add expense" from any
          scroll position. Hidden while a form is already open so it
          doesn't sit on top of the inline AddExpense panel. */}
      {!adding && !editingId && (
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setAdding(true);
          }}
          aria-label="Add expense"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-30 flex items-center gap-2 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 px-5 py-3.5 text-sm font-semibold text-white shadow-xl shadow-emerald-500/50 ring-4 ring-white/60 transition-transform duration-150 hover:scale-105 active:scale-95 dark:ring-slate-900/60 sm:bottom-6 sm:right-6 sm:px-6 sm:py-4 sm:text-base"
        >
          <Plus className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden strokeWidth={2.5} />
          <span>Add expense</span>
        </button>
      )}
      <AddExpenseModal
        open={adding || Boolean(editingId)}
        onClose={() => {
          setAdding(false);
          setEditingId(null);
        }}
        groupId={groupId}
        primaryCurrency={group.primaryCurrency}
        currentUserId={meQuery.data?.id ?? null}
        members={members.map((m) => ({
          userId: m.userId,
          displayName: m.displayName,
        }))}
        editing={(() => {
          const ed = editingId
            ? expenses.find((e) => e.id === editingId)
            : null;
          if (!ed) return null;
          return {
            id: ed.id,
            description: ed.description,
            amount: ed.amount,
            currency: ed.currency,
            fxRate: ed.fxRate,
            payerId: ed.payerId,
            splitMode: ed.splitMode,
            category: (ed as unknown as { category?: string }).category,
            splits: ed.splits,
            items: (
              ed as unknown as {
                items?: {
                  id: string;
                  description: string;
                  amount: number;
                  sharerIds: string[];
                }[];
              }
            ).items,
          };
        })()}
        onSubmitted={(queued, wasEditing) => {
          if (!queued) {
            utils.expenses.listByGroup.invalidate({ groupId });
            utils.events.listByGroup.invalidate({ groupId });
            toast.success(wasEditing ? "Expense updated" : "Expense added");
          }
        }}
      />
      {groupQuery.data && (
        <InviteModal
          groupName={groupQuery.data.name}
          inviteToken={groupQuery.data.inviteToken}
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
        />
      )}
      {historyForExpense && (
        <ItemHistoryModal
          expenseId={historyForExpense}
          open
          onClose={() => setHistoryForExpense(null)}
          memberById={memberById}
        />
      )}
      <RecordPaymentModal
        groupId={groupId}
        primaryCurrency={group?.primaryCurrency ?? "INR"}
        members={members.map((m) => ({ id: m.userId, name: m.displayName }))}
        currentUserId={meQuery.data?.id ?? null}
        open={recordingPayment}
        onClose={() => setRecordingPayment(false)}
      />
    </main>
    </GroupCurrencyProvider>
  );
}

/**
 * Soft advisory banner for groups past ~30 members. Renders nothing
 * below the threshold. Dismissable for 7 days per (user × group) via
 * localStorage so it doesn't pester the same person on every visit.
 */
function LargeGroupNudge({
  groupId,
  memberCount,
}: {
  groupId: string;
  memberCount: number;
}) {
  const [dismissed, setDismissed] = useState(false);
  const storageKey = `easysplits.large-group-nudge.${groupId}`;
  const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const until = Number(raw);
      if (Number.isFinite(until) && until > Date.now()) {
        queueMicrotask(() => setDismissed(true));
      }
    } catch {
      // localStorage disabled — banner just keeps showing, harmless.
    }
  }, [storageKey]);

  if (memberCount < 30 || dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(
        storageKey,
        String(Date.now() + COOLDOWN_MS),
      );
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
      <Users
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
          Heads up — {memberCount} members in one group
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800/90 dark:text-amber-200/85">
          For trip-specific spending, smaller sub-groups (e.g. &ldquo;Goa
          weekend&rdquo;, &ldquo;Office lunch&rdquo;) keep balances easier
          to read. This one will still work — just sharing the tip.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium text-amber-700 transition hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
        aria-label="Dismiss for a week"
      >
        Got it
      </button>
    </div>
  );
}
