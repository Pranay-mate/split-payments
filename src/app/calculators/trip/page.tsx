import type { Metadata } from "next";
import Link from "next/link";
import { TripApp } from "./_components/trip-app";
import { buildMetadata } from "@/lib/seo";
import {
  breadcrumbLd,
  faqPageLd,
  organizationLd,
  softwareApplicationLd,
} from "@/lib/jsonld";
import { SITE } from "@/lib/site";

const SLUG = "/calculators/trip";

export const metadata: Metadata = buildMetadata({
  title: "Trip Expense Splitter — Settle Group Travel in Minimum Transfers",
  description:
    "Free group expense tracker for trips. Add people, log expenses, and see exactly who pays whom — minimum number of transfers, INR-friendly amounts, works offline.",
  path: SLUG,
  keywords: [
    "trip expense splitter",
    "split travel expenses",
    "group expense calculator",
    "who owes whom",
    "settle up calculator",
    "vacation cost split",
    "group trip calculator india",
  ],
});

const FAQS = [
  {
    question: "How does the simplify-payments algorithm work?",
    answer:
      "After you add expenses, every person has a net balance — the amount they paid minus their share of what was consumed. The algorithm pairs the biggest creditor with the biggest debtor and settles them, then repeats. The result is the minimum practical number of transfers (at most N − 1 for N people with non-zero balances).",
  },
  {
    question: "Why minimum transfers and not direct settle-ups?",
    answer:
      "Imagine 10 friends on a trip with 30 expenses. Settling each expense individually would mean dozens of UPI transfers — some for ₹50, some for ₹600. Simplifying first means each person sends 1-2 round transfers and the entire trip is settled. The math nets out the same; the experience is far cleaner.",
  },
  {
    question: "Does the data leave my device?",
    answer:
      "No. This standalone calculator runs entirely in your browser. Your trip is saved to your browser's local storage so closing the tab doesn't lose it, but nothing is sent to any server. We don't even know how many trips you've calculated. The full EasySplits app (coming soon) will sync across devices for groups, with end-to-end encryption.",
  },
  {
    question: "Can I split unevenly (different shares for different people)?",
    answer:
      "Right now this calculator splits each expense equally between selected people. To exclude someone (e.g., they had a different meal), simply uncheck them in 'Split between'. For weighted splits (3 shares vs 1 share, percentages, or exact amounts), the full EasySplits app handles all four split modes.",
  },
  {
    question: "What if I add someone after a few expenses are already in?",
    answer:
      "They start with a zero balance and only get included in expenses you add from then on. Existing expenses are unchanged. Removing a person clears any expenses they paid for and removes them from sharer lists; if removing them empties an expense's sharer list, that expense is also removed.",
  },
  {
    question: "Does it work offline?",
    answer:
      "Yes. After your first visit, the entire calculator is cached locally and works without internet. Trip state persists in your browser, so you can add expenses on a flight or trek and they'll be ready when you reconnect.",
  },
  {
    question: "How do I share the settle-up with friends?",
    answer:
      "Tap 'Copy' next to the Simplified Payments heading. The list is copied as plain text — paste it into your group chat, share with each payer, and you're done.",
  },
];

export default function TripCalculatorPage() {
  const breadcrumb = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Calculators", path: SLUG },
    { name: "Trip Expense Splitter", path: SLUG },
  ]);
  const software = softwareApplicationLd({
    name: "Trip Expense Splitter",
    description:
      "Free, instant group expense tracker with simplify-payments algorithm — settle a multi-person trip in the minimum number of transfers. Works offline.",
    path: SLUG,
    category: "FinanceApplication",
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
                Trip Splitter
              </li>
            </ol>
          </nav>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Trip Expense Splitter
          </h1>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-400 sm:text-lg">
            Add everyone, log expenses as they happen, see exactly who pays whom — settle the whole trip in the minimum number of transfers. Saved to your device, works offline.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <TripApp />
      </section>

      <section className="border-t border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Common questions</h2>
          <dl className="mt-6 space-y-6">
            {FAQS.map((f) => (
              <div key={f.question}>
                <dt className="text-base font-semibold">{f.question}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {f.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-emerald-50 p-6 dark:border-slate-800 dark:from-indigo-950/40 dark:to-emerald-950/40">
          <h2 className="text-xl font-semibold tracking-tight">
            Want this with accounts, multi-currency and sync?
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            EasySplits is the full version — multiple ongoing groups, multi-currency expenses, comments, settle-up history, sync across devices. Coming soon.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              See what&apos;s coming
            </Link>
            <Link
              href="/calculators/split-bill"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Single-bill splitter
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageLd(FAQS)) }}
      />
    </main>
  );
}
