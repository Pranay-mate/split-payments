"use client";

import { useMemo } from "react";
import { Lock } from "lucide-react";
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

  // Only suppress while loading. After load, always render the section
  // so users can see the full set of achievements (earned + locked).
  if (q.isLoading) return null;
  if (history.length === 0) return null;

  const earnedByKey = new Map(earned.map((b) => [b.key, b]));

  return (
    <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Achievements · {earned.length}/{ALL_BADGES.length} unlocked
        </p>
        {earned.length === 0 && (
          <p className="text-[10.5px] text-slate-400 dark:text-slate-500">
            Improve any pillar to unlock your first badge.
          </p>
        )}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ALL_BADGES.map((b) => {
          const got = earnedByKey.get(b.key);
          const isEarned = !!got;
          return (
            <li
              key={b.key}
              title={b.description}
              className={
                isEarned
                  ? "group relative flex items-start gap-2 rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50 px-3 py-2.5 dark:border-amber-900/40 dark:from-amber-950/30 dark:to-orange-950/30"
                  : "group relative flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 opacity-60 dark:border-slate-800 dark:bg-slate-800/30"
              }
            >
              <span
                aria-hidden
                className={`text-xl leading-none ${
                  isEarned ? "drop-shadow-sm" : "grayscale"
                }`}
              >
                {b.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {b.label}
                  {!isEarned && (
                    <Lock className="h-3 w-3 text-slate-400" aria-hidden />
                  )}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {isEarned ? friendlyDate(got.earnedOn) : b.description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
