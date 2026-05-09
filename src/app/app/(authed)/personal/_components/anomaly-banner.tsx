"use client";

import { AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { CATEGORIES, toCategoryKey } from "@/lib/categories";
import { formatINR } from "@/lib/format";

/**
 * Amber banner highlighting categories where this month's spend is
 * meaningfully above the user's own historical baseline. Renders only
 * when ≥1 anomaly is detected — silent on quiet months.
 *
 * UX rules (from PLANNING):
 *   - Amber, not red — "hey, look", not emergency.
 *   - Up to 2 anomalies max (the detector enforces this).
 *   - Show absolute current + baseline so the framing is "you usually
 *     spend X here, this month it's Y", not just a percentage.
 */
export function AnomalyBanner() {
  const q = trpc.personal.anomalies.useQuery();
  const anomalies = q.data ?? [];
  if (q.isLoading || anomalies.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-4 dark:border-amber-900/60 dark:from-amber-950/40 dark:to-orange-950/30">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-200 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
        >
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Heads-up — anything off this month?
          </p>
          <ul className="mt-1.5 space-y-1.5 text-xs text-amber-900/90 dark:text-amber-200/90">
            {anomalies.map((a) => {
              const meta = CATEGORIES[toCategoryKey(a.category)];
              const pct = Math.round(a.severity * 100);
              return (
                <li key={a.category} className="flex items-baseline gap-1.5">
                  <span aria-hidden>{meta.emoji}</span>
                  <span>
                    <strong>{meta.label}</strong> up{" "}
                    <strong className="tabular-nums">{pct}%</strong> ·{" "}
                    {formatINR(a.current, 0)} this month vs{" "}
                    {formatINR(a.baseline, 0)} usual
                    <span className="text-amber-700/80 dark:text-amber-300/80">
                      {" "}
                      ({a.entryCount}{" "}
                      {a.entryCount === 1 ? "entry" : "entries"})
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
