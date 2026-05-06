"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/calculators/trip", label: "Trip" },
  { href: "/calculators/split-bill", label: "Bill" },
  { href: "/features", label: "Features" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-slate-800/80 dark:bg-slate-950/80 dark:supports-[backdrop-filter]:bg-slate-950/70">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 transition"
          aria-label="EasySplits home"
        >
          <span
            className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 text-xs font-bold text-white shadow-sm transition group-hover:shadow-md"
            aria-hidden
          >
            ES
          </span>
          <span className="hidden text-base font-semibold tracking-tight sm:block">
            EasySplits
          </span>
        </Link>

        <nav aria-label="Primary" className="flex items-center">
          <ul className="flex items-center gap-0.5 sm:gap-1">
            {NAV.map(({ href, label }) => {
              const isActive =
                pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={`inline-flex items-center rounded-lg px-2.5 py-1.5 text-sm font-medium transition sm:px-3 ${
                      isActive
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
