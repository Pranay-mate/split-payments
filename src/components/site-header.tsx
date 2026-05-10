"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { BrandMark } from "@/components/brand-mark";

const NAV = [
  { href: "/calculators/trip", label: "Trip" },
  { href: "/calculators/split-bill", label: "Bill" },
  { href: "/features", label: "Features" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  const user = meQuery.data;

  // Hide site header inside the authenticated app shell — those pages
  // get their own focused chrome (added later).
  if (pathname.startsWith("/app/")) return null;
  // Hide on /embed/* iframe routes — embedders want a clean rectangle
  // of content with no parent-app chrome.
  if (pathname.startsWith("/embed/")) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-slate-800/80 dark:bg-slate-950/80 dark:supports-[backdrop-filter]:bg-slate-950/70">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 transition"
          aria-label="EasySplits home"
        >
          <BrandMark
            className="h-8 w-8 shadow-sm transition group-hover:shadow-md"
            fontSizeClass="text-[10px]"
          />
          <span className="hidden text-base font-semibold tracking-tight sm:block">
            EasySplits
          </span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1.5 sm:gap-2">
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
          <Link
            href={user ? "/app/groups" : "/app/login"}
            className="ml-1 inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            {user ? "Open app" : "Sign in"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
