/**
 * Curated lists for the profile editor — currency and time-zone options.
 * Intentionally small; we cover the locales most users will need without
 * dumping the full IANA database into a dropdown.
 *
 * Add entries as users ask for them rather than upfront — this list is
 * easier to extend than to prune.
 */

export type CurrencyOption = {
  code: string;
  label: string;
  /** Best-guess primary timezone for this currency's home country.
   *  Used to auto-populate the timezone field when the user picks a
   *  currency, before they manually adjust it. */
  defaultTimezone: string;
};

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "INR", label: "₹ INR — Indian Rupee", defaultTimezone: "Asia/Kolkata" },
  { code: "USD", label: "$ USD — US Dollar", defaultTimezone: "America/New_York" },
  { code: "EUR", label: "€ EUR — Euro", defaultTimezone: "Europe/Berlin" },
  { code: "GBP", label: "£ GBP — British Pound", defaultTimezone: "Europe/London" },
  { code: "AED", label: "د.إ AED — UAE Dirham", defaultTimezone: "Asia/Dubai" },
  { code: "SGD", label: "S$ SGD — Singapore Dollar", defaultTimezone: "Asia/Singapore" },
  { code: "JPY", label: "¥ JPY — Japanese Yen", defaultTimezone: "Asia/Tokyo" },
  { code: "AUD", label: "A$ AUD — Australian Dollar", defaultTimezone: "Australia/Sydney" },
  { code: "CAD", label: "C$ CAD — Canadian Dollar", defaultTimezone: "America/Toronto" },
  { code: "LKR", label: "₨ LKR — Sri Lankan Rupee", defaultTimezone: "Asia/Colombo" },
  { code: "BDT", label: "৳ BDT — Bangladeshi Taka", defaultTimezone: "Asia/Dhaka" },
  { code: "NPR", label: "₨ NPR — Nepalese Rupee", defaultTimezone: "Asia/Kathmandu" },
];

export const TIMEZONE_OPTIONS: string[] = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Colombo",
  "Asia/Dhaka",
  "Asia/Kathmandu",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "America/Toronto",
  "Australia/Sydney",
  "UTC",
];

/** Map a currency code to its default IANA tz, falling back to UTC. */
export function timezoneForCurrency(code: string): string {
  return (
    CURRENCY_OPTIONS.find((c) => c.code === code)?.defaultTimezone ?? "UTC"
  );
}
