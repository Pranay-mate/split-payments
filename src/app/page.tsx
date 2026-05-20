import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Send, Sparkles, Users, Wallet } from "lucide-react";
import { SITE, SPLIT_FEATURES, PERSONAL_FEATURES } from "@/lib/site";
import { organizationLd, softwareApplicationLd } from "@/lib/jsonld";
import { LiveScorecardDemo } from "@/components/live-scorecard-demo";
import { InstallFooterLink } from "@/components/install-footer-link";
import { ReferralCapture } from "@/components/referral-capture";

type SearchParams = Promise<{ from?: string | string[] }>;

/** Sanitize the ?from= name so it can't be used to inject XSS or
 *  exfiltrate via OG meta. Letters/digits/spaces only, length capped. */
function cleanFromName(raw: string | string[] | undefined): string | null {
  if (!raw) return null;
  const v = Array.isArray(raw) ? raw[0] : raw;
  const cleaned = v
    .replace(/[^a-zA-Zऀ-ॿ֐-׿\s'-]/g, "")
    .trim()
    .slice(0, 24);
  return cleaned.length > 0 ? cleaned : null;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const sp = await searchParams;
  const from = cleanFromName(sp.from);
  if (!from) return {};
  // Override the default homepage title/description AND OG image when
  // arriving via a shared link — the WhatsApp / Twitter / LinkedIn
  // preview becomes a personalised friend recommendation card.
  const initial = from.slice(0, 1).toUpperCase();
  const ogUrl = `/api/og/milestone?type=invite&from=${encodeURIComponent(from)}&initial=${encodeURIComponent(initial)}`;
  return {
    title: `${from} invited you to EasySplits`,
    description: `${from} thought you'd like this — a free, India-first app for splitting bills with friends and tracking your own money. Encrypted, no ads, works offline.`,
    openGraph: {
      title: `${from} invited you to EasySplits`,
      description: `${from} thinks you'll love EasySplits — try the free scorecard + group splitter.`,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: `${from} invited you to EasySplits` }],
    },
    twitter: {
      title: `${from} invited you to EasySplits`,
      description: `${from} thinks you'll love EasySplits — try the free scorecard + group splitter.`,
      images: [ogUrl],
    },
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const fromName = cleanFromName(sp.from);
  return (
    <main className="flex-1">
      <ReferralCapture />
      {fromName && (
        <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50 via-violet-50 to-emerald-50 px-4 py-2.5 dark:border-indigo-900/50 dark:from-indigo-950/40 dark:via-violet-950/40 dark:to-emerald-950/40">
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 text-center text-xs">
            <Send
              className="h-3.5 w-3.5 shrink-0 text-indigo-500 dark:text-indigo-400"
              aria-hidden
            />
            <p className="text-slate-700 dark:text-slate-200">
              <span className="font-semibold">{fromName}</span>
              {" thinks you'll love "}
              {SITE.name}
              {" — "}
              <span className="text-slate-500 dark:text-slate-400">
                a free, India-first money app
              </span>
            </p>
          </div>
        </div>
      )}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(99,102,241,0.18),transparent_60%)] dark:bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(99,102,241,0.30),transparent_60%)]" />
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-20 text-center sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" />
            India-first · free forever
          </span>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
            <span className="bg-gradient-to-br from-indigo-600 via-violet-600 to-emerald-500 bg-clip-text text-transparent">
              {SITE.name}
            </span>
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 sm:text-xl">
            {SITE.tagline}
          </p>

          {/* Two co-equal primary CTAs — one for each product pillar. The
              prior single "Open the app" hid the personal-finance side
              entirely above the fold. */}
          <div className="mt-8 grid w-full max-w-xl gap-3 sm:grid-cols-2">
            <Link
              href="/app/groups"
              className="group inline-flex items-center justify-between gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
            >
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" aria-hidden />
                Split bills with friends
              </span>
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <Link
              href="/app/personal"
              className="group inline-flex items-center justify-between gap-2 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
            >
              <span className="flex items-center gap-2">
                <Wallet className="h-4 w-4" aria-hidden />
                Track money + scorecard
              </span>
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
            <Link
              href="/calculators/trip"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Try without signup
            </Link>
            <Link
              href="/use-cases/financial-health-india"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Sparkles className="h-3 w-3 text-amber-500" aria-hidden />
              See the scorecard
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Encrypted · offline-first · works in your pocket · no ads
          </p>
        </div>
      </section>

      {/* Live demo — visitors play with the actual scorecard */}
      <LiveScorecardDemo />

      {/* Two-product split — the same app does both */}
      <section
        id="features"
        className="border-t border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40"
      >
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Two apps. One install.
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
              Sign in once. Get a Splitwise-style group splitter <em>and</em> a
              private finance tracker with India-specific health scoring.
            </p>
          </div>

          {/* Group features */}
          <div className="mb-10">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300"
              >
                <Users className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="text-xl font-semibold tracking-tight">
                For groups
              </h3>
            </div>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SPLIT_FEATURES.map((f) => (
                <li
                  key={f.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <h4 className="text-sm font-semibold tracking-tight">
                    {f.title}
                  </h4>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {f.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Personal features */}
          <div>
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300"
              >
                <Wallet className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="text-xl font-semibold tracking-tight">
                For yourself
              </h3>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Private to you — your group can&apos;t see this side, even if you
              share groups with them.
            </p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PERSONAL_FEATURES.map((f) => (
                <li
                  key={f.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <h4 className="text-sm font-semibold tracking-tight">
                    {f.title}
                  </h4>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {f.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* What you get when you sign in — answers the user question
          "what unlocks after signup?" without needing to log in */}
      <section className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-violet-50 to-emerald-50 p-6 dark:border-slate-800 dark:from-indigo-950/40 dark:via-violet-950/40 dark:to-emerald-950/40 sm:p-8">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 text-white shadow-sm"
              >
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  What you get when you sign in
                </h2>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                  The standalone calculators are nice for one-off splits. The
                  full app keeps history, syncs across devices, and unlocks the
                  personal-finance side.
                </p>
                <ul className="mt-4 grid gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
                  <li className="flex gap-2">
                    <span className="text-emerald-500" aria-hidden>
                      ✓
                    </span>
                    Persistent groups + invite friends
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-500" aria-hidden>
                      ✓
                    </span>
                    Activity feed + comments per expense
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-500" aria-hidden>
                      ✓
                    </span>
                    Personal Finance Tracker
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-500" aria-hidden>
                      ✓
                    </span>
                    Financial Health Scorecard + goals
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-500" aria-hidden>
                      ✓
                    </span>
                    Push reminders for unsettled balances
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-500" aria-hidden>
                      ✓
                    </span>
                    Add guests by name (no signup needed)
                  </li>
                </ul>
                <Link
                  href="/app/groups"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  Open the app
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            softwareApplicationLd({
              name: SITE.name,
              description: SITE.description,
              path: "/",
            }),
          ),
        }}
      />

      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
          <p>
            © {new Date().getFullYear()} {SITE.name}. Built in India.
          </p>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <InstallFooterLink />
            <Link href="/features" className="hover:text-slate-900 dark:hover:text-slate-200">
              Features
            </Link>
            <Link href="/about" className="hover:text-slate-900 dark:hover:text-slate-200">
              About
            </Link>
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-slate-200">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-900 dark:hover:text-slate-200">
              Terms
            </Link>
            <a
              href={SITE.socials.github}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-slate-200"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
