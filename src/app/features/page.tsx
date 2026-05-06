import type { Metadata } from "next";
import Link from "next/link";
import {
  Receipt,
  Globe2,
  WifiOff,
  Workflow,
  IndianRupee,
  ShieldCheck,
  Heart,
  Code2,
} from "lucide-react";
import { buildMetadata } from "@/lib/seo";
import {
  breadcrumbLd,
  organizationLd,
  softwareApplicationLd,
} from "@/lib/jsonld";
import { SITE } from "@/lib/site";

const SLUG = "/features";

export const metadata: Metadata = buildMetadata({
  title: "Features",
  description: `${SITE.name} features at a glance — multi-currency, offline-first, simplify payments, India-first defaults, free forever, no tracking.`,
  path: SLUG,
});

const FEATURES = [
  {
    Icon: Receipt,
    color: "text-indigo-500",
    title: "Splits that just work",
    body: "Equal, by share, exact amount, or percentage. The math is always rupee-precise — receipts add up exactly.",
    status: "Coming with the full app",
  },
  {
    Icon: Globe2,
    color: "text-violet-500",
    title: "Multi-currency, day one",
    body: "Each group has a primary currency (INR by default). Log expenses in any currency — they convert at spot rate at entry time. Settle-up in primary.",
    status: "Coming with the full app",
  },
  {
    Icon: WifiOff,
    color: "text-emerald-500",
    title: "Works offline",
    body: "On a trek with no signal? Add expenses anyway. They queue locally and sync the moment you reconnect — no lost data, no spinning loaders.",
    status: "Already live in the calculators",
  },
  {
    Icon: Workflow,
    color: "text-sky-500",
    title: "Simplify Payments",
    body: "Five friends, twelve expenses, dozens of UPI transfers? Skip that. The simplify algorithm shows the minimum number of transfers to settle the entire group.",
    status: "Already live in the trip splitter",
  },
  {
    Icon: IndianRupee,
    color: "text-amber-500",
    title: "India-first defaults",
    body: "INR by default. South-Asian digit grouping (₹1,00,000). UPI-friendly whole-rupee rounding. Aware of GST and service-charge conventions in restaurants.",
    status: "Already live across the site",
  },
  {
    Icon: ShieldCheck,
    color: "text-rose-500",
    title: "No third-party tracking",
    body: "No Google Analytics, no Mixpanel, no Hotjar. Vercel's privacy-friendly anonymous analytics only. We never log expense descriptions or amounts.",
    status: "Live and binding",
  },
  {
    Icon: Heart,
    color: "text-pink-500",
    title: "Free forever, no signup needed",
    body: "The standalone calculators don't even ask for an account. The full app will be free with non-intrusive banner ads — never on add-expense or settle-up screens.",
    status: "Live and binding",
  },
  {
    Icon: Code2,
    color: "text-slate-500",
    title: "Open source",
    body: `Read the math, audit the privacy, file an issue, send a PR. The whole codebase is on GitHub.`,
    status: "Live",
  },
];

const COMPARISON = [
  {
    feature: "Free, no signup, no ads",
    easysplits: "Calculator: ✓ · App: free with light ads",
    splitwise: "Free with ads or ₹250/mo Pro",
    tricount: "Free with ads",
  },
  {
    feature: "Works offline (PWA)",
    easysplits: "Yes — installable, no signup",
    splitwise: "Mobile app yes; web partial",
    tricount: "Mobile app yes; web no",
  },
  {
    feature: "Multi-currency",
    easysplits: "Day-one in app · INR-default",
    splitwise: "Yes",
    tricount: "Yes",
  },
  {
    feature: "Simplify Payments",
    easysplits: "Yes (greedy minimum-transfer)",
    splitwise: "Yes (Pro feature)",
    tricount: "Yes",
  },
  {
    feature: "India-first defaults",
    easysplits: "INR, UPI rounding, GST aware",
    splitwise: "USD-first; INR available",
    tricount: "Generic global",
  },
  {
    feature: "Standalone public calculators",
    easysplits: "Bill splitter + Trip splitter",
    splitwise: "No",
    tricount: "No",
  },
  {
    feature: "No third-party tracking",
    easysplits: "Yes (binding policy)",
    splitwise: "Uses Google Analytics",
    tricount: "Uses Google Analytics",
  },
];

export default function FeaturesPage() {
  const breadcrumb = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Features", path: SLUG },
  ]);
  const software = softwareApplicationLd({
    name: SITE.name,
    description: SITE.description,
    path: SLUG,
  });

  return (
    <main className="flex-1">
      <section className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500 dark:text-slate-400">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/" className="hover:text-slate-900 dark:hover:text-slate-200">
                  {SITE.name}
                </Link>
              </li>
              <li aria-hidden>›</li>
              <li className="text-slate-900 dark:text-slate-100" aria-current="page">
                Features
              </li>
            </ol>
          </nav>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Features
          </h1>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-400 sm:text-lg">
            Everything {SITE.name} does today, everything it&apos;ll do soon. We mark each one with whether it&apos;s already live in the standalone calculators or coming with the full app.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, color, title, body, status }) => (
            <li
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <Icon className={`h-5 w-5 ${color}`} aria-hidden />
              </div>
              <h3 className="mt-4 text-base font-semibold tracking-tight">
                {title}
              </h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                {body}
              </p>
              <p className="mt-3 text-xs font-medium text-slate-400 dark:text-slate-500">
                {status}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            How {SITE.name} compares
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Honest comparison with the apps Indians actually use today. We&apos;re not a finished product yet — but here&apos;s where we&apos;re aiming.
          </p>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Feature
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                    {SITE.name}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Splitwise
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Tricount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {COMPARISON.map((row) => (
                  <tr key={row.feature}>
                    <td className="px-4 py-3 font-medium">{row.feature}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {row.easysplits}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {row.splitwise}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {row.tricount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-emerald-50 p-6 dark:border-slate-800 dark:from-indigo-950/40 dark:to-emerald-950/40">
          <h2 className="text-xl font-semibold tracking-tight">Try it before signing up</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            The standalone calculators don&apos;t need an account. They use the same algorithms that&apos;ll power the full app.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/calculators/trip"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Trip splitter →
            </Link>
            <Link
              href="/calculators/split-bill"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Single bill splitter
            </Link>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(software) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
    </main>
  );
}
