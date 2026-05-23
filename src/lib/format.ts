/**
 * Indian Rupee formatting with the South-Asian digit grouping (1,00,000 not 100,000).
 */
export function formatINR(amount: number, fractionDigits = 2): string {
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
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
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${formatNumber(amount, fractionDigits)} ${currency}`;
  }
}

export function formatNumber(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
