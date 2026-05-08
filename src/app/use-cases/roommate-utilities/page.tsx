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

const SLUG = "/use-cases/roommate-utilities";

export const metadata: Metadata = buildMetadata({
  title: "How to Split Utility Bills with Roommates (India)",
  description:
    "A no-drama playbook for splitting electricity, Wi-Fi, gas, water, society maintenance, and house help among roommates — including who pays the bill in whose name.",
  path: SLUG,
  keywords: [
    "split utility bills with roommates",
    "split electricity bill roommates",
    "split wifi bill flatmates",
    "roommate utility split india",
  ],
});

const FAQS = [
  {
    question: "Should every utility be split equally?",
    answer:
      "Default to equal — it's the lowest-friction option. Adjust only if a specific bill becomes lopsided enough to feel unfair (typically electricity in summer when one person runs AC heavily). Don't sub-optimize for ₹100 of difference; you'll spend more on the negotiation than on the bill.",
  },
  {
    question: "Wi-Fi is in someone's name. How do they get reimbursed?",
    answer:
      "The person whose name is on the connection logs the full monthly amount as an expense in your shared tracker (split equally with all roommates). Others reimburse them via UPI on the bill date. Don't have one person 'just pay it' silently — they'll resent it within a few months and the conversation gets awkward.",
  },
  {
    question: "Electricity bill is split-meter (one bill, all of us). Equal or by usage?",
    answer:
      "Equal split is the default. If usage is dramatically uneven — one person works from home + runs AC + has a fridge in their room while another travels half the month — consider a 60/40 split for summer months only. Trying to meter individual rooms in shared accommodation isn't worth it.",
  },
  {
    question: "What about prepaid electricity?",
    answer:
      "Same principle — split the recharge amount equally. The person who recharged adds it as an expense; everyone reimburses. If usage is wildly uneven, switch to demand-based: whoever's home most months that paid the most into the meter rebalances at year-end. Most people don't bother.",
  },
  {
    question: "Cooking gas — equal or by use?",
    answer:
      "Equal. Cylinder cost ÷ number of roommates. Even if one person eats out 5 nights a week and another cooks every meal, the difference per cylinder isn't worth tracking. The tracking overhead exceeds the savings.",
  },
  {
    question: "House help and cook — split how?",
    answer:
      "Split equally if everyone uses the help. If only some roommates use the cook (others eat out), only those roommates split the cook's salary. Same logic for house cleaning — usually shared by all, so equal-split. Communicate expectations on day 1: which services are everyone's, which are opt-in.",
  },
  {
    question: "Do we need a fancy app or is a WhatsApp note enough?",
    answer:
      "For 2-3 roommates with 4-5 recurring bills, a shared note works. For 4+ roommates with 8+ bills/month plus occasional one-offs (broker fees, society fines, AC repair), an app saves hours per quarter. EasySplits' Trip Splitter handles ongoing households well — set it up once, log monthly bills, settle up when convenient.",
  },
];

export default function RoommateUtilitiesPage() {
  const breadcrumb = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Use cases", path: "/use-cases/roommate-utilities" },
    { name: "Roommate utilities", path: SLUG },
  ]);

  return (
    <main className="flex-1">
      <UseCaseHero
        title="Splitting utility bills with roommates"
        subtitle="The Indian rental-flat playbook: electricity, Wi-Fi, gas, water, society maintenance, and house help — what to split equally, what not to, and how to keep the peace."
        breadcrumbLabel="Roommate utilities"
      />

      <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-base leading-relaxed text-slate-700 dark:text-slate-300 sm:px-6">
        <p>
          Rent is the easy part — utility splits are where roommate
          relationships go to die. Whose name is on the Wi-Fi? Why is the
          electricity bill ₹6,000 this month? Did the cook get paid? Most of the
          friction comes from <em>not having a system</em>, not from the actual
          numbers.
        </p>
        <p>
          Here&apos;s a default that works for most Indian shared flats, with
          notes on when to deviate.
        </p>

        <h2 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          The default split table
        </h2>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/40">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Bill</th>
                <th className="px-3 py-2 text-left font-semibold">Default</th>
                <th className="px-3 py-2 text-left font-semibold">When to deviate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="px-3 py-2 font-medium">Wi-Fi / cable</td>
                <td className="px-3 py-2">Equal</td>
                <td className="px-3 py-2">Almost never</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Electricity</td>
                <td className="px-3 py-2">Equal</td>
                <td className="px-3 py-2">60/40 in heavy AC summer if usage is lopsided</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Cooking gas</td>
                <td className="px-3 py-2">Equal</td>
                <td className="px-3 py-2">Almost never</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Water</td>
                <td className="px-3 py-2">Equal (often included in society)</td>
                <td className="px-3 py-2">If metered separately</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Society maintenance</td>
                <td className="px-3 py-2">Equal</td>
                <td className="px-3 py-2">Almost never</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">House help (maid)</td>
                <td className="px-3 py-2">Equal</td>
                <td className="px-3 py-2">Person does only some rooms → only those pay</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Cook</td>
                <td className="px-3 py-2">Among those who eat the food</td>
                <td className="px-3 py-2">If one roommate eats out always, exclude them</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Groceries</td>
                <td className="px-3 py-2">Equal among cook users</td>
                <td className="px-3 py-2">Personal stuff (yogurt, snacks) is individual</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">One-time (RO filter, repair)</td>
                <td className="px-3 py-2">Equal</td>
                <td className="px-3 py-2">If only specific rooms benefit</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          The bill-in-someone&apos;s-name problem
        </h2>
        <p>
          Wi-Fi, electricity, society maintenance, gas — all these typically
          have <em>one</em> roommate&apos;s name on them (or, with luck, the
          landlord&apos;s). The non-named roommates get nervous about timely
          reimbursement, the named roommate gets nervous about chasing them.
        </p>
        <p>The fix:</p>
        <ol className="ml-5 list-decimal space-y-2">
          <li>
            Whoever&apos;s name is on the bill <strong>logs every payment</strong>{" "}
            in a shared tracker the day they pay. They mark themselves as the
            payer + everyone as a sharer.
          </li>
          <li>
            Others see the log + reimburse via UPI within 7 days (give it
            structure, not just &quot;whenever&quot;).
          </li>
          <li>
            Use simplify-payments at month-end if there are multiple bills —
            instead of 5 small UPI transfers, do 1-2 round ones.
          </li>
        </ol>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Don&apos;t over-engineer
        </h2>
        <p>
          The biggest mistake is trying to make every utility &quot;perfectly
          fair&quot;. The cost of tracking individual electricity usage in a
          shared meter exceeds the unfairness of equal-splitting. The cost of
          measuring whose Wi-Fi consumed more bandwidth is higher than the
          ₹400/month bill itself. Default to equal; deviate only when the gap
          is large enough to actually affect someone&apos;s budget.
        </p>
        <p>
          The exception is cook + cook-related groceries — these can be 50%+ of
          a roommate&apos;s monthly food cost, and one person eating out
          consistently while paying for cook + groceries is a real loss. Get
          this right.
        </p>
      </article>

      <UseCaseCta
        primaryHref="/calculators/trip"
        primaryLabel="Track utilities + rent"
        blurb="Use the Trip Splitter for ongoing households — log monthly bills, see balances, settle in 1-2 UPI transfers. Free, no signup."
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
