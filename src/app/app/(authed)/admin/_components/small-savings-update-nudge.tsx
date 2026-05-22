"use client";

import { useMemo } from "react";
import { AlertTriangle, CalendarClock } from "lucide-react";
import {
  SMALL_SAVINGS_LAST_UPDATED_DATE,
  SMALL_SAVINGS_LAST_UPDATED_QUARTER,
  SMALL_SAVINGS_SOURCE_URL,
  getSmallSavingsUpdateStatus,
} from "@/lib/small-savings-rates";

/**
 * Quarterly reminder for the admin: small-savings rates ship hardcoded
 * (no API exists) and need a manual PR each fiscal quarter when the
 * Ministry of Finance announces new rates. This nudge surfaces:
 *
 *   - When the next quarter starts (admin can plan)
 *   - When it's overdue (admin sees red and acts)
 *   - Quiet (no banner) when there's nothing to do for >2 weeks
 *
 * Render-time computation only — no server state, no cron, no DB row.
 * `getSmallSavingsUpdateStatus()` derives everything from the constant
 * `SMALL_SAVINGS_LAST_UPDATED_DATE` in `src/lib/small-savings-rates`.
 */
export function SmallSavingsUpdateNudge() {
  const { status, nextDueDate, daysUntilDue } = useMemo(
    () => getSmallSavingsUpdateStatus(),
    [],
  );

  if (status === "fresh") return null;

  const dueDateStr = nextDueDate.toISOString().slice(0, 10);
  const daysAbs = Math.abs(daysUntilDue);

  let icon: React.ReactNode;
  let title: string;
  let body: string;
  let containerClass: string;
  let iconClass: string;

  if (status === "due-soon") {
    icon = <CalendarClock className="h-4 w-4" aria-hidden />;
    title = `Small-savings rate update due in ${daysAbs} day${daysAbs === 1 ? "" : "s"}`;
    body = `Ministry of Finance announces Q-start rates on ${dueDateStr}. Edit src/lib/small-savings-rates.ts after the Gazette notification drops, then bump APP_VERSION minor to surface to users.`;
    containerClass =
      "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20";
    iconClass = "text-amber-700 dark:text-amber-400";
  } else if (status === "due") {
    icon = <CalendarClock className="h-4 w-4" aria-hidden />;
    title = "Small-savings rate update is due now";
    body = `New quarter started on ${dueDateStr}. Check indiapost.gov.in for the latest Gazette rates and update src/lib/small-savings-rates.ts.`;
    containerClass =
      "border-amber-300 bg-amber-100/70 dark:border-amber-800 dark:bg-amber-950/40";
    iconClass = "text-amber-800 dark:text-amber-300";
  } else {
    // overdue
    icon = <AlertTriangle className="h-4 w-4" aria-hidden />;
    title = `Small-savings rates OVERDUE by ${daysAbs} day${daysAbs === 1 ? "" : "s"}`;
    body = `Quarter started ${dueDateStr} — rates currently shown on /wealth may not match the latest Gazette notification. Update src/lib/small-savings-rates.ts immediately.`;
    containerClass =
      "border-rose-300 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30";
    iconClass = "text-rose-700 dark:text-rose-400";
  }

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-xl border p-3 ${containerClass}`}
    >
      <span className={`mt-0.5 shrink-0 ${iconClass}`}>{icon}</span>
      <div className="min-w-0 flex-1 text-[12px] leading-relaxed">
        <p className="font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </p>
        <p className="mt-0.5 text-slate-700 dark:text-slate-300">{body}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span>
            Currently shipping{" "}
            <strong className="font-semibold text-slate-700 dark:text-slate-300">
              {SMALL_SAVINGS_LAST_UPDATED_QUARTER}
            </strong>{" "}
            (updated {SMALL_SAVINGS_LAST_UPDATED_DATE})
          </span>
          <a
            href={SMALL_SAVINGS_SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Open indiapost.gov.in →
          </a>
        </p>
      </div>
    </div>
  );
}
