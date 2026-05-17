"use client";

type FunnelData = {
  signedUp: number;
  joinedGroup: number;
  addedExpense: number;
  loggedPersonalEntry: number;
  startedScorecard: number;
  completedScorecard: number;
};

const STAGES: { key: keyof FunnelData; label: string; hint: string }[] = [
  { key: "signedUp", label: "Signed up", hint: "Created an account" },
  {
    key: "joinedGroup",
    label: "Joined a group",
    hint: "Created or joined ≥1 group",
  },
  {
    key: "addedExpense",
    label: "Added an expense",
    hint: "Paid for / split a bill in a group",
  },
  {
    key: "loggedPersonalEntry",
    label: "Logged personal entry",
    hint: "Added income / expense / investment in /personal",
  },
  {
    key: "startedScorecard",
    label: "Started scorecard",
    hint: "Saved a financial profile (any state)",
  },
  {
    key: "completedScorecard",
    label: "Completed scorecard",
    hint: "Got their first score snapshot",
  },
];

export function ActivationFunnel({
  data,
  loading,
}: {
  data: FunnelData | undefined;
  loading: boolean;
}) {
  if (loading || !data) {
    return (
      <div className="space-y-2">
        {STAGES.map((s) => (
          <div
            key={s.key}
            className="h-9 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900"
          />
        ))}
      </div>
    );
  }

  const total = data.signedUp || 1;
  return (
    <ul className="space-y-2">
      {STAGES.map((stage, i) => {
        const value = data[stage.key];
        const pct = Math.round((value / total) * 100);
        const prev = i > 0 ? data[STAGES[i - 1].key] : null;
        const stepPct = prev !== null && prev > 0
          ? Math.round((value / prev) * 100)
          : null;
        return (
          <li key={stage.key}>
            <div className="flex items-baseline justify-between text-xs">
              <span title={stage.hint} className="font-medium">
                {stage.label}
              </span>
              <span className="tabular-nums text-slate-500 dark:text-slate-400">
                {value.toLocaleString("en-IN")} ·{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {pct}%
                </span>
                {stepPct !== null && (
                  <span className="ml-1.5 text-slate-400">
                    (step {stepPct}%)
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500 transition-[width] duration-500"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
