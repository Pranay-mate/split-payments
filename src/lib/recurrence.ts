/**
 * Helpers for monthly personal recurrences.
 *
 * Schedule is just a day-of-month (1..31). When the target month is
 * shorter than the requested day (e.g. day 31 in February), we clamp
 * to the last day of that month. This matches how Indian payroll
 * systems handle salary on the 31st in February.
 *
 * Pure functions — easy to unit-test without a clock or DB.
 */

/** Last day of the month containing `date` (1..31). */
export function lastDayOfMonth(year: number, monthZeroIndexed: number): number {
  // Day 0 of next month = last day of this month (JS Date trick).
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

/**
 * Compute the next firing time for a recurrence, given:
 *   - scheduleDay: 1..31
 *   - referenceDate: the moment we're computing from (typically "now"
 *     during cron, or the recurrence's createdAt for the initial set)
 *   - lastFiredAt: when this recurrence last fired (null if never)
 *
 * Rules:
 *   - If never fired, the FIRST due date is today's-or-later occurrence
 *     of scheduleDay. E.g. you create on 8 May with day=15 → due 15 May.
 *     If you create on 8 May with day=5 → due 5 June (already past).
 *   - After firing, advance by exactly one calendar month from the
 *     just-fired due date (NOT from "now") so cron jitter doesn't drift.
 *   - Day 29-31 in shorter months clamps to last-day-of-month.
 *
 * Returns a Date in the timezone of the host runtime (UTC on Vercel,
 * but the day-of-month math is calendar-correct in IST since we anchor
 * to UTC midnight + IST is +5:30).
 */
export function computeNextDue(
  scheduleDay: number,
  referenceDate: Date,
  lastFiredAt: Date | null,
): Date {
  if (scheduleDay < 1 || scheduleDay > 31) {
    throw new Error(`scheduleDay must be 1..31, got ${scheduleDay}`);
  }

  // After at least one fire, base the next fire on the previous due date.
  if (lastFiredAt) {
    const prev = new Date(lastFiredAt);
    return advanceByMonth(prev, scheduleDay);
  }

  // First fire: today's or next occurrence of scheduleDay.
  const ref = new Date(referenceDate);
  const candidateDay = clampDay(
    ref.getFullYear(),
    ref.getMonth(),
    scheduleDay,
  );
  const candidate = new Date(
    ref.getFullYear(),
    ref.getMonth(),
    candidateDay,
    0,
    0,
    0,
    0,
  );
  if (candidate.getTime() >= ref.setHours(0, 0, 0, 0)) {
    return candidate;
  }
  // Already past in this month — schedule next month.
  return advanceByMonth(candidate, scheduleDay);
}

/** Advance one full month from `from`, clamping day in the new month. */
function advanceByMonth(from: Date, scheduleDay: number): Date {
  const y = from.getFullYear();
  const m = from.getMonth() + 1; // next month (may overflow to next year, JS handles)
  const day = clampDay(y, m, scheduleDay);
  return new Date(
    y,
    m,
    day,
    from.getHours(),
    from.getMinutes(),
    from.getSeconds(),
    0,
  );
}

function clampDay(year: number, monthZeroIndexed: number, day: number): number {
  // Normalise overflow (m=12 → next year's month 0). JS Date handles
  // this, but we need lastDay correct for the *target* month.
  const norm = new Date(year, monthZeroIndexed, 1);
  const last = lastDayOfMonth(norm.getFullYear(), norm.getMonth());
  return Math.min(day, last);
}
