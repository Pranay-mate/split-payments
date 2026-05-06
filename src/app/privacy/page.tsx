import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo";
import { breadcrumbLd, organizationLd } from "@/lib/jsonld";
import { SITE } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description: `How ${SITE.name} handles your data — what we collect, what we don't, and how we protect it. Plain English, no dark patterns.`,
  path: "/privacy",
});

const LAST_UPDATED = "6 May 2026";

export default function PrivacyPage() {
  const breadcrumb = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "Privacy", path: "/privacy" },
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
                Privacy
              </li>
            </ol>
          </nav>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Privacy Policy
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
              {SITE.name} is a free expense-splitting app. We try to collect as little personal data as we can.
              We don&apos;t sell your data, ever. We don&apos;t use third-party trackers like Google Analytics, Mixpanel, or Hotjar.
              You can delete your account and all your data at any time from settings.
            </p>
          </Section>

          <Section title="What we collect">
            <p>When you sign up and use {SITE.name}, we store:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Your email address (to log you in)</li>
              <li>Your display name and avatar (from Google, if you use Google sign-in)</li>
              <li>Groups you create or join, and the people in them</li>
              <li>Expenses you add — amounts, descriptions, dates, who paid, how it&apos;s split</li>
              <li>Comments you write on expenses</li>
              <li>Settle-up records (when one person pays another)</li>
            </ul>
            <p>
              We don&apos;t collect: your phone number, your bank details, your address, your contacts, or anything else not in the list above.
            </p>
          </Section>

          <Section title="What runs in your browser, not on our servers">
            <p>
              {SITE.name} is a Progressive Web App. When you add an expense, the calculation runs locally in your browser
              and is then synced to our database. If you&apos;re offline, the expense is queued in your device&apos;s
              local storage and uploaded the next time you reconnect. The standalone Split Bill Calculator at{" "}
              <Link href="/calculators/split-bill" className="underline">
                /calculators/split-bill
              </Link>{" "}
              is fully client-side — nothing is sent anywhere.
            </p>
          </Section>

          <Section title="Analytics">
            <p>
              We use Vercel Analytics and Vercel Speed Insights to count page views and measure performance.
              These tools don&apos;t use cookies and don&apos;t collect personally identifiable information.
              We see aggregate counts (e.g., &quot;the calculator was loaded 1,200 times today&quot;) but never individual sessions.
            </p>
            <p>
              We do not use Google Analytics, Meta Pixel, Mixpanel, Amplitude, Hotjar, or any other behavioural tracker.
            </p>
          </Section>

          <Section title="Cookies and local storage">
            <p>We use only essential storage:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>A session cookie to keep you logged in (set when you sign in, cleared on sign out)</li>
              <li>Browser local storage for your dark/light mode preference</li>
              <li>IndexedDB to cache your groups and expenses for offline use</li>
              <li>Service worker cache for static assets so the app loads fast (and works offline)</li>
            </ul>
            <p>No advertising or tracking cookies.</p>
          </Section>

          <Section title="Where your data lives">
            <p>
              Your data is stored on Supabase (Postgres) in their Mumbai (ap-south-1) region.
              Backups are encrypted and managed by Supabase.
              Static files and edge functions run on Vercel.
            </p>
          </Section>

          <Section title="Server logs">
            <p>
              When your browser talks to our server, our hosting provider logs the IP address, request URL, and timestamp
              for security and debugging. These logs are automatically purged after 30 days.
              We do not log expense descriptions or amounts in server logs.
            </p>
          </Section>

          <Section title="Ads (when we add them)">
            <p>
              {SITE.name} is free. To keep it free, we plan to show banner ads on the dashboard and native cards in the activity feed.
              We will <strong>never</strong> show ads on the add-expense, settle-up, or sign-in screens.
              When we turn on ads, we&apos;ll update this policy to disclose the exact ad provider (likely Google AdSense)
              and the data they collect (typically anonymised cohort signals — never your expense data).
            </p>
          </Section>

          <Section title="Sharing data with third parties">
            <p>We don&apos;t sell or rent your data. Period. The only third-party services that see any of your data are:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li><strong>Supabase</strong> — stores your data so the app works. Their privacy policy applies.</li>
              <li><strong>Vercel</strong> — hosts the app + analytics.</li>
              <li><strong>Google</strong> — only if you sign in with Google; receives your basic profile (name, email, avatar).</li>
            </ul>
          </Section>

          <Section title="Your rights">
            <p>You can, at any time:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Export all your data (coming in a future update)</li>
              <li>Delete your account, which permanently deletes all your groups, expenses, and profile data within 30 days</li>
              <li>Request a copy of any data we hold about you</li>
              <li>Ask us to correct any wrong data</li>
            </ul>
            <p>
              To exercise these rights, raise an issue at{" "}
              <a href={SITE.socials.github} className="underline" target="_blank" rel="noopener noreferrer">
                our GitHub repo
              </a>
              .
            </p>
          </Section>

          <Section title="Children">
            <p>
              {SITE.name} is not intended for anyone under 13. We don&apos;t knowingly collect data from children.
              If you believe a child has signed up, please raise an issue and we&apos;ll delete the account.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              When we update this policy, we&apos;ll change the &quot;Last updated&quot; date at the top.
              Major changes (e.g., new third-party data sharing) will be flagged on the dashboard for at least 30 days.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about privacy? Open a public issue at{" "}
              <a href={SITE.socials.github} className="underline" target="_blank" rel="noopener noreferrer">
                {SITE.socials.github.replace("https://", "")}
              </a>
              . For sensitive concerns, you can also use the discussion tab there.
            </p>
          </Section>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            This policy is provided in plain English for clarity. {SITE.name} is operated as a personal project; users in regulated jurisdictions should review their local data-protection laws (GDPR for EU residents, DPDP Act for India) — those laws apply on top of this policy.
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
