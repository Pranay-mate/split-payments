"use client";

import { useMemo } from "react";
import { Repeat } from "lucide-react";
import { CATEGORIES, toCategoryKey } from "@/lib/categories";
import { formatINR } from "@/lib/format";

type Expense = {
  description: string;
  convertedAmount: number;
  occurredAt: Date | string;
  category?: string | null;
};

type Detected = {
  /** Normalized key — used for React key + dedup. */
  key: string;
  /** Display label, taken from the most-recent occurrence. */
  label: string;
  /** Median monthly amount across detected occurrences (in primary currency). */
  monthlyAmount: number;
  /** How many distinct months we saw this in. */
  monthCount: number;
  /** Most recent month label for display, e.g. "May 2026". */
  lastSeen: string;
  /** Best-guess category for the chip color. */
  category: ReturnType<typeof toCategoryKey>;
};

const MIN_MONTHLY_AMOUNT = 50; // skip ₹<50 noise
const MIN_MONTHS = 2; // need at least 2 months to call it recurring

function normalize(desc: string): string {
  return desc.trim().toLowerCase().replace(/\s+/g, " ");
}

function monthKey(d: Date | string): string {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const dt = new Date(Number(y), Number(m) - 1, 1);
  return dt.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Subscription audit. Detects expenses with the same description
 * repeating across 2+ months and surfaces them as recurring.
 *
 * Pure compute over the expenses prop — no schema, no server call. Hides
 * itself when nothing meaningful is found so the section doesn't render
 * an empty card.
 */
export function SubscriptionAudit({
  expenses,
  primaryCurrency,
}: {
  expenses: Expense[];
  primaryCurrency: string;
}) {
  const detected = useMemo<Detected[]>(() => {
    if (expenses.length < 4) return [];

    // Bucket by (normalized desc, month) so multiple Netflix entries in one
    // month (rare but possible) collapse before we count distinct months.
    const monthlyByDesc = new Map<
      string,
      {
        label: string;
        category: ReturnType<typeof toCategoryKey>;
        months: Map<string, number>;
      }
    >();

    for (const e of expenses) {
      const desc = e.description.trim();
      if (!desc) continue;
      const key = normalize(desc);
      const mKey = monthKey(e.occurredAt);
      let entry = monthlyByDesc.get(key);
      if (!entry) {
        entry = {
          label: desc,
          category: toCategoryKey(e.category ?? null),
          months: new Map(),
        };
        monthlyByDesc.set(key, entry);
      }
      // Use the most recent occurrence's label so display matches what the
      // user last typed (capitalisation drift is forgiven).
      entry.label = desc;
      entry.category = toCategoryKey(e.category ?? null);
      entry.months.set(mKey, (entry.months.get(mKey) ?? 0) + e.convertedAmount);
    }

    const out: Detected[] = [];
    for (const [key, info] of monthlyByDesc) {
      if (info.months.size < MIN_MONTHS) continue;
      const monthlyAmounts = Array.from(info.months.values());
      const monthlyAmount = Math.round(median(monthlyAmounts) * 100) / 100;
      if (monthlyAmount < MIN_MONTHLY_AMOUNT) continue;
      const lastKey = Array.from(info.months.keys()).sort().at(-1)!;
      out.push({
        key,
        label: info.label,
        monthlyAmount,
        monthCount: info.months.size,
        lastSeen: monthLabel(lastKey),
        category: info.category,
      });
    }
    return out.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
  }, [expenses]);

  if (detected.length === 0) return null;

  const monthlyTotal = detected.reduce((s, d) => s + d.monthlyAmount, 0);
  const annualTotal = monthlyTotal * 12;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Repeat className="h-4 w-4 text-violet-500" aria-hidden /> Recurring
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Auto-detected from {detected.length}{" "}
        {detected.length === 1 ? "expense" : "expenses"} that repeat across
        2+ months. About{" "}
        <strong className="tabular-nums text-slate-700 dark:text-slate-200">
          {formatINR(monthlyTotal, 0)}
        </strong>{" "}
        / month ·{" "}
        <strong className="tabular-nums text-slate-700 dark:text-slate-200">
          {formatINR(annualTotal, 0)}
        </strong>{" "}
        / year in {primaryCurrency}.
      </p>
      <ul className="mt-4 space-y-2">
        {detected.map((d) => {
          const cat = CATEGORIES[d.category];
          return (
            <li
              key={d.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-800/40"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  aria-hidden
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs ${cat.chipClass}`}
                >
                  {cat.emoji}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.label}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {d.monthCount}{" "}
                    {d.monthCount === 1 ? "month" : "months"} · last seen{" "}
                    {d.lastSeen}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-right">
                <span className="tabular-nums text-sm font-semibold">
                  {formatINR(d.monthlyAmount, 0)}
                </span>
                <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                  / month
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
