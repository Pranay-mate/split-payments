"use client";

import { AlertTriangle, BellOff } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { CATEGORIES, toCategoryKey, type CategoryKey } from "@/lib/categories";
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
 *   - "Mute 30d" link per row (v3.5.1) — hides this category from both
 *     the banner and the cron's anomaly push for 30 days.
 */
export function AnomalyBanner() {
  const q = trpc.personal.anomalies.useQuery();
  const utils = trpc.useUtils();
  const muteMutation = trpc.personal.mutes.create.useMutation({
    onSuccess: () => utils.personal.anomalies.invalidate(),
    onError: (err) => toast.error(err.message),
  });
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
          <ul className="mt-2 space-y-2 text-xs text-amber-900/90 dark:text-amber-200/90">
            {anomalies.map((a) => {
              const meta = CATEGORIES[toCategoryKey(a.category)];
              const pct = Math.round(a.severity * 100);
              return (
                <li
                  key={a.category}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
                >
                  <span className="flex-1 min-w-0">
                    <span aria-hidden>{meta.emoji}</span>{" "}
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
                  <button
                    type="button"
                    onClick={() => {
                      muteMutation.mutate(
                        {
                          category: toCategoryKey(a.category) as CategoryKey,
                          days: 30,
                        },
                        {
                          onSuccess: () =>
                            toast.success(
                              `${meta.label} muted for 30 days`,
                            ),
                        },
                      );
                    }}
                    disabled={muteMutation.isPending}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-white/60 px-2 py-0.5 text-[10.5px] font-medium text-amber-800 transition hover:bg-white disabled:opacity-60 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/70"
                    title={`Hide ${meta.label} alerts for 30 days`}
                  >
                    <BellOff className="h-3 w-3" aria-hidden />
                    Mute 30d
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
