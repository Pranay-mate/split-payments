"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { ALL_BADGES, deriveBadges } from "@/lib/financial-badges";

const friendlyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

export function BadgesStrip() {
  const q = trpc.personal.profile.history.useQuery({ limit: 24 });
  const history = useMemo(() => q.data ?? [], [q.data]);
  const earned = useMemo(() => deriveBadges(history), [history]);
  const [showLocked, setShowLocked] = useState(false);

  if (q.isLoading) return null;
  if (history.length === 0) return null;

  const earnedByKey = new Map(earned.map((b) => [b.key, b]));
  const locked = ALL_BADGES.filter((b) => !earnedByKey.has(b.key));

  return (
    <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Achievements · {earned.length}/{ALL_BADGES.length}
        </p>
        {locked.length > 0 && (
          <button
            type="button"
            onClick={() => setShowLocked((s) => !s)}
            className="inline-flex items-center gap-0.5 text-[10.5px] font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {showLocked ? "Hide" : `+${locked.length} locked`}
            <ChevronDown
              className={`h-3 w-3 transition-transform ${showLocked ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        )}
      </div>

      {earned.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {earned.map((b) => (
            <li
              key={b.key}
              title={`${b.description} · ${friendlyDate(b.earnedOn)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50 px-2.5 py-1 text-xs dark:border-amber-900/40 dark:from-amber-950/30 dark:to-orange-950/30"
            >
              <span aria-hidden className="text-sm leading-none">
                {b.emoji}
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {b.label}
              </span>
            </li>
          ))}
        </ul>
      )}

      {showLocked && locked.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {locked.map((b) => (
            <li
              key={b.key}
              title={b.description}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/60 px-2.5 py-1 text-xs opacity-60 dark:border-slate-800 dark:bg-slate-800/30"
            >
              <span aria-hidden className="text-sm leading-none grayscale">
                {b.emoji}
              </span>
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {b.label}
              </span>
              <Lock className="h-3 w-3 text-slate-400" aria-hidden />
            </li>
          ))}
        </ul>
      )}

      {earned.length === 0 && !showLocked && (
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          Improve any pillar to unlock your first badge.
        </p>
      )}
    </div>
  );
}
