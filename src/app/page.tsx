import { SITE, FEATURES } from "@/lib/site";

export default function HomePage() {
  return (
    <main className="flex-1">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(99,102,241,0.18),transparent_60%)] dark:bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(99,102,241,0.30),transparent_60%)]" />
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center sm:py-32">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
            In development · launching soon
          </span>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
            <span className="bg-gradient-to-br from-indigo-600 via-violet-600 to-emerald-500 bg-clip-text text-transparent">
              {SITE.name}
            </span>
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 sm:text-xl">
            {SITE.tagline}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              See what&apos;s coming
            </a>
            <a
              href={SITE.socials.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="border-t border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40"
      >
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="mb-12 max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Built for how groups actually share money.
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
              Three things most expense apps get wrong — and how {SITE.name} is fixing them.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
              >
                <h3 className="text-sm font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {f.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
          <p>
            © {new Date().getFullYear()} {SITE.name}. Built in India.
          </p>
          <p>
            <a
              href={SITE.socials.github}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-slate-200"
            >
              Open source on GitHub
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
