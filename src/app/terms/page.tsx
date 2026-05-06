import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo";
import { breadcrumbLd, organizationLd } from "@/lib/jsonld";
import { SITE } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Service",
  description: `Plain-English terms for using ${SITE.name} — what we promise, what we don't, and how we keep things fair.`,
  path: "/terms",
});

const LAST_UPDATED = "6 May 2026";

export default function TermsPage() {
  const breadcrumb = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Terms", path: "/terms" },
  ]);

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
                Terms
              </li>
            </ol>
          </nav>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Last updated {LAST_UPDATED}
          </p>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="space-y-8 text-base leading-relaxed text-slate-700 dark:text-slate-300">
          <Section title="The short version">
            <p>
              {SITE.name} is a free tool that helps you split expenses with friends.
              It is <strong>not</strong> a payment processor, a financial institution, or a bank.
              It records who owes whom — actual money transfers happen elsewhere (UPI, bank transfer, cash).
              By using {SITE.name}, you agree to these terms.
            </p>
          </Section>

          <Section title="What you can use it for">
            <ul className="list-disc space-y-1 pl-6">
              <li>Tracking shared expenses with friends, roommates, family, or trip groups</li>
              <li>Calculating per-person amounts</li>
              <li>Recording settlements between members</li>
              <li>Anything similar that helps a group keep clean records of shared money</li>
            </ul>
          </Section>

          <Section title="What you can't use it for">
            <ul className="list-disc space-y-1 pl-6">
              <li>Anything illegal, including money laundering, fraud, or evading tax</li>
              <li>Harassing, threatening, or impersonating other people</li>
              <li>Recording transactions you weren&apos;t actually a part of</li>
              <li>Trying to break, scrape, or overload the service</li>
              <li>Reselling or rebranding the service as your own</li>
            </ul>
            <p>
              If we notice you&apos;re using {SITE.name} for any of the above, we may suspend or delete your account without notice.
            </p>
          </Section>

          <Section title="Your data is yours">
            <p>
              You own the data you add — your groups, expenses, comments, and settlements.
              {" "}{SITE.name} stores it so the app works.
              You can delete your account at any time from settings, which permanently removes your data within 30 days.
            </p>
            <p>
              Other group members may have copies of group expenses you contributed to (it&apos;s a shared record by design).
              When you delete your account, your name is replaced with &quot;Former member&quot; in groups you were part of, but historical balances remain so the group&apos;s books still add up.
            </p>
          </Section>

          <Section title="No warranty — use at your own risk">
            <p>
              {SITE.name} is provided &quot;as is&quot; without warranties of any kind.
              We try hard to keep the math correct and the data safe, but we can&apos;t guarantee:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Zero downtime</li>
              <li>Zero bugs</li>
              <li>That sync will always succeed (especially in offline-flaky scenarios)</li>
              <li>That data won&apos;t ever be lost (please keep your own records of significant amounts)</li>
            </ul>
            <p>
              For amounts that meaningfully matter to you, treat {SITE.name} as a helpful note-keeper, not the single source of truth.
            </p>
          </Section>

          <Section title="Not financial or legal advice">
            <p>
              Anything written on this site (FAQs, calculator explanations, blog posts) is for general information only.
              It is not financial, tax, legal, or accounting advice.
              Always consult a qualified professional for advice on your specific situation.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              To the maximum extent permitted by law, {SITE.name} and its operators are not liable for any indirect,
              incidental, special, consequential, or punitive damages — including lost profits, data, or goodwill —
              arising out of your use of the service.
              Our total liability for any claim related to {SITE.name} is limited to ₹100 (one hundred rupees).
            </p>
          </Section>

          <Section title="Ads (when we add them)">
            <p>
              We plan to fund {SITE.name} with non-intrusive ads on free-tier dashboards.
              Ads will never appear on add-expense, settle-up, or sign-in screens.
              Ad revenue keeps the app free for everyone — but we don&apos;t endorse the products advertised.
              Click responsibly.
            </p>
          </Section>

          <Section title="Changes to the service">
            <p>
              We may add, remove, or change features at any time.
              For changes that meaningfully affect existing users (e.g., shutting down a feature, changing data retention),
              we&apos;ll give at least 30 days&apos; notice on the dashboard.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              When we update these terms, we&apos;ll change the &quot;Last updated&quot; date.
              Continued use after a change means you accept the updated terms.
              Major changes will be flagged on the dashboard for at least 30 days before they take effect.
            </p>
          </Section>

          <Section title="Governing law">
            <p>
              These terms are governed by the laws of India.
              Any disputes will be resolved in the courts of Mumbai, Maharashtra.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms? Open an issue at{" "}
              <a href={SITE.socials.github} className="underline" target="_blank" rel="noopener noreferrer">
                {SITE.socials.github.replace("https://", "")}
              </a>
              .
            </p>
          </Section>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {SITE.name} is currently operated as a personal project. These plain-English terms aim to be clear; if anything reads ambiguously, common-sense interpretation in favour of the user applies. Where these terms conflict with mandatory consumer-protection laws in your jurisdiction, those laws prevail.
          </p>
        </div>
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
