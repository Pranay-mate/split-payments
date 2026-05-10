/**
 * Share landing page — the URL we share via WhatsApp / X / LinkedIn /
 * etc. Three jobs:
 *
 *   1. Open Graph meta tags pointing to /api/og/milestone — so link
 *      previews on every platform render the rich image card.
 *   2. Real HTML page with the same milestone copy + a clear CTA back
 *      into the app. The previous share UX shared the OG image URL
 *      directly; recipients saw a PNG but had nowhere to go.
 *   3. Public — no auth needed. Anyone with the URL views it.
 *
 * URL shapes:
 *   /share/score?score=87&band=green&initial=P
 *   /share/badge?label=Safety+Net&emoji=🪂&initial=P
 *   /share/goal?label=Hit+₹15L+health+cover&initial=P
 *   /share/settled?group=Goa+weekend&initial=P
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles, Trophy } from "lucide-react";
import { SITE } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";

const VALID_TYPES = ["score", "badge", "goal", "settled", "monthly-review"] as const;
type ShareType = (typeof VALID_TYPES)[number];

const BAND_BG: Record<string, string> = {
  red: "bg-gradient-to-br from-rose-500 to-red-700",
  amber: "bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500",
  emerald: "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600",
  green: "bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-600",
};

const BAND_LABEL: Record<string, string> = {
  red: "Needs attention",
  amber: "Room to grow",
  emerald: "Solid foundations",
  green: "Excellent shape",
};

type Params = Promise<{ type: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function isShareType(t: string): t is ShareType {
  return (VALID_TYPES as readonly string[]).includes(t);
}

function pickStr(
  v: string | string[] | undefined,
  fallback = "",
): string {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

/** Build the `/api/og/milestone?...` URL from search params, mirroring
 *  whatever the page is showing. Used both for og:image meta and for
 *  the in-page preview thumbnail. */
function buildOgUrl(
  type: ShareType,
  search: Awaited<SearchParams>,
): string {
  const usp = new URLSearchParams({ type });
  for (const key of ["score", "band", "initial", "emoji", "label", "group", "month", "savings", "top"]) {
    const v = pickStr(search[key]);
    if (v) usp.set(key, v);
  }
  return `${SITE.url}/api/og/milestone?${usp.toString()}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { type: rawType } = await params;
  const search = await searchParams;
  const type: ShareType = isShareType(rawType) ? rawType : "score";

  const ogUrl = buildOgUrl(type, search);
  const headline = headlineFor(type, search);

  return buildMetadata({
    title: headline.title,
    description: headline.description,
    path: `/share/${type}`,
    image: ogUrl,
    // Don't index user-shared milestone pages — they contain user data
    // even if it's just initials + score.
    noIndex: true,
  });
}

function headlineFor(
  type: ShareType,
  s: Awaited<SearchParams>,
): { title: string; description: string } {
  const initial = pickStr(s.initial, "Someone");
  if (type === "badge") {
    const label = pickStr(s.label, "Achievement unlocked");
    return {
      title: `${label} · ${SITE.name}`,
      description: `${initial} just unlocked "${label}" on ${SITE.name}. Track your own financial milestones — free, India-first.`,
    };
  }
  if (type === "goal") {
    const label = pickStr(s.label, "Goal hit");
    return {
      title: `${label} · ${SITE.name}`,
      description: `${initial} hit a financial goal: ${label}. Set and track your own — free.`,
    };
  }
  if (type === "settled") {
    const group = pickStr(s.group, "Group");
    return {
      title: `"${group}" all settled · ${SITE.name}`,
      description: `${initial}'s group "${group}" is fully settled. Try ${SITE.name} for your next trip — split + settle without drama.`,
    };
  }
  if (type === "monthly-review") {
    const month = pickStr(s.month, "Last month");
    const savings = pickStr(s.savings, "0");
    return {
      title: `${initial}'s ${month} wrap-up · ${SITE.name}`,
      description: `${initial} hit a ${savings}% savings rate in ${month}. Get your own monthly review — free, India-first.`,
    };
  }
  const score = pickStr(s.score, "0");
  return {
    title: `${initial}'s Financial Health Score: ${score}/100 · ${SITE.name}`,
    description: `India-specific 5-pillar Financial Health Scorecard. ${initial} scored ${score}/100. Get yours — free, 60 seconds, no advice fluff.`,
  };
}

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { type: rawType } = await params;
  const search = await searchParams;
  const type: ShareType = isShareType(rawType) ? rawType : "score";

  const initial = pickStr(search.initial, "Someone");
  const ogUrl = buildOgUrl(type, search);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
        {/* Milestone hero — visual mirror of the OG card so the page
            stays cohesive when users tap through from the link preview. */}
        <Hero
          type={type}
          search={search}
          initial={initial}
          ogUrl={ogUrl}
        />

        {/* Why-this-matters + CTA */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            <Sparkles className="h-5 w-5 text-indigo-500" aria-hidden />
            Get your own
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {ctaCopyFor(type)}
          </p>
          <ul className="mt-5 grid gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
            <li className="flex gap-2">
              <span className="text-emerald-500" aria-hidden>
                ✓
              </span>
              60-second Financial Health Scorecard (5 pillars)
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500" aria-hidden>
                ✓
              </span>
              Goals + achievement badges + anomaly alerts
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500" aria-hidden>
                ✓
              </span>
              Group splits with Simplified ⇄ Pairwise toggle
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500" aria-hidden>
                ✓
              </span>
              Encrypted at the field level — your salary stays yours
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500" aria-hidden>
                ✓
              </span>
              India-first defaults (INR · NCAER/RBI baselines)
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500" aria-hidden>
                ✓
              </span>
              Free forever · no third-party tracking
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={primaryHrefFor(type)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {primaryCtaFor(type)}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/calculators/trip"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Try without signup
            </Link>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            Standalone calculators · no signup · works offline · install as a PWA
          </p>
        </section>

        <p className="mt-6 text-center text-[11px] text-slate-400 dark:text-slate-500">
          Shared via {SITE.name}. We never reveal amounts unless the owner
          explicitly opts in.
        </p>
      </div>
    </main>
  );
}

