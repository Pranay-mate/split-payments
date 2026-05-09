/**
 * Spending-anomaly detection for the Personal Finance Tracker (Phase 2.5
 * v3.5). Pure function over decrypted entries — keeps detection separate
 * from storage so it's easy to test.
 *
 * Heuristic:
 *   - For each (category, month) bucket, compute total spend.
 *   - For the current month, compare against the rolling avg of prior
 *     months that had any spend in that category.
 *   - Flag as anomaly when current > MULTIPLIER × avg AND the current
 *     month has ≥ MIN_ENTRIES entries in that category (filters noise).
 *   - Sort by severity (current/avg ratio); cap at MAX_RESULTS so we
 *     don't fire 8 pushes for the user who tried 8 new restaurants.
 *
 * Skips entirely when there isn't enough baseline data (< 2 prior months
 * with the category) to call something an anomaly.
 */

export type AnomalyEntry = {
  /** Month key, e.g. "2026-05". */
  monthKey: string;
  category: string;
  amount: number;
};

export type Anomaly = {
  category: string;
  /** Current month's total in that category. */
  current: number;
  /** Rolling avg of prior months that had any spend in this category. */
  baseline: number;
  /** (current / baseline) − 1, e.g. 0.6 = "60% over usual". */
  severity: number;
  /** How many months of history fed the baseline. */
  baselineMonths: number;
  /** Count of current-month entries in this category. */
  entryCount: number;
};

const MULTIPLIER = 1.5;
const MIN_ENTRIES = 3;
const MIN_BASELINE_MONTHS = 2;
const MAX_RESULTS = 2;
const NOISE_FLOOR = 200; // ignore categories under ₹200/month — too noisy to be useful

export function detectAnomalies(
  entries: AnomalyEntry[],
  currentMonthKey: string,
): Anomaly[] {
  // Bucket: category → month → { sum, count }
  type CatStats = Map<string, { sum: number; count: number }>;
  const byCategory = new Map<string, CatStats>();
  for (const e of entries) {
    let cat = byCategory.get(e.category);
    if (!cat) {
      cat = new Map();
      byCategory.set(e.category, cat);
    }
    const bucket = cat.get(e.monthKey) ?? { sum: 0, count: 0 };
    bucket.sum += e.amount;
    bucket.count += 1;
    cat.set(e.monthKey, bucket);
  }

  const out: Anomaly[] = [];
  for (const [category, monthly] of byCategory) {
    const current = monthly.get(currentMonthKey);
    if (!current) continue;
    if (current.count < MIN_ENTRIES) continue;
    if (current.sum < NOISE_FLOOR) continue;

    const priorTotals: number[] = [];
    for (const [m, stats] of monthly) {
      if (m !== currentMonthKey) priorTotals.push(stats.sum);
    }
    if (priorTotals.length < MIN_BASELINE_MONTHS) continue;
    const baseline =
      priorTotals.reduce((s, v) => s + v, 0) / priorTotals.length;
    if (baseline <= 0) continue;
    const ratio = current.sum / baseline;
    if (ratio < MULTIPLIER) continue;

    out.push({
      category,
      current: Math.round(current.sum * 100) / 100,
      baseline: Math.round(baseline * 100) / 100,
      severity: ratio - 1,
      baselineMonths: priorTotals.length,
      entryCount: current.count,
    });
  }

  return out
    .sort((a, b) => b.severity - a.severity)
    .slice(0, MAX_RESULTS);
}
