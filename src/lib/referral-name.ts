/**
 * Sanitiser for `?from=<name>` referrer values.
 *
 * Accepts letters across latin, devanagari (Hindi/Marathi), and hebrew
 * scripts, plus apostrophes and hyphens for names like "O'Brien" or
 * "Anne-Marie". Strips everything else (punctuation, digits, symbols,
 * URL noise from copy-paste). Trims whitespace and caps at 24 chars.
 *
 * Used identically client-side (ReferralCapture from URL,
 * ReferralAttacher from URL fallback) and server-side
 * (profiles.attachReferrer) so a corrupted query string can't poison
 * stored data — both sides converge on the same canonical form.
 *
 * Returns "" (empty string) for null/undefined/empty input or input
 * that cleans to nothing — callers should treat empty as "no
 * referrer" rather than throwing.
 */
export function sanitiseReferrerName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/[^a-zA-Zऀ-ॿ֐-׿\s'-]/g, "")
    .trim()
    .slice(0, 24);
}
