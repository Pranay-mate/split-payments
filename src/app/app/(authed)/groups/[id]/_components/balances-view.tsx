"use client";

import { useState } from "react";
import { ArrowRight, Check, ChevronDown, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import {
  personBreakdown,
  type Expense as TripExpense,
  type TripSummary,
} from "@/lib/calculators/trip-split";
import { formatINR } from "@/lib/format";
import { formatDate } from "@/lib/format-date";
import { useUserTimezone } from "@/lib/use-user-timezone";
import { useMutationWithQueue } from "@/lib/offline/use-mutation-with-queue";
import { ShareMilestoneButton } from "@/components/share-milestone-button";
import { useConfirm } from "@/components/confirm-dialog";
import { InfoTip } from "@/components/info-tip";

type SettleMode = "simplified" | "pairwise";

type RecordedSettlement = {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  note: string | null;
  occurredAt: Date;
};

/**
 * Settlement progress ring + headline. Ring is the headline KPI: at a
 * glance you see how close the group is to "fully settled". Math:
 *
 *   settled    = sum of recorded settlements (in primary currency)
 *   remaining  = sum of remaining positive balances (the amount still
 *                owed across the group)
 *   progress   = settled / (settled + remaining)
 *
 * remaining is the positive sum specifically because positives ≡ |negatives|
 * after summariseTrip closes the books — counting both would double-count.
 *
 * Hides itself for the no-expenses case (totalToSettle === 0) so we don't
 * flash a misleading 100% on an empty group.
 */
function BalancesHeader({
  summary,
  recorded,
  groupName,
}: {
  summary: TripSummary;
  recorded: RecordedSettlement[];
  groupName: string;
}) {
  const settled = recorded.reduce((s, r) => s + r.amount, 0);
  const remaining = summary.balances.reduce(
    (s, b) => s + Math.max(0, b.amount),
    0,
  );
  const totalToSettle = settled + remaining;
  const progress = totalToSettle > 0 ? settled / totalToSettle : null;
  const pct = progress === null ? 0 : Math.round(progress * 100);

  if (progress === null) {
    return (
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Balances
      </h2>
    );
  }

  const size = 56;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - (progress ?? 0));
  const ringColor = pct >= 100 ? "#10b981" : "#6366f1";

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative shrink-0 text-slate-200 dark:text-slate-700"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeDasharray={C}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-[11px] font-bold tabular-nums">
          {pct}%
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Balances
        </h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          {pct >= 100 ? (
            <>
              <span>All settled — nice.</span>
              <ShareMilestoneButton
                shareUrl={`/share/settled?group=${encodeURIComponent(groupName)}`}
                title={`${groupName} settled on EasySplits`}
                text={`Just settled all balances in "${groupName}" 🎉 — split bills with friends without drama: `}
                label="Share"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-medium text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
              />
            </>
          ) : settled === 0 ? (
            `${formatINR(remaining, 0)} to settle across the group`
          ) : (
            `${formatINR(settled, 0)} settled · ${formatINR(remaining, 0)} to go`
          )}
        </p>
      </div>
    </div>
  );
}

