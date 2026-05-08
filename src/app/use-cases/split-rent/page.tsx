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

const SLUG = "/use-cases/split-rent";

export const metadata: Metadata = buildMetadata({
  title: "How to Split Rent with Roommates Fairly",
  description:
    "Three ways Indian roommates split rent that don't end in fights — equal, by room size, by income — plus how to handle utilities, deposits, and moving in/out mid-month.",
  path: SLUG,
  keywords: [
    "how to split rent with roommates",
    "split rent calculator india",
    "fair rent split",
    "rent split by room size",
    "roommate rent agreement",
  ],
});

const FAQS = [
  {
    question: "Should we just split rent equally?",
    answer:
      "Equal split is the simplest and works when rooms are roughly the same size and amenities. The moment one room is noticeably larger, has an attached bathroom, more storage, or better light, equal-splitting starts to feel unfair to whoever's in the smaller room. Talk about it before signing the lease — easier than renegotiating after.",
  },
  {
    question: "How do we split when one room is bigger?",
    answer:
      "The fairest method: charge per square foot. Measure each room's area (or estimate), add common-area square footage divided equally, and assign each person their proportional share. Example: 2BHK with rooms of 120 sqft and 80 sqft, plus 200 sqft of common area. Person A pays for 120 + 100 = 220 sqft; Person B pays for 80 + 100 = 180 sqft. If rent is ₹40,000, A pays ₹22,000 and B pays ₹18,000.",
  },
  {
    question: "What about utilities, internet, and society maintenance?",
    answer:
      "Treat them separately from rent. Internet and society maintenance are typically split equally (everyone uses them roughly the same). Electricity is trickier — if there's a shared meter, equal split works; if your AC runs 12 hours and others' run 4, consider a 60/40 or 70/30 split during peak summer months. See our /use-cases/roommate-utilities guide for details.",
  },
  {
    question: "Who pays the security deposit and how do we handle returns?",
    answer:
      "Each roommate pays their proportional share of the security deposit upfront — same ratio as rent. When someone moves out, they get their share back from the landlord (or from the incoming roommate, who pays a fresh deposit). Document this in writing on day one. Indian landlords often deduct for 'wear and tear' arbitrarily — having clear records of who paid what protects everyone.",
  },
  {
    question: "Someone moved in mid-month. How do we calculate?",
    answer:
      "Pro-rate the rent. If someone moves in on the 15th of a 30-day month, they pay 50% of their normal share for that month. The other roommates split the other 50% equally for the days the room was empty (or the household pays it from the deposit). Don't ask the new person to pay full month — that's not fair, and it sets a bad precedent.",
  },
  {
    question: "Can splitting by income work?",
    answer:
      "Sometimes — usually for couples or close friends with very different incomes. The math: each person pays a percentage of rent equal to their share of total household income. So if A earns ₹80k and B earns ₹40k (total ₹120k), A pays 67% of rent and B pays 33%. This requires high trust + transparency about salaries. Most flatmates don't do this.",
  },
  {
    question: "What if my share goes up because someone moves out?",
    answer:
      "Pre-agree on the rule before signing the lease. Common options: (1) Whoever's left absorbs the empty share equally until a new flatmate arrives, (2) The person who left covers the empty share until their notice period ends, (3) Notice periods are mandatory (30 or 60 days) so the household has time to find a replacement. Option 3 is the cleanest.",
  },
];

