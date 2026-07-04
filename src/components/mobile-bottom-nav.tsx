"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Wallet, Activity } from "lucide-react";

/**
 * Mobile-only bottom tab bar — thumb-zone primary navigation between the
 * three surfaces (Groups, Personal finance, IndexPulse). Hidden on sm+
 * where the existing TopNavTabs in the header is enough screen real-estate.
 *
 * Why bottom + labels:
 *   - Top-of-header tabs lose their thumb-reachability on phones
 *   - Icon-only top tabs (current behavior <640px) make it unclear which
 *     pillar a user is on at first glance; labels remove the guess
 *   - Bottom bar is the platform-native expectation set by Splitwise,
 *     Cred, GPay, every banking app
 *
 * Anatomy:
 *   - `pb-[env(safe-area-inset-bottom)]` keeps the bar above the iOS
 *     home-indicator strip
 *   - `z-30` sits below modals (z-50) but above page content
 *   - Pillar tint on the active tab matches the homepage hero CTAs:
 *     indigo for Groups, emerald for Personal
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const onIndexPulse = pathname.startsWith("/app/indexpulse");
  const onPersonal = pathname.startsWith("/app/personal");
  // /app/groups, /app/groups/[id], /app/admin etc. all read as
  // "groups context" for the purposes of this nav.
  const onGroups = !onPersonal && !onIndexPulse;

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/80 sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        <li>
          <Link
            href="/app/groups"
            aria-label="Groups"
            aria-current={onGroups ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10.5px] font-medium transition ${
              onGroups
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <span
              aria-hidden
              className={`grid h-6 w-10 place-items-center rounded-full transition ${
                onGroups
                  ? "bg-indigo-100 dark:bg-indigo-950/60"
                  : ""
              }`}
            >
              <Users className="h-4 w-4" aria-hidden />
            </span>
            Groups
          </Link>
        </li>
        <li>
          <Link
            href="/app/personal"
            aria-label="Personal finance"
            aria-current={onPersonal ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10.5px] font-medium transition ${
              onPersonal
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <span
              aria-hidden
              className={`grid h-6 w-10 place-items-center rounded-full transition ${
                onPersonal
                  ? "bg-emerald-100 dark:bg-emerald-950/60"
                  : ""
              }`}
            >
              <Wallet className="h-4 w-4" aria-hidden />
            </span>
            Personal finance
          </Link>
        </li>
        <li>
          <Link
            href="/app/indexpulse"
            aria-label="IndexPulse"
            aria-current={onIndexPulse ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10.5px] font-medium transition ${
              onIndexPulse
                ? "text-violet-600 dark:text-violet-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            <span
              aria-hidden
              className={`grid h-6 w-10 place-items-center rounded-full transition ${
                onIndexPulse ? "bg-violet-100 dark:bg-violet-950/60" : ""
              }`}
            >
              <Activity className="h-4 w-4" aria-hidden />
            </span>
            IndexPulse
          </Link>
        </li>
      </ul>
    </nav>
  );
}
