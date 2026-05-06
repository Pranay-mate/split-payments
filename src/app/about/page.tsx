import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare, ShieldCheck, Heart, Eye } from "lucide-react";
import { buildMetadata } from "@/lib/seo";
import { breadcrumbLd, organizationLd } from "@/lib/jsonld";
import { SITE } from "@/lib/site";

const SLUG = "/about";

export const metadata: Metadata = buildMetadata({
  title: `About ${SITE.name}`,
  description: `Why ${SITE.name} exists, who's building it, and how to get in touch. Free, India-first, offline-capable group expense tracker.`,
  path: SLUG,
});

const PRINCIPLES = [
  {
    Icon: ShieldCheck,
    title: "Math you can verify",
    body: "Every algorithm — equal split, share split, simplify-payments — has a documented spec and a property-based test. The split logic is open source so you can read exactly how your trip is settled.",
  },
  {
    Icon: Eye,
    title: "Privacy by default",
    body: "No third-party trackers. No selling data. Server logs purge expense descriptions and amounts within 30 days. The Split Bill Calculator runs fully client-side — nothing is sent anywhere.",
  },
  {
    Icon: Heart,
    title: "Free, with light ads on the dashboard later",
    body: "The standalone calculators are free forever and ad-free. The full app will run banner ads on the dashboard to fund hosting, but never on add-expense, settle-up, or sign-in screens.",
  },
];

export default function AboutPage() {
  const breadcrumb = breadcrumbLd([
    { name: "Home", path: "/" },
    { name: "About", path: SLUG },
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
                About
              </li>
            </ol>
          </nav>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            About {SITE.name}
          </h1>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-400 sm:text-lg">
            {SITE.tagline}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          Why this exists
        </h2>
        <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-700 dark:text-slate-300">
          <p>
            Splitting money with friends in India should be a 5-second job. In practice, it&apos;s usually a mess: one person opens the calculator, eyeballs the bill, types into a group chat, someone protests, the group settles via 6 different UPI transfers — and someone always forgets the chai bill from the morning.
          </p>
          <p>
            Splitwise solved most of this a decade ago, but its mobile web is sluggish, it doesn&apos;t default to INR, and the &ldquo;Simplify Payments&rdquo; that everyone actually wants is paywalled. Tricount is great for trips but doesn&apos;t handle ongoing groups well. Most other apps either ad-stuff the experience or wrap a paywall around basic features.
          </p>
          <p>
            {SITE.name} is an attempt to do this right for Indian users — UPI-friendly rounding, INR-first defaults, multi-currency for travel, simplify-payments without a paywall, and a PWA that actually works on a Mumbai local with one bar of signal.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Principles</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {PRINCIPLES.map(({ Icon, title, body }) => (
            <li
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <p className="mt-3 text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Who&apos;s building it</h2>
        <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-700 dark:text-slate-300">
          <p>
            {SITE.name} is built and maintained by{" "}
            <a
              href="https://pranay-mate.github.io/portfolio/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline decoration-slate-400 underline-offset-4 hover:decoration-slate-900 dark:hover:decoration-slate-100"
            >
              Pranay Mate
            </a>
            , a senior full-stack developer based in Mumbai working on fintech and sports-tech products by day. The whole codebase is open source — read the algorithms, audit the privacy claims, file an issue if something is off.
          </p>
          <p>
            Right now this is a one-developer project shipped in public. Roadmap, decisions, and progress are tracked openly in the GitHub repo. If you want to contribute, send a PR or start a discussion.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-emerald-50 p-6 dark:border-slate-800 dark:from-indigo-950/40 dark:to-emerald-950/40">
          <h2 className="text-xl font-semibold tracking-tight">Get in touch</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Bug, feature idea, or just want to say hi? Open an issue or start a discussion on GitHub. Public-by-default keeps everything honest.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={SITE.socials.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <GithubIcon className="h-4 w-4" /> View on GitHub
            </a>
            <a
              href={`${SITE.socials.github}/issues/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <MessageSquare className="h-4 w-4" aria-hidden /> Open an issue
            </a>
          </div>
        </div>
      </section>

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

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.111.82-.261.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.467-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.553 3.297-1.23 3.297-1.23.653 1.653.242 2.873.118 3.176.77.84 1.235 1.911 1.235 3.22 0 4.61-2.804 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .319.218.694.825.576C20.565 22.092 24 17.594 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
