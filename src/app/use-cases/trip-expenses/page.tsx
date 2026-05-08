import type { Metadata } from "next";
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

const SLUG = "/use-cases/trip-expenses";

export const metadata: Metadata = buildMetadata({
  title: "How to Split Trip Expenses with Friends (Without Drama)",
  description:
    "A practical guide to splitting travel expenses across hotels, food, fuel, and activities — multi-currency, mid-trip joiners, and the ‘who paid for the cab' problem solved.",
  path: SLUG,
  keywords: [
    "split trip expenses",
    "split travel expenses with friends",
    "group trip expense calculator",
    "travel cost split",
    "vacation expense split",
  ],
});

const FAQS = [
  {
    question: "Should we pool money or pay individually?",
    answer:
      "Both have trade-offs. A pool ('everyone Venmo ₹5,000 to one person upfront') simplifies the trip but creates an end-of-trip reconciliation if you spend less or more. Individual paying ('whoever has cash pays, we settle later') is flexible but requires good record-keeping. Most groups use a hybrid: pool for fixed costs (hotel, fuel, group activities), individual for food and personal stuff.",
  },
  {
    question: "How do we handle multi-currency on international trips?",
    answer:
      "Pick one 'group currency' at the start — usually whichever country you're in or a common one like USD. Convert everything to that currency at entry time. Don't try to settle live exchange rates later — they'll have moved 2-5% by then. EasySplits' Trip Splitter does this automatically: type the amount in any currency, the app fetches the spot rate and stores both.",
  },
  {
    question: "What if not everyone goes on every activity?",
    answer:
      "Split per-activity, not equally across the trip. If 4 of 6 went paragliding for ₹3,000 each, only those 4 split that ₹12,000. Hotel and fuel still split among all 6. Use 'who shares' selection on each expense to track this — a calculator that doesn't let you exclude people for individual items will get this wrong.",
  },
  {
    question: "Someone joined mid-trip. How do we calculate?",
    answer:
      "They join from the day they arrive. Don't ask them to chip in for hotel nights they weren't there for, or for the fuel from the leg they didn't ride. List shared costs from their join date forward. If they join the group transport partway, charge them their per-person share of that single ride only.",
  },
  {
    question: "Tipping in different countries?",
    answer:
      "Add tip into the bill at the time of paying — not as a separate group expense afterwards. The reason: tip percentage varies by country (10% standard in India, 15-20% in the US, often included in EU service charges) and people get cranky when retroactively asked to chip in for tips they wouldn't have left themselves. Just bake it into the dinner expense.",
  },
  {
    question: "How do we settle up at the end?",
    answer:
      "Don't try to settle every expense individually — you'd do 30+ transfers. Use 'simplify payments': group all balances and figure out the minimum number of transfers needed. With 6 people and 30 expenses, this typically reduces to 3-4 final UPI transfers. EasySplits does this automatically and shows the exact amounts.",
  },
  {
    question: "What about cash spent that nobody wrote down?",
    answer:
      "Forgive small ones (under ₹100). For meaningful amounts, ask everyone at the end of each day to 'log anything I missed' — make it routine. Or have one person be the designated tracker for the trip, with others reimbursing for the moments they paid.",
  },
];

