import type { Metadata } from "next";
import Link from "next/link";
import { SplitBillForm } from "./_components/split-bill-form";
import { buildMetadata } from "@/lib/seo";
import {
  breadcrumbLd,
  faqPageLd,
  organizationLd,
  softwareApplicationLd,
} from "@/lib/jsonld";
import { SITE } from "@/lib/site";

const SLUG = "/calculators/split-bill";

export const metadata: Metadata = buildMetadata({
  title: "Split Bill Calculator — Split a Restaurant Bill in Seconds",
  description:
    "Free split bill calculator. Add the amount, number of people, tip, and service charge — get the per-person share, round to clean UPI amounts, and share with friends.",
  path: SLUG,
  keywords: [
    "split bill calculator",
    "bill split calculator india",
    "tip calculator",
    "restaurant bill split",
    "split bill upi",
    "group dinner split",
  ],
});

const FAQS = [
  {
    question: "How is the per-person share calculated?",
    answer:
      "The bill amount is multiplied by (1 + tip% + extra service charge%) to get the grand total, then divided by the number of people. If you've enabled rounding, each person's share is rounded up to the nearest ₹10/₹50/₹100 — the small excess covers tip and rounds out to a UPI-friendly number.",
  },
  {
    question: "Should I tip in India?",
    answer:
      "Tipping is appreciated but not mandatory in India. A common range is 5-10% at casual restaurants and 10-15% at sit-down restaurants. Many bills already include a 'service charge' (usually 5-10%) — that's the restaurant's automatic tip and is a separate line from GST. If service charge is on the bill, the tip is optional.",
  },
  {
    question: "Is service charge the same as tip?",
    answer:
      "Effectively yes. Service charge is a restaurant-added gratuity that goes to the staff. The Department of Consumer Affairs (Government of India) has guidance that service charge is not mandatory and customers can request its removal — so it's a tip the restaurant adds for you. Most diners don't tip on top of an already-charged service charge.",
  },
  {
    question: "Does the bill amount include GST?",
    answer:
      "Restaurants in India typically show: food + drinks subtotal, GST (5% for non-AC, 18% for AC restaurants in some states — check your bill), and optionally a service charge. Use the GST-inclusive total as the 'Bill amount' here. Tip is usually applied to the pre-GST or inclusive amount based on personal preference; this calculator assumes you enter whichever total you want to split.",
  },
  {
    question: "Why does rounding leave a small excess?",
    answer:
      "Rounding each person's share up to the nearest ₹10/₹50/₹100 means the sum of everyone's payment is slightly more than the bill. The 'rounding excess' shown is the leftover — usually a few rupees that can act as additional tip, or one person can pay slightly less to balance.",
  },
  {
    question: "Can I split unevenly with this calculator?",
    answer:
      "This calculator handles equal splits only. For uneven splits (you had two beers, your friend just had water), use the full EasySplits app — coming soon — which supports splits by share, exact amount, or percentage, and tracks balances across multiple bills.",
  },
];

export default function SplitBillCalculatorPage() {
  const breadcrumb = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Calculators", path: "/calculators/split-bill" },
    { name: "Split Bill Calculator", path: SLUG },
  ]);
  const software = softwareApplicationLd({
    name: "Split Bill Calculator",
    description:
      "Free, instant split-bill calculator with tip, service charge and clean-UPI rounding. Works offline.",
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
                Split Bill
              </li>
            </ol>
          </nav>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Split Bill Calculator
          </h1>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-400 sm:text-lg">
            Type in the bill, tap the number of people, pick a tip — done.
            Each person&apos;s share rounds up to a clean UPI amount.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <SplitBillForm />
      </section>

      <section className="border-t border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            Common questions
          </h2>
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
            Splitting more than just one bill?
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            EasySplits is the full group expense tracker — multiple bills, multi-currency, offline mode, &quot;simplify payments&quot; for trips. Coming soon.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            See what&apos;s coming →
          </Link>
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
