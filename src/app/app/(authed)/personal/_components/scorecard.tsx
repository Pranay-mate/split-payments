"use client";

import Link from "next/link";
import { ArrowRight, Flame, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { PEER_CITATIONS, type ScoreResult } from "@/lib/financial-score";
import { pillarSeries } from "@/lib/financial-badges";
import { trpc } from "@/lib/trpc/client";
import { ShareMilestoneButton } from "@/components/share-milestone-button";
import { BadgesStrip } from "./badges-strip";
import { PillarSparkline } from "./pillar-sparkline";
import {
  ScoreTrajectory,
  summariseSnapshots,
} from "./score-trajectory";

const BAND_GRADIENT: Record<ScoreResult["band"], string> = {
  red: "from-rose-500 via-rose-600 to-red-700",
  amber: "from-amber-500 via-orange-500 to-rose-500",
  emerald: "from-emerald-500 via-emerald-600 to-teal-600",
  green: "from-emerald-400 via-emerald-500 to-green-600",
};

const BAND_LABEL: Record<ScoreResult["band"], string> = {
  red: "Needs attention",
  amber: "Room to grow",
  emerald: "Solid foundations",
  green: "Excellent shape",
};

const PILLAR_RING: Record<ScoreResult["band"], string> = {
  red: "stroke-rose-500",
  amber: "stroke-amber-500",
  emerald: "stroke-emerald-500",
  green: "stroke-green-500",
};

const PILLAR_SPARK_HEX: Record<ScoreResult["band"], string> = {
  red: "#f43f5e",
  amber: "#f59e0b",
  emerald: "#10b981",
  green: "#16a34a",
};

function ringFor(score: number): keyof typeof PILLAR_RING {
  if (score >= 16) return "green";
  if (score >= 12) return "emerald";
  if (score >= 8) return "amber";
  return "red";
}

function PillarRing({ score, max = 20 }: { score: number; max?: number }) {
  const size = 44;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - score / max);
  const band = ringFor(score);
  return (
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
          strokeWidth={stroke}
          strokeDasharray={C}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={`transition-[stroke-dashoffset] duration-700 ${PILLAR_RING[band]}`}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[10px] font-bold tabular-nums">
        {score}
      </span>
    </div>
  );
}

export function Scorecard({
  score,
  exists,
  loading,
}: {
  score: ScoreResult | null;
  exists: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </section>
    );
  }

  if (!exists || !score || !score.hasEnoughData) {
    return (
      <section className="overflow-hidden rounded-2xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-violet-50 to-indigo-50 p-5 dark:border-fuchsia-900/40 dark:from-fuchsia-950/40 dark:via-violet-950/40 dark:to-indigo-950/40">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-white shadow-sm"
          >
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-semibold tracking-tight">
              Get your Financial Health Score
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              5 quick questions · ₹0, no advice, just rules of thumb based on
              what people typically aim for.
            </p>
          </div>
        </div>
        <Link
          href="/app/personal/onboard"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:w-auto"
        >
          Start the 60-second check
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>
    );
  }

  return <ScorecardWithHistory score={score} />;
}

