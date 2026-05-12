"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, Trophy, X } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { formatDate } from "@/lib/format-date";
import { useUserTimezone } from "@/lib/use-user-timezone";
import { ShareMilestoneButton } from "@/components/share-milestone-button";
import { GoalCelebration } from "@/components/goal-celebration";

type PillarKey =
  | "emergency"
  | "insurance"
  | "debt"
  | "savingsRate"
  | "investing";

type GoalKind = "pillar" | "total";

type GoalTemplate = {
  key: string;
  emoji: string;
  label: string;
  goalKind: GoalKind;
  pillarKey: PillarKey | null;
  targetScore: number;
  /** Description for the picker — explains what the target means. */
  hint: string;
};

// Templates wrap the pillar rules-of-thumb in plain language so users
// don't have to translate "emergency 20/20" → "6mo of expenses saved."
const TEMPLATES: GoalTemplate[] = [
  {
    key: "tpl_emergency",
    emoji: "🪂",
    label: "Hit my full emergency-fund target",
    goalKind: "pillar",
    pillarKey: "emergency",
    targetScore: 20,
    hint: "6 months of expenses in liquid savings (9 if freelance).",
  },
  {
    key: "tpl_insurance",
    emoji: "🛡️",
    label: "Get insurance to a strong 18+/20",
    goalKind: "pillar",
    pillarKey: "insurance",
    targetScore: 18,
    hint: "≥10× term cover (if dependents) + ≥₹15L health cover.",
  },
  {
    key: "tpl_debt",
    emoji: "🪜",
    label: "Be debt-light",
    goalKind: "pillar",
    pillarKey: "debt",
    targetScore: 20,
    hint: "EMIs comfortably under 40% of income · no rolling CC balance.",
  },
  {
    key: "tpl_savings",
    emoji: "💪",
    label: "Reach a 25%+ savings rate",
    goalKind: "pillar",
    pillarKey: "savingsRate",
    targetScore: 17,
    hint: "(income − expenses) ÷ income ≈ 25%.",
  },
  {
    key: "tpl_investing",
    emoji: "🌱",
    label: "Build an active investing base",
    goalKind: "pillar",
    pillarKey: "investing",
    targetScore: 15,
    hint: "Investments tracking your age-glide target + active SIP.",
  },
  {
    key: "tpl_total80",
    emoji: "🌟",
    label: "Reach 80/100 — green band",
    goalKind: "total",
    pillarKey: null,
    targetScore: 80,
    hint: "Total Financial Health Score crosses into the green band.",
  },
];

const PILLAR_LABEL: Record<PillarKey, string> = {
  emergency: "Emergency fund",
  insurance: "Insurance",
  debt: "Debt",
  savingsRate: "Savings rate",
  investing: "Investing",
};

function pctOf(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(1, current / target));
}

function shortDate(
  d: Date | string | null,
  tz: string,
): string | null {
  if (!d) return null;
  return formatDate(d, tz, "medium");
}

