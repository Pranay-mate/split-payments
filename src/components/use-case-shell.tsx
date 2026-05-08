import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE } from "@/lib/site";

export function UseCaseHero({
  title,
  subtitle,
  breadcrumbLabel,
}: {
  title: string;
  subtitle: string;
  breadcrumbLabel: string;
}) {
  return (
    <section className="border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <nav
          aria-label="Breadcrumb"
          className="text-sm text-slate-500 dark:text-slate-400"
        >
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-slate-900 dark:hover:text-slate-200">
                {SITE.name}
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li>
              <span className="text-slate-500 dark:text-slate-400">Use cases</span>
            </li>
            <li aria-hidden>›</li>
            <li className="text-slate-900 dark:text-slate-100" aria-current="page">
              {breadcrumbLabel}
            </li>
          </ol>
        </nav>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-400 sm:text-lg">
          {subtitle}
        </p>
      </div>
    </section>
  );
}

export function UseCaseFaq({
  faqs,
}: {
  faqs: { question: string; answer: string }[];
}) {
  return (
    <section className="border-t border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Common questions</h2>
        <dl className="mt-6 space-y-6">
          {faqs.map((f) => (
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
  );
}

export function UseCaseCta({
  primaryHref,
  primaryLabel,
  secondaryHref = "/calculators/split-bill",
  secondaryLabel = "Single bill splitter",
  blurb,
}: {
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  blurb: string;
}) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-emerald-50 p-6 dark:border-slate-800 dark:from-indigo-950/40 dark:to-emerald-950/40">
        <h2 className="text-xl font-semibold tracking-tight">
          Ready to split it?
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{blurb}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={primaryHref}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {primaryLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href={secondaryHref}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
