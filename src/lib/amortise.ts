/**
 * Reducing-balance loan amortisation. Pure functions, no I/O — used by
 * the server (for net-worth math) and the client (for projection charts
 * + tenure display in the Debts UI).
 *
 * Why reducing-balance only?
 *   - 95%+ of Indian housing and car loans amortise on a reducing
 *     balance basis. Flat-rate is mostly informal / older personal
 *     loans. Users on flat-rate can still enter their actual EMI and
 *     the math projects forward correctly (it just doesn't recover the
 *     original schedule, which we don't try to do).
 *   - One model = one mental model for users.
 *
 * Inputs we accept on a snapshot:
 *   principal       — outstanding amount at startDate (₹)
 *   emi             — monthly payment (₹)
 *   annualRatePct   — annual interest rate as a percentage, e.g. 8.5
 *   startDate       — the "as-of" date the principal was current
 *
 * What we never store:
 *   tenure / end-date  — derivable from the above. Storing it invites
 *                        over-constrained inputs ("you said 20 years but
 *                        the EMI + rate implies 18.4").
 */

export type LoanSnapshot = {
  principal: number;
  emi: number;
  annualRatePct: number;
  startDate: Date;
};

/** Whole calendar months elapsed from `start` to `end`. Negative if `end`
 *  is before `start`. We use day-of-month to decide whether the final
 *  month has fully completed. */
export function monthsBetween(start: Date, end: Date): number {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  let total = years * 12 + months;
  if (end.getDate() < start.getDate()) total -= 1;
  return total;
}

/**
 * Outstanding balance after `months` EMI payments. Closed-form for
 * the standard amortisation series:
 *
 *   B(n) = P (1 + r)^n − E ((1 + r)^n − 1) / r
 *
 * Edge cases:
 *   n ≤ 0           → return original principal (no payments yet)
 *   r = 0           → linear payoff: max(0, P − n*E)
 *   E ≤ P*r         → EMI doesn't cover interest; balance grows. We
 *                     return the (growing) projected balance, callers
 *                     can decide to warn.
 *   Balance ≤ 0     → loan fully repaid; we clamp to 0.
 */
export function outstandingAfterMonths(
  principal: number,
  emi: number,
  annualRatePct: number,
  months: number,
): number {
  if (months <= 0) return principal;
  const r = annualRatePct / 12 / 100;
  if (r === 0) {
    return Math.max(0, principal - emi * months);
  }
  const factor = Math.pow(1 + r, months);
  const balance = principal * factor - (emi * (factor - 1)) / r;
  return Math.max(0, balance);
}

/** Outstanding balance at a given calendar date, given the loan snapshot. */
export function outstandingAt(loan: LoanSnapshot, asOf: Date): number {
  const elapsed = monthsBetween(loan.startDate, asOf);
  return outstandingAfterMonths(
    loan.principal,
    loan.emi,
    loan.annualRatePct,
    elapsed,
  );
}

/**
 * Months remaining until the loan is fully paid off, counted from
 * `loan.startDate`. Returns:
 *   - exact integer count (rounded up to the month boundary) for the
 *     normal case
 *   - Infinity if EMI ≤ interest portion (predatory loan / data entry
 *     error — UI should surface this as an error)
 *
 * Solved analytically from the amortisation series:
 *   (1 + r)^n (E − P r) = E
 *   n = log( E / (E − P r) ) / log(1 + r)
 */
export function monthsToFreedom(loan: LoanSnapshot): number {
  const r = loan.annualRatePct / 12 / 100;
  if (r === 0) {
    if (loan.emi <= 0) return Infinity;
    return Math.ceil(loan.principal / loan.emi);
  }
  if (loan.emi <= loan.principal * r) return Infinity;
  const n = Math.log(loan.emi / (loan.emi - loan.principal * r)) / Math.log(1 + r);
  return Math.ceil(n);
}

/** Date the loan finishes, given the snapshot. Returns null when the
 *  loan is non-amortising (EMI ≤ interest). */
export function freedomDate(loan: LoanSnapshot): Date | null {
  const months = monthsToFreedom(loan);
  if (!Number.isFinite(months)) return null;
  const d = new Date(loan.startDate.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Sum the outstanding balances of a list of (active) loans at a given
 * date. Convenience for the net-worth math.
 */
export function totalOutstandingAt(
  loans: LoanSnapshot[],
  asOf: Date,
): number {
  let total = 0;
  for (const loan of loans) total += outstandingAt(loan, asOf);
  return total;
}

/**
 * Generate the future trajectory of total debt outstanding at month
 * boundaries from `asOf` forward `months` steps. Used by the net-worth
 * projection chart to subtract liabilities from the projected assets
 * curve.
 */
export function debtTrajectory(
  loans: LoanSnapshot[],
  asOf: Date,
  months: number,
): { month: Date; outstanding: number }[] {
  const out: { month: Date; outstanding: number }[] = [];
  for (let i = 0; i <= months; i++) {
    const d = new Date(asOf.getTime());
    d.setMonth(d.getMonth() + i);
    out.push({ month: d, outstanding: totalOutstandingAt(loans, d) });
  }
  return out;
}
