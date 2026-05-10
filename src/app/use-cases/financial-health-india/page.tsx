import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { breadcrumbLd, faqPageLd, organizationLd } from "@/lib/jsonld";
import { UseCaseHero, UseCaseFaq, UseCaseCta } from "@/components/use-case-shell";

const SLUG = "/use-cases/financial-health-india";

export const metadata: Metadata = buildMetadata({
  title: "How to Check Your Financial Health (India, 2026)",
  description:
    "A 60-second self-check across 5 pillars — emergency fund, insurance, debt, savings rate, investing — using Indian rules of thumb (RBI, NCAER, IRDAI). Free scorecard, no advice fluff.",
  path: SLUG,
  keywords: [
    "financial health checkup india",
    "financial health score india",
    "emergency fund india",
    "insurance coverage india",
    "savings rate calculator india",
    "investing target india",
    "personal finance tracker india",
  ],
});

const FAQS = [
  {
    question: "Is this a substitute for talking to a financial advisor?",
    answer:
      "No. The scorecard surfaces standard rules of thumb that any SEBI-registered RIA would tell you in a 30-minute conversation, packaged so you don't have to pay ₹2,000 for the conversation. For major life decisions (a flat purchase, term cover for a young family, restructuring debt) talk to a qualified RIA. We're not registered to give advice and don't pretend otherwise.",
  },
  {
    question: "How is this different from CRED or Fi or Walnut?",
    answer:
      "CRED is a card-payment app. Fi is a neobank. Walnut tracks SMS for transaction monitoring. None of them tell you 'are you doing okay with money?' — they're transactional dashboards. The Financial Health Scorecard is a diagnostic: 5 pillars, 0–100 score, India-specific rules of thumb, with concrete next-actions like 'top up health cover by ₹13L'. It's the tool a CA-uncle would build if he weren't billing hourly.",
  },
  {
    question: "Why these 5 pillars specifically?",
    answer:
      "They cover the failure modes Indian households actually hit. Emergency fund — when a parent's hospitalisation lands a ₹3L bill. Insurance — when the breadwinner is uninsured and a 30-year mortgage is in play. Debt — when CC-carryover at 36% APR eats real wealth. Savings rate — the engine of every other goal. Investing — equity exposure vs age, since cash savings get destroyed by 6% inflation. Other apps obsess over expense categorisation; categorising spending is downstream of these five things being right.",
  },
  {
    question: "What's the 'Indian rule of thumb' — why not just use US numbers?",
    answer:
      "Median Indian household savings rate is ~20%; the US 'rule' of 20%+ already maps. But other things differ. Term life cover: the US '7× annual income' rule is too low for India where typical breadwinner-only households need 10–15× cover and the LIC term-cover penetration is ~3% (IRDAI). Health cover: ₹15L is the practical floor in metros (private hospitalisation costs ₹3–8L for a single event); US numbers reflect employer-sponsored coverage that doesn't exist here. Investing target: we use the Fidelity glide path generalised to user-supplied retirement age (0.5× annual income at 25 → 8× at retirement) — the original Fidelity numbers assume a 401(k); we generalise.",
  },
  {
    question: "Is my data safe? Where does it live?",
    answer:
      "Amounts and descriptions for the personal-finance side are encrypted with AES-256-GCM at the application layer before they're written to the database. The hosting provider only ever sees ciphertext, not your salary. The encryption key lives in a server env var. This isn't end-to-end encryption (we can decrypt to compute your score), but it's stronger than what most fintechs ship. Source code is open — read src/lib/encryption.ts on GitHub if you want to verify.",
  },
  {
    question: "Will I get hounded for emails or product upsells?",
    answer:
      "No. We don't run ads on add-expense, settle-up, scorecard, or sign-in screens. We don't share data with brokers, insurers, or banks (we have nothing to sell to them). The only emails you'll get are auth (magic links) and reminder pushes you've explicitly enabled. If we ever change this we'd ship it as a clear opt-in, not a buried checkbox.",
  },
  {
    question: "What if my score is bad?",
    answer:
      "You'll see specific next-actions, not platitudes — e.g. 'top up health cover by ₹13.0L', 'trim EMIs by ₹X/month', 'start an SIP — even ₹1,000/month'. The score is calibrated so most people start in the amber band (40–59) and improve over time. The trajectory chart shows your last 24 snapshots so you can see real progress, not just one-off readings.",
  },
];