function ScorecardWithHistory({ score }: { score: ScoreResult }) {
  const historyQuery = trpc.personal.profile.history.useQuery({ limit: 24 });
  const history = historyQuery.data ?? [];
  const summary = summariseSnapshots(history);
  const series = pillarSeries(history);

  // Sort pillars: gaps (<15) first, maxed (≥15) collapsed below — surfaces
  // what to fix without forcing the user to scan past their wins.
  const gapPillars = score.pillars.filter((p) => p.score < 15);
  const maxedPillars = score.pillars.filter((p) => p.score >= 15);

  // Top action: highest-value next-action across the gap pillars.
  const topAction = gapPillars.find((p) => p.nextAction)?.nextAction ?? null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Hero band — total score + delta + streak */}
      <div
        className={`bg-gradient-to-br ${BAND_GRADIENT[score.band]} px-5 py-5 text-white`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Financial Health Score
            </p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
              <p className="text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">
                {score.total}
                <span className="ml-1 text-xl font-medium text-white/90">
                  /100
                </span>
              </p>
              {summary.delta !== null && summary.delta !== 0 && (
                <span
                  className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    summary.delta > 0
                      ? "bg-white/20 text-white"
                      : "bg-black/20 text-white/95"
                  }`}
                >
                  {summary.delta > 0 ? (
                    <TrendingUp className="h-3 w-3" aria-hidden />
                  ) : (
                    <TrendingDown className="h-3 w-3" aria-hidden />
                  )}
                  {summary.delta > 0 ? "+" : ""}
                  {summary.delta} since last
                </span>
              )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-white/90">
              {BAND_LABEL[score.band]}
              {summary.streakMonths >= 2 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
                  <Flame className="h-3 w-3" aria-hidden />
                  {summary.streakMonths}-month green streak
                </span>
              )}
            </p>
            {topAction && (
              <p className="mt-3 text-xs text-white/95">
                <span className="font-semibold uppercase tracking-wider text-white/90">
                  Top action ·{" "}
                </span>
                {topAction}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Link
              href="/app/personal/onboard"
              className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-white/25"
            >
              Update
            </Link>
            {/* Share milestone — only show on emerald/green so users
                aren't prompted to share an unflattering score. */}
            {(score.band === "emerald" || score.band === "green") && (
              <ShareMilestoneButton
                shareUrl={`/share/score?score=${score.total}&band=${score.band}`}
                title={`I scored ${score.total}/100 on EasySplits`}
                text={`My Financial Health Score is ${score.total}/100 — ${score.band === "green" ? "in the green band 🌟" : "solid foundations 🏛️"}. Check yours: `}
                label="Share"
                className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur transition hover:bg-white/25"
              />
            )}
          </div>
        </div>
      </div>

      {/* Pillars — gap pillars first (full detail), maxed ones in a
          condensed strip below so the user's eye lands on what they
          can actually improve. */}
      <ul className="divide-y divide-slate-100 px-5 py-3 dark:divide-slate-800">
        {gapPillars.map((p) => {
          const pillarSpark = (series[p.key] ?? []).map((s) => s.score);
          return (
          <li key={p.key} className="flex items-start gap-3 py-3">
            <PillarRing score={p.score} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <span aria-hidden>{p.emoji}</span>
                {p.label}
                <span className="ml-auto flex items-center gap-2">
                  {pillarSpark.length >= 2 && (
                    <PillarSparkline
                      series={pillarSpark}
                      hex={PILLAR_SPARK_HEX[ringFor(p.score)]}
                    />
                  )}
                  <span className="text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                    {p.score}/20
                  </span>
                </span>
              </p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                {p.message}
              </p>
              <p className="mt-1 text-[10.5px] italic text-slate-500 dark:text-slate-500">
                {p.peerBaseline}
              </p>
              {p.nextAction && (
                <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  → {p.nextAction}
                </p>
              )}
            </div>
          </li>
          );
        })}
      </ul>

      {maxedPillars.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/30">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Nailed it · {maxedPillars.length} pillar
            {maxedPillars.length === 1 ? "" : "s"} maxed
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {maxedPillars.map((p) => (
              <li
                key={p.key}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200"
                title={p.message}
              >
                <span aria-hidden>{p.emoji}</span>
                {p.label}
                <span className="text-[10px] tabular-nums text-emerald-600 dark:text-emerald-400">
                  {p.score}/20
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <BadgesStrip />

      {summary.history.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Trajectory · last {summary.history.length}{" "}
            {summary.history.length === 1 ? "snapshot" : "snapshots"}
          </p>
          <div className="mt-2">
            <ScoreTrajectory />
          </div>
        </div>
      )}

      <div className="space-y-1 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <p>
          Rules of thumb, not financial advice. We&apos;re not a SEBI-registered
          investment advisor — for major decisions, talk to one.
        </p>
        <details className="text-[10.5px]">
          <summary className="cursor-pointer text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300">
            Peer-baseline sources
          </summary>
          <ul className="mt-1 space-y-0.5 pl-3">
            {PEER_CITATIONS.map((c) => (
              <li key={c}>· {c}</li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}