export default function SplitRentPage() {
  const breadcrumb = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Use cases", path: "/use-cases/split-rent" },
    { name: "Split rent", path: SLUG },
  ]);

  return (
    <main className="flex-1">
      <UseCaseHero
        title="How to split rent with roommates (fairly)"
        subtitle="Three battle-tested methods — equal, by room size, by income — plus the awkward stuff: utilities, deposits, and someone moving out mid-lease."
        breadcrumbLabel="Split rent"
      />

      <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-base leading-relaxed text-slate-700 dark:text-slate-300 sm:px-6">
        <p>
          Splitting rent in a 2 or 3 BHK shouldn&apos;t take more thought than the
          actual choice of flat. But it does — because nobody wants to bring it
          up before signing, and once everyone&apos;s moved in, renegotiating
          feels like a guilt trip. The trick is to pick a method <em>before</em>{" "}
          you sign the agreement and write it down somewhere your group can refer
          back to.
        </p>

        <h2 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          The three methods that work
        </h2>

        <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
          1. Equal split
        </h3>
        <p>
          ₹45,000 rent ÷ 3 people = ₹15,000 each. Done in 5 seconds, no
          discussion needed. Use this when:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Rooms are similar in size + amenities</li>
          <li>Everyone has roughly the same earning power</li>
          <li>You want zero ongoing accounting overhead</li>
        </ul>

        <h3 className="mt-6 text-lg font-semibold text-slate-900 dark:text-slate-100">
          2. By room size (proportional)
        </h3>
        <p>
          Measure each room&apos;s square footage. Add common-area sqft (drawing
          room + kitchen + balcony) divided equally. Each person pays for their
          share of the total. This is the gold-standard fair method when rooms
          aren&apos;t identical. Master bedroom with attached bath usually ends
          up paying 15-25% more than the smaller room.
        </p>
        <p>
          Quick math: in a 2BHK with rooms of 120 and 80 sqft and 200 sqft of
          common area, on ₹40k rent, the larger room pays ₹22k and the smaller
          ₹18k. Roommate A only paid ₹4k more for a meaningfully better space —
          everyone wins.
        </p>

        <h3 className="mt-6 text-lg font-semibold text-slate-900 dark:text-slate-100">
          3. By income (rare but legitimate)
        </h3>
        <p>
          Each person pays a share of rent proportional to their income. Works
          for couples, siblings, or close friends with big income gaps. Requires
          full transparency about salaries — hard to bring up casually. If
          you&apos;re going to use this, it&apos;s a genuine kindness to be
          explicit about it from day one.
        </p>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Stuff that&apos;s not rent (but causes more arguments)
        </h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Utilities</strong> (electricity, water, gas) — if metered
            and shared, split equally; if peak-summer AC bills creep up, talk
            about it. We have a{" "}
            <Link
              href="/use-cases/roommate-utilities"
              className="underline hover:no-underline"
            >
              full guide on splitting utilities
            </Link>
            .
          </li>
          <li>
            <strong>Wi-Fi + cable</strong> — split equally, fixed amount
          </li>
          <li>
            <strong>Society maintenance</strong> — split equally
          </li>
          <li>
            <strong>House help (cook, maid)</strong> — split equally if everyone
            uses them, else by usage
          </li>
          <li>
            <strong>One-time stuff</strong> (RO filter, inverter battery) —
            split equally, log it in EasySplits or a shared note
          </li>
        </ul>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Common pitfalls
        </h2>
        <ol className="ml-5 list-decimal space-y-2">
          <li>
            <strong>Not writing down the split</strong> — &quot;I thought we
            said equal&quot; arguments are real. Even a WhatsApp message
            screenshot helps.
          </li>
          <li>
            <strong>Forgetting the deposit</strong> — pay your proportional
            share upfront and document who paid what. When someone moves out,
            their share comes back to them, not the household.
          </li>
          <li>
            <strong>Mid-month moves not pro-rated</strong> — moving in on the
            15th means paying 50% for that month, not full.
          </li>
          <li>
            <strong>One person paying everything and chasing reimbursements</strong>{" "}
            — exhausting after 3 months. Use a tracker so the math is visible to
            everyone.
          </li>
        </ol>
      </article>

      <UseCaseCta
        primaryHref="/calculators/trip"
        primaryLabel="Track shared expenses"
        secondaryHref="/calculators/split-bill"
        secondaryLabel="Single bill splitter"
        blurb="EasySplits' Trip Splitter works for ongoing households too — log rent + utilities + groceries each month, see balances, settle up via UPI."
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