const PILLARS = [
  {
    label: "Emergency fund 🪂",
    rule: "6 months of expenses in liquid savings (9 if you freelance).",
    why: "When a parent is hospitalised or a job ends, you need cash you can spend tomorrow. Liquid savings accounts, FDs with break clauses, or a sweep-in account count. Equity / locked-in PPF doesn't.",
  },
  {
    label: "Insurance 🛡️",
    rule:
      "Term cover ≥10× annual income (if you have dependents) + ₹15L health cover (base + super top-up).",
    why: "Term cover replaces income for dependents if you die early. Health cover prevents one ICU stay from wiping a decade of savings. ₹3–8L is a typical single private-hospital event; ₹15L gives breathing room. Both are dirt cheap relative to the risk they cover (~₹15–25k/year combined for a 30-year-old).",
  },
  {
    label: "Debt 🪜",
    rule: "EMIs <40% of income · no rolling credit-card balance.",
    why:
      "Above 40% you're one bad month from missing payments. CC carry-over at 36% APR is the single most expensive form of borrowing legal in India — pay it off before any 'investing' plan. Home / education loans at 9% are fine; consumption loans at 14%+ are not.",
  },
  {
    label: "Savings rate 💪",
    rule: "20%+ is good · 30%+ is excellent.",
    why:
      "(Income − expenses) ÷ income. Below 10% you're not building wealth, no matter what your investments do. NSO data puts the typical Indian household at ~18–21% savings rate (FY23) — 30%+ is a real differentiator.",
  },
  {
    label: "Investing 🌱",
    rule:
      "Investments build along an age-glide curve: 0.5× annual income at 25 → 8× at retirement age (default 60).",
    why:
      "Cash loses ~6% to inflation each year. Equity exposure is the only practical hedge over a 20+ year horizon. Active SIPs into low-cost index funds beat trying to time the market. This pillar checks both: are you accumulating enough, and are you putting fresh money in monthly?",
  },
];

export default function FinancialHealthIndiaPage() {
  const breadcrumb = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Use cases", path: "/use-cases/financial-health-india" },
    { name: "Financial health (India)", path: SLUG },
  ]);

  return (
    <main className="flex-1">
      <UseCaseHero
        title="How to check your financial health (India)"
        subtitle="A 60-second self-check across 5 pillars Indian households actually hit failure modes on. Free scorecard, no advice fluff, no broker fees."
        breadcrumbLabel="Financial health (India)"
      />

      <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-base leading-relaxed text-slate-700 dark:text-slate-300 sm:px-6">
        <p>
          &ldquo;Am I doing okay with money?&rdquo; is a harder question than it
          sounds. The honest answer requires looking at five separate things,
          each with its own rule of thumb — and Indian households tend to fail
          on a different one than the textbook (US-flavoured) personal-finance
          books warn about.
        </p>
        <p>
          The five pillars below are the diagnostic. Score yourself against
          each, then fix the weakest one first. You don&apos;t need an app for
          this — pen and paper works. We built a 60-second wizard because most
          people don&apos;t do the pen-and-paper version.
        </p>

        <h2 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          The 5 pillars
        </h2>
        <ol className="space-y-5">
          {PILLARS.map((p) => (
            <li
              key={p.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="font-semibold">{p.label}</p>
              <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                Target: {p.rule}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {p.why}
              </p>
            </li>
          ))}
        </ol>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          The order to fix things
        </h2>
        <p>
          When users submit the wizard for the first time, they often get a
          mediocre score — 40–60 / 100 is normal. The instinct is to fix
          everything at once. Don&apos;t. Fix in this order:
        </p>
        <ol className="ml-5 list-decimal space-y-2">
          <li>
            <strong>Pay off rolling credit-card balance first.</strong> 36% APR
            is mathematically impossible to outpace with investments.
          </li>
          <li>
            <strong>Build 1 month of emergency fund.</strong> Even partial
            coverage prevents a single bad month from cascading.
          </li>
          <li>
            <strong>Buy health insurance if you don&apos;t have any.</strong> A
            ₹5L base cover is ~₹6–10k/year for a 30-year-old. The risk-cost
            ratio is absurd.
          </li>
          <li>
            <strong>Buy term life if you have dependents.</strong> ~₹10–15k/year
            for ₹1Cr cover at 30. Skip if no dependents — the math doesn&apos;t
            justify it.
          </li>
          <li>
            <strong>Push emergency fund to 6 months.</strong> 3 → 6 is more
            valuable than going from 6 → 9 unless you&apos;re freelance.
          </li>
          <li>
            <strong>Start an SIP into a Nifty 50 / total-market index fund.</strong>{" "}
            Even ₹1,000/month. The habit matters more than the amount in year 1.
          </li>
          <li>
            <strong>Then optimise.</strong> Tax-saver funds, NPS, equity
            allocation by age — all matter, but they&apos;re the polish on a
            cake that needs to actually be a cake first.
          </li>
        </ol>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Why a wizard, not a spreadsheet
        </h2>
        <p>
          The math is trivial. The hard part is sitting down and entering the
          numbers honestly. A wizard with a progress bar and a single 0–100
          score at the end gets people to actually finish the exercise.
          Spreadsheets get half-filled and abandoned.
        </p>
        <p>
          Our scorecard also auto-saves snapshots over time, so you see a
          trajectory chart on your second visit — &ldquo;+12 since last month&rdquo;
          is more motivating than another absolute number.
        </p>
      </article>

      <UseCaseCta
        primaryHref="/app/personal/onboard"
        primaryLabel="Get your score (60 seconds)"
        secondaryHref="/features"
        secondaryLabel="See all features"
        blurb="Free, no advice fluff. India-specific rules of thumb. Numbers stay encrypted at the field level — even our hosting provider can't read your salary."
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
