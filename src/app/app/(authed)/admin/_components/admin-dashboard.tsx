"use client";

import dynamic from "next/dynamic";
import { AlertCircle, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { KpiTile } from "./kpi-tile";
import { ActivationFunnel } from "./activation-funnel";
import { ActivityFeed } from "./activity-feed";

const SignupsChart = dynamic(
  () => import("./signups-chart").then((m) => m.SignupsChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
    ),
  },
);

export function AdminDashboard() {
  // Admin queries are aggregate counts — staleTime of 60s is fine.
  // retry: 1 prevents a refetch storm if the server hits a regression
  // (the previous unbounded retry-with-backoff turned a single slow query
  // into 3+ slow queries piled up against the connection pool).
  // refetchOnWindowFocus disabled so tab-switching doesn't re-hammer.
  const opts = {
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  } as const;
  const pulse = trpc.admin.pulse.useQuery(undefined, opts);
  const signups = trpc.admin.signupsByDay.useQuery(undefined, opts);
  const funnel = trpc.admin.funnel.useQuery(undefined, opts);
  const referrers = trpc.admin.topReferrers.useQuery(undefined, opts);
  const feed = trpc.admin.feed.useQuery(undefined, { ...opts, staleTime: 30_000 });

  const p = pulse.data;
  const firstError =
    pulse.error?.message ??
    signups.error?.message ??
    funnel.error?.message ??
    feed.error?.message ??
    null;

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Admin
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Founder-only observability surface · aggregate-only metrics
          </p>
        </div>
      </div>

      {/* Error banner — surfaces failed queries instead of leaving the
          page in perpetual loading state. */}
      {firstError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 dark:border-rose-900/60 dark:bg-rose-950/30">
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400"
            aria-hidden
          />
          <div className="min-w-0 text-[12px] text-rose-900 dark:text-rose-200">
            <p className="font-semibold">Some admin queries failed</p>
            <p className="mt-0.5 break-words font-mono text-[11px] opacity-80">
              {firstError}
            </p>
            <p className="mt-1.5 opacity-80">
              Check Vercel Dashboard → Functions → Logs for the full server-side
              stack trace.
            </p>
          </div>
        </div>
      )}

      {/* Privacy banner */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
        <Lock
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400"
          aria-hidden
        />
        <p className="text-[11.5px] leading-relaxed text-amber-900 dark:text-amber-200">
          <strong>Privacy lock:</strong> every metric on this page is aggregate
          or anonymised. Amounts surface as buckets (
          <code>₹&lt;100</code> · <code>₹100-500</code> · <code>₹500-2k</code>{" "}
          · <code>₹2k+</code>), never exact. User IDs in the feed are truncated
          to a 4-char prefix. Personal-entry payloads stay encrypted — we never
          decrypt them here.
        </p>
      </div>

      {/* KPI grid */}
      <section
        aria-label="Pulse KPIs"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        <KpiTile
          label="Total users"
          value={p?.totalUsers.value}
          delta={p?.totalUsers.delta}
          sparkline={p?.totalUsers.sparkline.map((s) => s.count) ?? []}
          loading={pulse.isLoading}
        />
        <KpiTile
          label="DAU"
          tooltip="Distinct users with any event in the last 24h"
          value={p?.dau.value}
          delta={p?.dau.delta}
          loading={pulse.isLoading}
        />
        <KpiTile
          label="WAU"
          tooltip="Distinct users with any event in the last 7d"
          value={p?.wau.value}
          delta={p?.wau.delta}
          loading={pulse.isLoading}
        />
        <KpiTile
          label="MAU"
          tooltip="Distinct users with any event in the last 30d"
          value={p?.mau.value}
          loading={pulse.isLoading}
        />
        <KpiTile
          label="Stickiness"
          tooltip="DAU ÷ MAU — target 20%+"
          value={p ? `${p.stickiness.value}%` : undefined}
          loading={pulse.isLoading}
        />
        <KpiTile
          label="Today · signups"
          value={p?.todaySignups.value}
          sparkline={p?.todaySignups.sparkline.map((s) => s.count) ?? []}
          loading={pulse.isLoading}
        />
        <KpiTile
          label="Today · groups"
          value={p?.todayGroups.value}
          sparkline={p?.todayGroups.sparkline.map((s) => s.count) ?? []}
          loading={pulse.isLoading}
        />
        <KpiTile
          label="Today · expenses"
          value={p?.todayExpenses.value}
          sparkline={p?.todayExpenses.sparkline.map((s) => s.count) ?? []}
          loading={pulse.isLoading}
        />
        <KpiTile
          label="Push subscribers"
          tooltip="Active Web Push subscriptions across all users"
          value={p?.activePushSubs.value}
          loading={pulse.isLoading}
        />
      </section>

      {/* Signups chart */}
      <section
        aria-label="Signups over time"
        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Signups · last 90 days</h2>
          <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
            7-day rolling avg overlay
          </span>
        </div>
        <div className="mt-3">
          <SignupsChart data={signups.data ?? []} loading={signups.isLoading} />
        </div>
      </section>

      {/* Activation funnel */}
      <section
        aria-label="Activation funnel"
        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Activation funnel</h2>
          <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
            Where users drop off
          </span>
        </div>
        <div className="mt-3">
          <ActivationFunnel data={funnel.data} loading={funnel.isLoading} />
        </div>
      </section>

      {/* Top referrers */}
      <section
        aria-label="Top referrers"
        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Top referrers</h2>
          <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
            Tracked via <code>?from=</code> on the homepage
          </span>
        </div>
        <div className="mt-3">
          {referrers.isLoading ? (
            <div className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900" />
          ) : referrers.data && referrers.data.referrers.length > 0 ? (
            <>
              <ul className="space-y-1.5">
                {referrers.data.referrers.map((r, i) => (
                  <li
                    key={`${r.name}-${i}`}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                        {i + 1}
                      </span>
                      <span className="truncate font-medium">{r.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">
                      {r.count.toLocaleString("en-IN")}{" "}
                      <span className="text-slate-400">
                        {r.count === 1 ? "signup" : "signups"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                + {referrers.data.coldSignups.toLocaleString("en-IN")} cold /
                organic signups (no <code>?from=</code>)
              </p>
            </>
          ) : (
            <p className="py-4 text-center text-[12.5px] text-slate-500 dark:text-slate-400">
              No attributed invites yet. Share a{" "}
              <code>?from=&lt;your-name&gt;</code> link from the Share-with-
              friends menu — they&apos;ll show up here once someone signs up
              via it.
            </p>
          )}
        </div>
      </section>

      {/* Activity feed */}
      <section
        aria-label="Anonymised activity feed"
        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Recent activity</h2>
          <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
            Anonymised · last {feed.data?.length ?? 50}
          </span>
        </div>
        <div className="mt-3">
          <ActivityFeed data={feed.data ?? []} loading={feed.isLoading} />
        </div>
      </section>
    </main>
  );
}