export function BalancesView({
  groupId,
  groupName,
  summary,
  memberById,
  recorded,
  tripExpenses,
  currentUserId,
}: {
  groupId: string;
  /** Used in the "settled" share milestone OG card. */
  groupName: string;
  summary: TripSummary;
  memberById: Map<string, { id: string; name: string }>;
  recorded: RecordedSettlement[];
  /** Raw expense ledger — used by the "Why?" expander to show how each
   *  simplified-payment row derived from per-person paid vs. share. */
  tripExpenses: TripExpense[];
  /** Drives the "Just my balances" auto-default + filter on pairwise. */
  currentUserId: string | null;
}) {
  const utils = trpc.useUtils();
  const confirm = useConfirm();
  const userTz = useUserTimezone();
  const recordMutation = trpc.settlements.create.useMutation({
    onSuccess: () => {
      utils.settlements.listByGroup.invalidate({ groupId });
      utils.events.listByGroup.invalidate({ groupId });
    },
  });
  const deleteMutation = trpc.settlements.delete.useMutation({
    onSuccess: () => {
      utils.settlements.listByGroup.invalidate({ groupId });
      utils.events.listByGroup.invalidate({ groupId });
    },
  });
  const submitRecord = useMutationWithQueue(
    "settlements.create",
    recordMutation,
    {
      onQueued: (rawInput, clientEventId) => {
        const i = rawInput as {
          groupId: string;
          fromUserId: string;
          toUserId: string;
          amount: number;
          note?: string;
        };
        utils.settlements.listByGroup.setData({ groupId: i.groupId }, (old) => {
          if (!old) return old;
          const optimistic = {
            id: clientEventId,
            groupId: i.groupId,
            fromUserId: i.fromUserId,
            toUserId: i.toUserId,
            amount: i.amount,
            note: i.note ?? "",
            occurredAt: new Date(),
            createdAt: new Date(),
            _pending: true,
          } as unknown as (typeof old)[number];
          return [optimistic, ...old];
        });
      },
    },
  );
  const submitDelete = useMutationWithQueue(
    "settlements.delete",
    deleteMutation,
    {
      onQueued: (rawInput) => {
        const i = rawInput as { id: string };
        utils.settlements.listByGroup.setData({ groupId }, (old) =>
          old ? old.filter((s) => s.id !== i.id) : old,
        );
      },
    },
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <BalancesHeader
          summary={summary}
          recorded={recorded}
          groupName={groupName}
        />
        <ul className="mt-4 space-y-3">
          {(() => {
            const maxAbs = Math.max(
              0.01,
              ...summary.balances.map((b) => Math.abs(b.amount)),
            );
            return summary.balances.map((b) => {
              const isOwed = b.amount > 0.01;
              const owes = b.amount < -0.01;
              const abs = Math.abs(b.amount);
              const pct = (abs / maxAbs) * 100;
              return (
                <li key={b.personId} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">
                      {memberById.get(b.personId)?.name ?? "?"}
                    </span>
                    <span
                      className={`tabular-nums text-xs font-semibold ${
                        isOwed
                          ? "text-emerald-700 dark:text-emerald-400"
                          : owes
                            ? "text-rose-700 dark:text-rose-400"
                            : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {isOwed
                        ? `+${formatINR(abs, 0)} · gets`
                        : owes
                          ? `−${formatINR(abs, 0)} · owes`
                          : "settled"}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    {(isOwed || owes) && (
                      <div
                        className={`h-full rounded-full transition-[width] duration-700 ${
                          isOwed
                            ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
                            : "bg-gradient-to-r from-rose-400 to-rose-600"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    )}
                  </div>
                </li>
              );
            });
          })()}
        </ul>
      </section>

      {(summary.settlements.length > 0 || summary.pairwiseSettlements.length > 0) && (
        <SuggestedPayments
          summary={summary}
          memberById={memberById}
          groupId={groupId}
          currentUserId={currentUserId}
          submitRecord={submitRecord}
          recordPending={recordMutation.isPending}
          tripExpenses={tripExpenses}
        />
      )}
      {recorded.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Settlement history
          </h2>
          <ul className="mt-3 space-y-2">
            {recorded.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-medium">
                      {memberById.get(r.fromUserId)?.name ?? "?"}
                    </span>
                    <ArrowRight
                      className="h-4 w-4 text-slate-400"
                      aria-hidden
                    />
                    <span className="font-medium">
                      {memberById.get(r.toUserId)?.name ?? "?"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {formatINR(r.amount, 0)}
                    {r.note ? ` · ${r.note}` : ""} ·{" "}
                    {formatDate(r.occurredAt, userTz, "short")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      !(await confirm({
                        title: "Undo this settlement?",
                        description:
                          "The payment record is removed and Suggested Payments will reopen for this pair.",
                        confirmLabel: "Undo settlement",
                        destructive: true,
                      }))
                    )
                      return;
                    try {
                      const { queued } = await submitDelete({ id: r.id });
                      if (!queued) toast.success("Settlement removed");
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Failed",
                      );
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  aria-label="Undo settlement"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Toggleable suggested-payments panel.
 *
 *   Simplified — minimum transfers via the greedy debt-minimisation algo.
 *     Default. Best when the group just wants to settle up fast.
 *
 *   Pairwise — net debt per (debtor, creditor) pair from the actual
 *     transactions. Pay back the person you actually transacted with.
 *     Typically more rows, but no "wait, why am I paying this person?"
 *     surprise.
 *
 * Both views show the same total money owed; just routed differently.
 * The "Mark as paid" button writes a settlement either way.
 */
function SuggestedPayments({
  summary,
  memberById,
  groupId,
  submitRecord,
  recordPending,
  tripExpenses,
  currentUserId,
}: {
  summary: TripSummary;
  memberById: Map<string, { id: string; name: string }>;
  groupId: string;
  submitRecord: (input: {
    groupId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
  }) => Promise<{ queued: boolean }>;
  recordPending: boolean;
  tripExpenses: TripExpense[];
  currentUserId: string | null;
}) {
  const [mode, setMode] = useState<SettleMode>("simplified");
  // Pairwise lists can balloon in big groups (N² potential pairs).
  // Default to "Just my balances" the moment we detect a large group
  // (≥ 12) so a member of 50 doesn't scan thousands of rows.
  // Default to "Just my balances" once the group passes ~12 members
  // since pairwise lists balloon fast. `memberById` is a Map, so use
  // .size — not Object.keys.
  const [justMine, setJustMine] = useState(memberById.size >= 12);
  const showFilterToggle = mode === "pairwise" && memberById.size >= 8;
  // Track which simplified row's "Why?" expander is open. Pairwise rows
  // don't need the explainer — those are the underlying debts already.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const rawList =
    mode === "simplified" ? summary.settlements : summary.pairwiseSettlements;
  // Drop zero-balance rows defensively (already filtered server-side
  // but the type allows them). When "Just my balances" is on, narrow
  // to rows involving the current user.
  const list = rawList.filter((r) => {
    if (Math.abs(r.amount) < 0.01) return false;
    if (
      justMine &&
      currentUserId &&
      r.fromPersonId !== currentUserId &&
      r.toPersonId !== currentUserId
    ) {
      return false;
    }
    return true;
  });
  if (rawList.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-emerald-50 p-4 dark:border-slate-800 dark:from-indigo-950/40 dark:to-emerald-950/40 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Suggested payments
          <InfoTip label="About settlement modes">
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              Simplified vs Pairwise
            </p>
            <p className="mt-1">
              <strong>Simplified</strong> nets everyone out with the fewest
              transfers possible. Bob → Carol covers your debt to Bob if it
              keeps the math right.
            </p>
            <p className="mt-1.5">
              <strong>Pairwise</strong> shows what you owe the actual person
              you transacted with — no shortcuts. Use it when your group
              prefers explicit &ldquo;I paid for you&rdquo; trails.
            </p>
          </InfoTip>
        </h2>
        <div
          className="inline-flex shrink-0 rounded-full border border-slate-200 bg-white p-0.5 text-[11px] font-medium dark:border-slate-700 dark:bg-slate-900"
          role="tablist"
          aria-label="Settlement view"
        >
          {(
            [
              {
                value: "simplified",
                label: "Simplified",
                title: "Minimum transfers (greedy algorithm)",
              },
              {
                value: "pairwise",
                label: "Pairwise",
                title: "Pay the person you actually transacted with",
              },
            ] as { value: SettleMode; label: string; title: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={mode === opt.value}
              onClick={() => setMode(opt.value)}
              title={opt.title}
              className={`rounded-full px-2.5 py-0.5 transition ${
                mode === opt.value
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {mode === "simplified" ? (
          <>
            Minimum number of transfers to settle the group.
            {summary.pairwiseSettlements.length > rawList.length && (
              <span className="ml-1 text-slate-400">
                · saves{" "}
                {summary.pairwiseSettlements.length - rawList.length} transfer
                {summary.pairwiseSettlements.length - rawList.length === 1
                  ? ""
                  : "s"}{" "}
                vs. pairwise
              </span>
            )}
          </>
        ) : (
          "Direct debts — pay back the person who actually paid for you."
        )}
      </p>
      {showFilterToggle && currentUserId && (
        <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={justMine}
            onChange={(e) => setJustMine(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400 dark:border-slate-600 dark:bg-slate-800"
          />
          Just my balances
          <span className="font-normal text-slate-400">
            · hides rows that don&apos;t involve you
          </span>
        </label>
      )}
      <ul className="mt-4 space-y-2">
        {list.map((s, idx) => {
          const fromName = memberById.get(s.fromPersonId)?.name ?? "?";
          const toName = memberById.get(s.toPersonId)?.name ?? "?";
          const rowKey = `${mode}-${s.fromPersonId}-${s.toPersonId}-${idx}`;
          const isExpanded = expandedKey === rowKey;
          return (
            <li
              key={rowKey}
              className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 truncate">
                  <span className="font-medium">{fromName}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
                  <span className="font-medium">{toName}</span>
                </span>
                <span className="font-semibold tabular-nums">
                  {formatINR(s.amount, 0)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const { queued } = await submitRecord({
                        groupId,
                        fromUserId: s.fromPersonId,
                        toUserId: s.toPersonId,
                        amount: s.amount,
                      });
                      if (!queued) toast.success("Settlement recorded");
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Failed",
                      );
                    }
                  }}
                  disabled={recordPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:bg-slate-300 disabled:dark:bg-slate-700"
                >
                  {recordPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Log payment
                </button>
                {/* "Why?" only for simplified — pairwise debts are
                    already the underlying transactions. */}
                {mode === "simplified" && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedKey(isExpanded ? null : rowKey)
                    }
                    aria-expanded={isExpanded}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Why?
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                )}
              </div>
              {isExpanded && mode === "simplified" && (
                <WhyExpander
                  fromName={fromName}
                  toName={toName}
                  fromBreakdown={personBreakdown(s.fromPersonId, tripExpenses)}
                  toBreakdown={personBreakdown(s.toPersonId, tripExpenses)}
                  amount={s.amount}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Per-row "Why?" panel — opens beneath a simplified-payment row to
 * explain how the amount was derived. Honest first-principles math:
 *   debtor.net  = paid − share  (negative number = owes)
 *   creditor.net = paid − share  (positive number = is owed)
 *   transfer = min(|debtor.net|, creditor.net)
 *
 * We don't try to walk the greedy algorithm's intermediate transfers
 * (debtor → middleman → creditor) — those are an implementation detail
 * that doesn't help users trust the math. The two breakdowns + their
 * net amounts cancelling out is the cleanest explanation.
 */
function WhyExpander({
  fromName,
  toName,
  fromBreakdown,
  toBreakdown,
  amount,
}: {
  fromName: string;
  toName: string;
  fromBreakdown: ReturnType<typeof personBreakdown>;
  toBreakdown: ReturnType<typeof personBreakdown>;
  amount: number;
}) {
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-[12px] dark:border-slate-800 dark:bg-slate-800/40">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        How {formatINR(amount, 0)} was derived — each person&apos;s net
        balance from the expense ledger:
      </p>

      <PersonBreakdownBlock
        name={fromName}
        breakdown={fromBreakdown}
        role="debtor"
      />
      <PersonBreakdownBlock
        name={toName}
        breakdown={toBreakdown}
        role="creditor"
      />

      <p className="border-t border-slate-200 pt-2 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
        {fromName}&apos;s {formatINR(Math.abs(fromBreakdown.net), 0)} debt
        cancels with {toName}&apos;s {formatINR(toBreakdown.net, 0)} surplus
        through this {formatINR(amount, 0)} transfer.
      </p>
    </div>
  );
}

function PersonBreakdownBlock({
  name,
  breakdown,
  role,
}: {
  name: string;
  breakdown: ReturnType<typeof personBreakdown>;
  role: "debtor" | "creditor";
}) {
  const netLabel =
    role === "debtor"
      ? `owes ${formatINR(Math.abs(breakdown.net), 0)}`
      : `is owed ${formatINR(breakdown.net, 0)}`;
  const tone =
    role === "debtor"
      ? "text-rose-700 dark:text-rose-400"
      : "text-emerald-700 dark:text-emerald-400";
  return (
    <div>
      <p className="font-semibold">
        {name} <span className={`font-medium ${tone}`}>· {netLabel}</span>
      </p>
      <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
        <li className="flex justify-between gap-2 tabular-nums">
          <span>Paid out</span>
          <span>{formatINR(breakdown.paid, 0)}</span>
        </li>
        <li className="flex justify-between gap-2 tabular-nums">
          <span>Share of expenses</span>
          <span>{formatINR(breakdown.share, 0)}</span>
        </li>
        <li className="flex justify-between gap-2 border-t border-slate-200 pt-0.5 font-semibold tabular-nums dark:border-slate-700">
          <span>Net</span>
          <span className={tone}>
            {breakdown.net >= 0 ? "+" : "−"}
            {formatINR(Math.abs(breakdown.net), 0)}
          </span>
        </li>
      </ul>
      {breakdown.contributions.length > 0 && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-[10.5px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            From {breakdown.contributions.length} expense
            {breakdown.contributions.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-1 space-y-0.5 pl-2 text-[10.5px] text-slate-500 dark:text-slate-400">
            {breakdown.contributions.map((c) => (
              <li
                key={c.expenseId}
                className="flex justify-between gap-2 tabular-nums"
              >
                <span className="truncate">
                  {c.description || "(no description)"}
                </span>
                <span>
                  {c.net >= 0 ? "+" : "−"}
                  {formatINR(Math.abs(c.net), 0)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