function Hero({
  type,
  search,
  initial,
}: {
  type: ShareType;
  search: Awaited<SearchParams>;
  initial: string;
  ogUrl: string;
}) {
  if (type === "score") {
    const score = pickStr(search.score, "0");
    const band = pickStr(search.band, "emerald");
    const bandClass = BAND_BG[band] ?? BAND_BG.emerald;
    return (
      <section className={`overflow-hidden rounded-2xl ${bandClass} p-6 text-white shadow-sm sm:p-8`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
          {initial}&apos;s Financial Health Score
        </p>
        <p className="mt-2 text-6xl font-bold tabular-nums tracking-tight sm:text-7xl">
          {score}
          <span className="ml-1 text-3xl font-medium text-white/80">/100</span>
        </p>
        <p className="mt-1 text-base font-medium text-white/95 sm:text-lg">
          {BAND_LABEL[band] ?? "Solid foundations"}
        </p>
      </section>
    );
  }
  if (type === "badge") {
    const label = pickStr(search.label, "Achievement unlocked");
    const emoji = pickStr(search.emoji, "🏆");
    return (
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-6 text-center text-white shadow-sm sm:p-8">
        <div className="text-7xl sm:text-8xl" aria-hidden>
          {emoji}
        </div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-white/95 sm:text-xs">
          Achievement unlocked
        </p>
        <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {label}
        </p>
        <p className="mt-1 text-sm text-white/90">— {initial}</p>
      </section>
    );
  }
  if (type === "goal") {
    const label = pickStr(search.label, "Goal hit");
    return (
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 p-6 text-white shadow-sm sm:p-8">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/90">
          <Trophy className="h-3.5 w-3.5" aria-hidden /> Goal hit
        </p>
        <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {label}
        </p>
        <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/20">
          <div className="h-full w-full rounded-full bg-white" />
        </div>
        <p className="mt-2 text-sm font-medium text-white/95">
          100% complete · by {initial}
        </p>
      </section>
    );
  }
  if (type === "monthly-review") {
    const month = pickStr(search.month, "Last month");
    const savings = pickStr(search.savings, "0");
    const top = pickStr(search.top, "");
    return (
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
          Monthly wrap-up
        </p>
        <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {month}
        </p>
        <p className="mt-4 text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">
          {savings}
          <span className="ml-1 text-2xl font-medium text-white/80">% saved</span>
        </p>
        {top && (
          <p className="mt-3 text-2xl" aria-hidden>
            {Array.from(top).join(" ")}
          </p>
        )}
        <p className="mt-3 text-sm text-white/90">
          shared by {initial}
        </p>
      </section>
    );
  }
  // settled
  const group = pickStr(search.group, "Group");
  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 p-6 text-white shadow-sm sm:p-8">
      <div className="text-6xl font-bold sm:text-7xl">✓</div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-white/90">
        All settled
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        {group}
      </p>
      <p className="mt-1 text-sm text-white/90">
        Zero open balances · shared by {initial}
      </p>
    </section>
  );
}

function ctaCopyFor(type: ShareType): string {
  if (type === "score") {
    return "Take our 60-second Financial Health checkup — 5 pillars (Emergency, Insurance, Debt, Savings, Investing) scored against Indian rules of thumb. No advice fluff, no broker fees, no signup unless you want to save your score.";
  }
  if (type === "badge") {
    return "Earn your own achievements as you improve your finances. Built on top of the same 5-pillar scorecard — free, India-first, no broker upsells.";
  }
  if (type === "goal") {
    return "Set financial goals (insurance cover, savings rate, score targets) and watch them update as your scorecard improves. Free, encrypted, no advice claims.";
  }
  if (type === "monthly-review") {
    return "Get an automatic month-end wrap-up of your spending, savings rate, and biggest moves — like Spotify Wrapped, but for your money. Free, India-first, encrypted.";
  }
  return "Split bills with friends like adults. Multi-currency, simplify-payments without a paywall, voice input, comments per expense, offline-first PWA. Free.";
}

function primaryCtaFor(type: ShareType): string {
  if (type === "settled") return "Start a group";
  return "Get your free score";
}

function primaryHrefFor(type: ShareType): string {
  if (type === "settled") return "/app/groups";
  return "/use-cases/financial-health-india";
}