export default function TripExpensesPage() {
  const breadcrumb = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Use cases", path: "/use-cases/trip-expenses" },
    { name: "Trip expenses", path: SLUG },
  ]);

  return (
    <main className="flex-1">
      <UseCaseHero
        title="Splitting trip expenses with friends, without drama"
        subtitle="A field guide to handling money on group trips — including the gnarly cases: multi-currency, mid-trip joiners, and that one cab everyone took."
        breadcrumbLabel="Trip expenses"
      />

      <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-base leading-relaxed text-slate-700 dark:text-slate-300 sm:px-6">
        <p>
          The hard part of group trips is rarely the trip itself — it&apos;s the
          money. One person ends up fronting hotel costs, another buys 4 dinners
          in a row, someone forgets they Venmoed for fuel. By day 3 nobody
          remembers what&apos;s outstanding, and the &quot;let&apos;s settle up
          on the way back&quot; conversation gets pushed off the flight, then
          never happens.
        </p>
        <p>
          The fix is operational, not arithmetic: log expenses as they happen,
          let the math handle itself, settle in one go at the end. Here&apos;s
          the playbook that works.
        </p>

        <h2 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Phase 1 — Before the trip
        </h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Pick a group currency.</strong> Whichever country
            you&apos;re visiting (USD/EUR/THB) or whichever you&apos;re all from
            (INR). All expenses convert to this. Don&apos;t mix.
          </li>
          <li>
            <strong>Set the splitting tool</strong> upfront — Splitwise,
            EasySplits, a shared note, whatever. Add everyone before day 1.
          </li>
          <li>
            <strong>Decide what&apos;s pooled vs individual.</strong> Hotels and
            fuel are usually pooled-and-split-equally. Personal meals and
            shopping are individual-tracker.
          </li>
          <li>
            <strong>Front the deposits.</strong> Whoever&apos;s name is on the
            booking pre-collects deposit money and logs it as a settled-in
            expense.
          </li>
        </ul>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Phase 2 — During the trip
        </h2>
        <p>
          Whoever pays a shared expense logs it within 5 minutes — before the
          tab is forgotten. Most groups designate one tracker by default; others
          can add as needed. Three rules that keep the books clean:
        </p>
        <ol className="ml-5 list-decimal space-y-2">
          <li>
            <strong>Currency is set per expense, not per trip.</strong> A bill
            in Thai Baht stays in Thai Baht in the log. Conversion happens at
            settle-up, using the rate at the moment you logged it. Live FX
            wandering across the trip introduces noise nobody wants to debate.
          </li>
          <li>
            <strong>Who-shares is set per expense.</strong> Not everyone goes on
            every activity. If 4 of 6 paid for paragliding, only those 4 split
            it. Tools that force equal-split-everything across the whole trip
            misrepresent what happened.
          </li>
          <li>
            <strong>Don&apos;t round mid-trip.</strong> Resist the urge to say
            &quot;close enough, you owe me ₹1,500&quot;. Log the exact amount,
            let the simplify algorithm handle rounding at the end.
          </li>
        </ol>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Phase 3 — Settling up
        </h2>
        <p>
          On the last day or right after returning, do <strong>one</strong>{" "}
          settle-up round. Use a simplify-payments algorithm: it computes the
          minimum number of transfers to clear all balances. For a 6-person
          trip with 25 expenses you typically end up with 3-4 UPI transfers, not
          25.
        </p>
        <p>
          The math: each person&apos;s net = (what they paid) − (their share of
          group consumption). The algorithm pairs the biggest creditor with the
          biggest debtor and settles them, then repeats. EasySplits&apos; Trip
          Splitter does this automatically — try it before booking your next
          group trip.
        </p>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Edge cases
        </h2>
        <ul className="ml-5 list-disc space-y-2">
          <li>
            <strong>Someone joined mid-trip.</strong> They&apos;re only on
            expenses from their join date forward.
          </li>
          <li>
            <strong>Someone left early.</strong> They pay for shared things up
            to their departure (including their share of bookings made for the
            full trip if non-refundable).
          </li>
          <li>
            <strong>Hotel deposit refund.</strong> Whoever paid receives the
            refund — log it as a negative expense or just close out.
          </li>
          <li>
            <strong>Cash spent without a receipt</strong> (street food, rickshaw
            fare). Round to a memorable number, log it. Don&apos;t obsess over
            ₹50.
          </li>
        </ul>
      </article>

      <UseCaseCta
        primaryHref="/calculators/trip"
        primaryLabel="Try the Trip Splitter"
        blurb="Free, no signup. Add people, log expenses in any currency, get the minimum-transfers settle-up at the end. Works offline if you're on a flight."
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