/** Days until target date (null if no date). Negative = past due. */
function daysUntil(d: Date | string | null): number | null {
  if (!d) return null;
  const target = new Date(d).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export function GoalsCard() {
  const goalsQuery = trpc.personal.goals.list.useQuery();
  const utils = trpc.useUtils();
  const archiveMutation = trpc.personal.goals.archive.useMutation({
    onSuccess: () => utils.personal.goals.list.invalidate(),
  });
  const [showPicker, setShowPicker] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const { inProgress, completed } = useMemo(() => {
    const all = (goalsQuery.data ?? []).filter((g) => !g.archivedAt);
    return {
      inProgress: all.filter((g) => !g.completedAt),
      completed: all.filter((g) => g.completedAt),
    };
  }, [goalsQuery.data]);

  if (goalsQuery.isLoading) return null;

  const allGoals = (goalsQuery.data ?? []).filter((g) => !g.archivedAt);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
            Goals
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Updated each time you re-submit your scorecard.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPicker((s) => !s)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add goal
        </button>
      </div>

      {showPicker && <GoalPicker onClose={() => setShowPicker(false)} />}

      <div className="px-4 py-3 sm:px-5">
        {inProgress.length === 0 && completed.length === 0 && !showPicker ? (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
            No active goals yet.{" "}
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
            >
              Pick a template
            </button>{" "}
            to get started.
          </p>
        ) : (
          <>
            {inProgress.length > 0 && (
              <ul className="space-y-3">
                {inProgress.map((g) => (
                  <GoalRow
                    key={g.id}
                    goal={g}
                    onArchive={(id) => archiveMutation.mutate({ id })}
                  />
                ))}
              </ul>
            )}
            {completed.length > 0 && (
              <div
                className={inProgress.length > 0 ? "mt-3" : ""}
              >
                <button
                  type="button"
                  onClick={() => setShowCompleted((s) => !s)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓
                    </span>
                    Completed · {completed.length}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${showCompleted ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                {showCompleted && (
                  <ul className="mt-2 space-y-2">
                    {completed.map((g) => (
                      <GoalRow
                        key={g.id}
                        goal={g}
                        compact
                        onArchive={(id) => archiveMutation.mutate({ id })}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <GoalCelebration goals={allGoals} />
    </section>
  );
}

type GoalListItem = {
  id: string;
  goalKind: "pillar" | "total";
  pillarKey: string | null;
  label: string;
  targetScore: number;
  targetDate: Date | string | null;
  currentValue: number;
  completedAt: Date | string | null;
  /** Server-computed: when, at the user's current pace, the goal will
   *  be hit. null if no useful projection (already done, <2 snapshots,
   *  flat/regressing, or >10y out). */
  projectedHitDate?: Date | string | null;
  /** Number of score snapshots used in the projection. Drives the
   *  "Take another snapshot to see projections" fallback copy. */
  snapshotCount?: number;
};

function GoalRow({
  goal,
  compact = false,
  onArchive,
}: {
  goal: GoalListItem;
  compact?: boolean;
  onArchive: (id: string) => void;
}) {
  const userTz = useUserTimezone();
  const pct = pctOf(goal.currentValue, goal.targetScore);
  const max = goal.goalKind === "total" ? 100 : 20;
  const days = daysUntil(goal.targetDate);
  const onTrack = days === null ? null : goal.completedAt ? true : days >= 0;
  const isDone = !!goal.completedAt;

  return (
    <li
      className={
        compact
          ? "rounded-lg border border-emerald-100 bg-emerald-50/40 p-2 dark:border-emerald-900/40 dark:bg-emerald-950/20"
          : "rounded-xl border border-slate-100 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-800/30"
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${
              compact ? "text-xs font-medium" : "text-sm font-semibold"
            }`}
          >
            <span className="truncate">{goal.label}</span>
            {isDone && (
              <>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                  ✓ Done
                </span>
                <ShareMilestoneButton
                  shareUrl={`/share/goal?label=${encodeURIComponent(goal.label)}`}
                  title="Goal hit on EasySplits"
                  text={`Just hit my financial goal: ${goal.label} 🎯 — try the free scorecard: `}
                  label="Share"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-medium text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                />
              </>
            )}
          </p>
          {!compact && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span>
                {goal.goalKind === "pillar" && goal.pillarKey
                  ? `${PILLAR_LABEL[goal.pillarKey as PillarKey]} pillar`
                  : "Total score"}
                {" · "}
                {goal.currentValue}/{goal.targetScore}{" "}
                <span className="text-slate-400">(max {max})</span>
              </span>
              {goal.targetDate && (
                <span className={onTrack === false ? "text-rose-500" : ""}>
                  · by {shortDate(goal.targetDate, userTz)}
                  {days !== null && !isDone && (
                    <>
                      {" · "}
                      {days >= 0
                        ? `${days}d left`
                        : `${Math.abs(days)}d past due`}
                    </>
                  )}
                </span>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onArchive(goal.id)}
          className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          title="Archive this goal"
          aria-label="Archive goal"
        >
          <X className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
        </button>
      </div>

      {!compact && (
        <>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${
                isDone
                  ? "bg-emerald-500"
                  : onTrack === false
                    ? "bg-rose-500"
                    : "bg-gradient-to-r from-emerald-400 to-teal-500"
              }`}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
          {!isDone && (
            <ProjectionLine
              goal={goal}
              userTz={userTz}
              targetDate={goal.targetDate}
            />
          )}
          <p className="mt-1 text-right text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
            {Math.round(pct * 100)}%
          </p>
        </>
      )}
    </li>
  );
}

/**
 * Inline projection line under each in-progress goal. Three states:
 *   - ≥2 snapshots + positive slope → "On pace to hit · <month year>"
 *     plus a flag for ahead-of / behind-target where a target date exists
 *   - <2 snapshots → "Take another snapshot to see projections"
 *   - Flat / regressing trend → no line (avoids "you'll never hit this"
 *     downer; better to stay quiet)
 */
function ProjectionLine({
  goal,
  userTz,
  targetDate,
}: {
  goal: GoalListItem;
  userTz: string;
  targetDate: Date | string | null;
}) {
  const snapCount = goal.snapshotCount ?? 0;
  if (snapCount < 2) {
    return (
      <p className="mt-1 text-[10.5px] text-slate-400 dark:text-slate-500">
        Take another snapshot to see projections.
      </p>
    );
  }
  if (!goal.projectedHitDate) return null;
  const eta = new Date(goal.projectedHitDate);
  let tone = "text-slate-500 dark:text-slate-400";
  let prefix = "On pace to hit";
  if (targetDate) {
    const target = new Date(targetDate).getTime();
    if (eta.getTime() <= target) {
      tone = "text-emerald-600 dark:text-emerald-400";
      prefix = "Ahead of target — pace hits";
    } else {
      tone = "text-amber-600 dark:text-amber-400";
      prefix = "Behind target — pace hits";
    }
  }
  return (
    <p className={`mt-1 text-[10.5px] ${tone}`}>
      {prefix} {formatDate(eta, userTz, "medium")}
    </p>
  );
}

function GoalPicker({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const createMutation = trpc.personal.goals.create.useMutation({
    onSuccess: () => {
      utils.personal.goals.list.invalidate();
      onClose();
    },
  });
  const [targetDate, setTargetDate] = useState<string>("");

  const submit = (tpl: GoalTemplate) => {
    createMutation.mutate({
      goalKind: tpl.goalKind,
      pillarKey: tpl.pillarKey,
      label: tpl.label,
      targetScore: tpl.targetScore,
      targetDate: targetDate ? new Date(targetDate) : null,
    });
  };

  return (
    <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40 sm:px-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Pick a template
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={createMutation.isPending}
            onClick={() => submit(t)}
            className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-emerald-400 hover:bg-emerald-50/50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/20"
          >
            <span aria-hidden className="text-base leading-none">
              {t.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                {t.label}
              </span>
              <span className="block text-[10.5px] text-slate-500 dark:text-slate-400">
                {t.hint}
              </span>
            </span>
          </button>
        ))}
      </div>
      <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
        Target date (optional)
        <input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
