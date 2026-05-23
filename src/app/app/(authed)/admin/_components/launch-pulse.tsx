"use client";

import { useMemo, useState } from "react";
import { Rocket, TrendingUp, Users } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useUserTimezone } from "@/lib/use-user-timezone";

/**
 * Launch-day "pulse" — live signups bucketed in 5-minute windows.
 *
 * Surfaces only when ?launch=1 is in the URL so the tile stays
 * dormant outside of actual launch windows. Refetches every 30 sec
 * during a launch to keep the founder's view honest while replies/
 * upvotes are flying around.
 */
export function LaunchPulse() {
  const [hours, setHours] = useState<6 | 12 | 24>(6);
  const tz = useUserTimezone();
  const pulseQuery = trpc.admin.launchPulse.useQuery(
    { hours },
    {
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    },
  );

  const data = pulseQuery.data;

  // Sparkline path. We compute the SVG path string for a tiny inline
  // visualisation of bucket counts — recharts is overkill for a
  // launch-day glance widget.
  const sparkPath = useMemo(() => {
    if (!data?.buckets || data.buckets.length < 2) return null;
    const counts = data.buckets.map((b) => b.count);
    const max = Math.max(...counts, 1);
    const w = 320;
    const h = 56;
    const stepX = w / Math.max(1, counts.length - 1);
    return counts
      .map((c, i) => {
        const x = i * stepX;
        const y = h - (c / max) * (h - 4) - 2;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data]);

  return (
    <section
      aria-label="Launch pulse"
      className="rounded-2xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50/80 via-rose-50/60 to-amber-50/60 p-4 dark:border-fuchsia-900/50 dark:from-fuchsia-950/30 dark:via-rose-950/20 dark:to-amber-950/20 sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Rocket
            className="mt-0.5 h-4 w-4 text-fuchsia-600 dark:text-fuchsia-400"
            aria-hidden
          />
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Launch pulse
            </h2>
            <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
              Live signups in 5-min windows · refreshes every 30s ·{" "}
              <span className="font-mono">?launch=1</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
          {([6, 12, 24] as const).map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHours(h)}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                hours === h
                  ? "bg-fuchsia-500 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {h}h
            </button>
          ))}
        </div>
      </header>

      {pulseQuery.isPending ? (
        <p className="mt-4 text-[12px] text-slate-500 dark:text-slate-400">
          Loading window…
        </p>
      ) : !data ? (
        <p className="mt-4 text-[12px] text-rose-600 dark:text-rose-400">
          Couldn&apos;t load launch pulse. Check Vercel logs.
        </p>
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Kpi
              icon={<Users className="h-3.5 w-3.5" aria-hidden />}
              label="Signups"
              value={String(data.totalSignups)}
              hint={`last ${data.windowHours}h`}
            />
            <Kpi
              icon={<TrendingUp className="h-3.5 w-3.5" aria-hidden />}
              label="Peak 5-min"
              value={data.peakBucket ? String(data.peakBucket.count) : "—"}
              hint={
                data.peakBucket
                  ? formatHm(new Date(data.peakBucket.bucketAt), tz)
                  : "no spike yet"
              }
            />
            <Kpi
              icon={<Rocket className="h-3.5 w-3.5" aria-hidden />}
              label="Top source"
              value={data.topReferrers[0]?.name ?? "—"}
              hint={
                data.topReferrers[0]
                  ? `${data.topReferrers[0].count} signups`
                  : ""
              }
            />
          </div>

          {/* Sparkline */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/50">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Signups per 5-min bucket
            </p>
            <div className="mt-1.5">
              {sparkPath ? (
                <svg
                  width={320}
                  height={56}
                  viewBox="0 0 320 56"
                  className="w-full max-w-full"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    d={sparkPath}
                    fill="none"
                    stroke="#d946ef"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Need at least 2 buckets with data to draw the line.
                </p>
              )}
            </div>
          </div>

          {/* Top referrers in window */}
          {data.topReferrers.length > 0 && (
            <div className="mt-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Top sources in window
              </p>
              <ul className="mt-1.5 space-y-1">
                {data.topReferrers.map((r) => (
                  <li
                    key={r.name}
                    className="flex items-center justify-between gap-2 text-[12px]"
                  >
                    <span className="truncate text-slate-700 dark:text-slate-200">
                      {r.name}
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {r.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <span aria-hidden className="text-fuchsia-500">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-0.5 truncate text-lg font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
        {value}
      </div>
      {hint && (
        <div className="truncate text-[10.5px] text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      )}
    </div>
  );
}

function formatHm(d: Date, tz: string): string {
  try {
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
      hour12: false,
    });
  } catch {
    return d.toISOString().slice(11, 16);
  }
}
