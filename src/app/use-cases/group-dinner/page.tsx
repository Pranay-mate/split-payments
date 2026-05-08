import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo";
import {
  breadcrumbLd,
  faqPageLd,
  organizationLd,
} from "@/lib/jsonld";
import {
  UseCaseHero,
  UseCaseFaq,
  UseCaseCta,
} from "@/components/use-case-shell";

const SLUG = "/use-cases/group-dinner";

export const metadata: Metadata = buildMetadata({
  title: "How to Split a Restaurant Bill in India (Without the Drama)",
  description:
    "A practical guide to splitting a group restaurant bill — equal vs itemized, GST, service charge, tipping, and the awkward ‘I just had a Coke' problem.",
  path: SLUG,
  keywords: [
    "split restaurant bill india",
    "group dinner bill split",
    "split bill calculator india",
    "tip calculator restaurant",
  ],
});

const FAQS = [
  {
    question: "Equal split or itemized?",
    answer:
      "Equal split when everyone ate roughly the same and the gap is under 15% of the bill. Itemized when there's a big disparity (one person ordered drinks + dessert, another just had a starter) — totaling each person's items separately + dividing shared appetisers feels unfair otherwise. Tools like our /calculators/split-bill handle the simple equal case in seconds; itemized usually needs spreadsheet help.",
  },
  {
    question: "What's the difference between GST and service charge?",
    answer:
      "GST is a government tax (5% non-AC, 18% AC restaurants in some states) — non-negotiable, you have to pay. Service charge is a restaurant-added gratuity (typically 5-10%) that goes to staff — it's not mandatory. The Department of Consumer Affairs, Government of India, has clarified that service charge cannot be charged automatically; customers can request its removal. Most diners just pay it. Don't tip on top if service charge is already on the bill.",
  },
  {
    question: "Do we tip on top of service charge?",
    answer:
      "Generally no — service charge IS the tip. If the service was unusually good, an additional ₹50-200 directly to the waiter is fine, but not expected. If service charge isn't on the bill, a 5-10% tip on the pre-GST amount is standard for sit-down restaurants in India. At casual dining (chai, dhaba, fast food), no tip is expected.",
  },
  {
    question: "Someone only had a Coke. Equal split feels unfair.",
    answer:
      "Pay for the Coke separately (₹100 or whatever) and divide the rest equally. This is the social contract: when someone orders dramatically less than the group, they pay for what they had + a small share of the appetisers (if they ate them) + their share of GST + tip on their portion. Most groups handle this by the under-eater volunteering ₹500 or whatever feels right; everyone agrees.",
  },
  {
    question: "Round up or split to the rupee?",
    answer:
      "Round up to a clean number — ₹375.50 each becomes ₹380 each. The few extra rupees go toward tip. UPI handles decimals fine, but it feels weird to send ₹375.50; ₹380 is cleaner and adds maybe ₹4-5 of tip on a 4-person bill. Our split-bill calculator does this rounding automatically.",
  },
  {
    question: "How to split when one person paid the whole bill?",
    answer:
      "The payer logs the bill total, marks themselves as the payer, and the others reimburse their share via UPI within a few hours (or before leaving the restaurant). For groups that eat out together regularly, log it in EasySplits — at month-end, the simplify-payments shows the minimum number of UPI transfers to settle everything across multiple meals.",
  },
  {
    question: "What about birthday treats or celebrations?",
    answer:
      "If it's an explicit treat (someone says 'this one's on me'), they cover it — log it in your tracker as a settled expense or simply don't add it. If a group of 6 wants to treat the birthday person, the 5 others split that person's share among themselves and pay for them.",
  },
];

