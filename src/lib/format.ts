/**
 * Indian Rupee formatting with the South-Asian digit grouping (1,00,000 not 100,000).
 */
export function formatINR(amount: number, fractionDigits = 2): string {
  if (!Number.isFinite(amount)) return "—";
  // Honour the caller's fractionDigits choice EXCEPT when zero would
  // round away a real fractional part — e.g. ₹199.50 from a 399÷2
  // split should not display as ₹200. Bump to 2 decimals whenever
  // the amount has a meaningful fraction.
  const effectiveDigits =
    fractionDigits === 0 && Math.abs(amount - Math.round(amount)) > 0.005
      ? 2
      : fractionDigits;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: effectiveDigits,
    maximumFractionDigits: effectiveDigits,
  }).format(amount);
}

/**
 * Currency-aware formatter — picks the right symbol from the ISO code while
 * keeping the en-IN locale's grouping (the app is India-default so most
 * readers expect 1,00,000-style grouping even on non-INR amounts).
 *
 * Use this in group views where the amount currency is the group's
 * `primaryCurrency` field (USD, EUR, etc.). `formatINR` stays for personal-
 * finance contexts that are always ₹.
 *
 * Falls back to a "{number} {code}" string if Intl rejects the currency code
 * (very rare, only with malformed user input).
 */
export function formatCurrency(
  amount: number,
  currency: string = "INR",
  fractionDigits = 2,
): string {
  if (!Number.isFinite(amount)) return "—";
  // Two precision rules layered together:
  //   1) Non-INR currencies always get ≥ 2 decimals — $5 ÷ 2 = $2.50,
  //      not $3, and rounding to whole units on USD/EUR misleads
  //      users on the amount they actually owe. JPY (zero-decimal
  //      currency) is the exception but it's not in our common list.
  //   2) For INR we honour the caller's fractionDigits EXCEPT when
  //      zero would round away a real fractional part — ₹199.50 from
  //      a 399÷2 split should not display as ₹200.
  const isINR = (currency || "INR").toUpperCase() === "INR";
  const hasFraction = Math.abs(amount - Math.round(amount)) > 0.005;
  const effectiveDigits = isINR
    ? fractionDigits === 0 && hasFraction
      ? 2
      : fractionDigits
    : Math.max(2, fractionDigits);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: effectiveDigits,
      maximumFractionDigits: effectiveDigits,
    }).format(amount);
  } catch {
    return `${formatNumber(amount, effectiveDigits)} ${currency}`;
  }
}

export function formatNumber(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
