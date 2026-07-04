"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Wallet, Activity } from "lucide-react";

/**
 * Three-tab nav between Groups, Personal finance, and IndexPulse. Sits
 * between the GroupSwitcher (left) and UserMenu (right) in the top header.
 *
 * Mobile: icon-only pills to fit alongside the other elements at 375px.
 * Desktop: icon + label.
 */
export function TopNavTabs() {
  const pathname = usePathname();
  const onIndexPulse = pathname.startsWith("/app/indexpulse");
  const onPersonal = pathname.startsWith("/app/personal");
  const onGroups = !onPersonal && !onIndexPulse; // default context

  return (
    <nav
      className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
      aria-label="Primary"
    >
      <Link
        href="/app/groups"
        aria-label="Groups"
        aria-current={onGroups ? "page" : undefined}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
          onGroups
            ? "bg-indigo-500 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        <Users className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Groups</span>
      </Link>
      <Link
        href="/app/personal"
        aria-label="Personal finance"
        aria-current={onPersonal ? "page" : undefined}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
          onPersonal
            ? "bg-emerald-500 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        <Wallet className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Personal finance</span>
      </Link>
      <Link
        href="/app/indexpulse"
        aria-label="IndexPulse"
        aria-current={onIndexPulse ? "page" : undefined}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
          onIndexPulse
            ? "bg-violet-500 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        <Activity className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">IndexPulse</span>
      </Link>
    </nav>
  );
}