export default function GroupDinnerPage() {
  const breadcrumb = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Use cases", path: "/use-cases/group-dinner" },
    { name: "Group dinner", path: SLUG },
  ]);

  return (
    <main className="flex-1">
      <UseCaseHero
        title="Splitting a restaurant bill in India"
        subtitle="The 5-second equal split, the awkward 'I just had a Coke' edge case, and how GST, service charge, and tips actually work."
        breadcrumbLabel="Group dinner"
      />

      <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-base leading-relaxed text-slate-700 dark:text-slate-300 sm:px-6">
        <p>
          The waiter brings the bill. Six people stare at it. The math is
          simple — total ÷ six — but the social negotiation around it is rarely
          that simple. Did one person have wine? Was the appetiser shared? Are
          we tipping on top of the service charge? This is the playbook for
          handling it without anyone feeling cheated.
        </p>

        <h2 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          The default: equal split
        </h2>
        <p>
          For most group meals, equal split is the right answer. It&apos;s fast
          (5 seconds with a calculator), it&apos;s fair-enough when everyone
          ordered comparable amounts, and it avoids 10 minutes of bill-reading
          while the waiter waits.
        </p>
        <p>
          The math:
        </p>
        <ol className="ml-5 list-decimal space-y-2">
          <li>
            Look at the bottom-line total (food + drinks + GST + service
            charge, if any).
          </li>
          <li>
            Add tip if you want to add one (5-10% on the pre-GST amount, only
            if service charge isn&apos;t already on the bill).
          </li>
          <li>Divide by number of people, round up to a clean rupee number.</li>
          <li>Each person pays the rounded amount via UPI.</li>
        </ol>
        <p>
          Our{" "}
          <Link href="/calculators/split-bill" className="underline hover:no-underline">
            Split Bill Calculator
          </Link>{" "}
          does steps 1-3 in 5 seconds and rounds to whole rupees so the math
          stays UPI-friendly. Try it next time the bill arrives.
        </p>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          When equal split is unfair
        </h2>
        <p>
          Switch to itemised when:
        </p>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            One person had drinks (alcohol) and others didn&apos;t — alcohol
            often doubles the tab and non-drinkers shouldn&apos;t cover it.
          </li>
          <li>
            One person had a full meal (₹800) while others had appetisers
            only (₹200 each) — the gap is too large to ignore.
          </li>
          <li>
            Birthday person is being treated — back out their share and split
            it among the others.
          </li>
        </ul>
        <p>
          Itemised is more work but the right call when the difference would
          otherwise feel material. Tools that only do equal-split miss this —
          for these cases, EasySplits&apos; Trip Splitter has &quot;exact
          amount&quot; mode where each person owes a specific number.
        </p>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          The GST + service charge confusion
        </h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>GST</strong> is a government tax. 5% at non-AC restaurants;
            18% at AC restaurants in some categories. Non-negotiable.
          </li>
          <li>
            <strong>Service charge</strong> is the restaurant&apos;s automatic
            gratuity for staff. Usually 5-10% of the pre-GST amount. Per
            government guidance, it&apos;s <strong>not mandatory</strong> — you
            can ask it to be removed. Most people pay it.
          </li>
          <li>
            <strong>Tip</strong> is voluntary, additional. Standard: 5-10% on
            the pre-GST amount, ONLY if no service charge.
          </li>
        </ul>
        <p>
          A common bill structure:{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
            food (₹2000) + service (10%, ₹200) + GST (18% on food, ₹360) =
            ₹2,560
          </code>
          . If you tip on top, you&apos;d add ~₹100-200 cash to the waiter; tip
          is rare in this scenario.
        </p>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Tipping etiquette quick rules
        </h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            Casual / fast food / dhaba: <strong>no tip</strong>
          </li>
          <li>
            Sit-down without service charge: <strong>5-10%</strong> on pre-GST
          </li>
          <li>
            Sit-down with service charge: <strong>nothing extra</strong> unless
            service was exceptional
          </li>
          <li>
            Buffet (where waiters bring plates): <strong>5%</strong> of total
          </li>
          <li>
            Quick-service (you ordered at counter): <strong>no tip</strong>
          </li>
        </ul>
      </article>

      <UseCaseCta
        primaryHref="/calculators/split-bill"
        primaryLabel="Split this bill now"
        secondaryHref="/calculators/trip"
        secondaryLabel="Multi-meal tracker"
        blurb="Free 5-second split — bill amount, number of people, optional tip. Rounds to clean UPI amounts. Works offline if you've got it bookmarked."
      />

      <UseCaseFaq faqs={FAQS} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd()) }}
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
