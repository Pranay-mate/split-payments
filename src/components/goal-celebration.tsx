"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { ShareMilestoneButton } from "@/components/share-milestone-button";

/**
 * Detects "goal-just-completed" transitions in the goals list and
 * surfaces a one-time celebration overlay with confetti + auto-prompted
 * share button. We persist seen goal-completion IDs to localStorage so
 * the user only sees the celebration once per goal, even across reloads.
 *
 * The component is intentionally additive — it does not require any
 * server-side flag. Pass the current goal list and we diff against the
 * persisted "seen" set to decide whether to fire.
 */
type GoalLike = {
  id: string;
  label: string;
  completedAt: Date | string | null;
};

const STORAGE_KEY = "easysplits.goal-celebration.seen.v1";

function readSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function persistSeen(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // Quota / disabled storage — silent. We'll re-celebrate next load
    // which is annoying but harmless.
  }
}

async function fireConfetti(): Promise<void> {
  // Lazy-load canvas-confetti only when a goal actually completes, so
  // the ~10 KB lib stays out of the initial /app bundle.
  const { default: confetti } = await import("canvas-confetti");
  const duration = 2_000;
  const end = Date.now() + duration;
  const palette = ["#10b981", "#f59e0b", "#6366f1", "#f43f5e", "#a855f7"];

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      startVelocity: 50,
      origin: { x: 0, y: 0.7 },
      colors: palette,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      startVelocity: 50,
      origin: { x: 1, y: 0.7 },
      colors: palette,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function GoalCelebration({ goals }: { goals: GoalLike[] }) {
  const seenRef = useRef<Set<string> | null>(null);
  const [pending, setPending] = useState<GoalLike | null>(null);

  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = readSeen();
    }
    const seen = seenRef.current;

    // Find the most recently completed goal that hasn't been celebrated
    // yet. Sort by completedAt desc so the freshest one wins if multiple
    // hit at once.
    const fresh = goals
      .filter((g) => g.completedAt && !seen.has(g.id))
      .sort((a, b) => {
        const at = new Date(a.completedAt!).getTime();
        const bt = new Date(b.completedAt!).getTime();
        return bt - at;
      });

    if (fresh.length === 0) return;

    // First mount: if the user already had completed goals before this
    // component existed, mark them all seen but don't celebrate them
    // (no surprise pop-ups for old wins). We detect "first mount" as
    // an empty seen-set + multiple already-completed goals.
    if (seen.size === 0 && fresh.length > 1) {
      for (const g of fresh) seen.add(g.id);
      persistSeen(seen);
      return;
    }

    const target = fresh[0];
    seen.add(target.id);
    persistSeen(seen);
    setPending(target);
    void fireConfetti();
  }, [goals]);

  if (!pending) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6"
      role="dialog"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-amber-50 shadow-2xl shadow-emerald-200/50 dark:border-emerald-700 dark:from-emerald-950 dark:via-slate-900 dark:to-amber-950 dark:shadow-emerald-900/40">
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
              Goal hit
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">
              {pending.label}
            </p>
            <p className="mt-1 text-[11.5px] text-slate-600 dark:text-slate-400">
              That&apos;s a real win — share it and inspire someone to
              start their own scorecard.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <ShareMilestoneButton
                shareUrl={`/share/goal?label=${encodeURIComponent(pending.label)}`}
                title="Goal hit on EasySplits"
                text={`Just hit my financial goal: ${pending.label} 🎯 — try the free scorecard: `}
                label="Share now"
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:from-emerald-600 hover:to-teal-600"
              />
              <button
                type="button"
                onClick={() => setPending(null)}
                className="text-[11px] font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Maybe later
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPending(null)}
            className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
