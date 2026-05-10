/**
 * User-timezone-aware date formatters. Replaces the scattered
 * `toLocaleDateString()` / `toLocaleTimeString()` calls that all used
 * the browser's local zone — meaning a user travelling abroad would see
 * "today's expense" labelled with yesterday's date.
 *
 * Single source of truth for date display. Pair with useUserTimezone()
 * (client) or pass `tz` directly (server components).
 *
 * Falls back to "Asia/Kolkata" — matches the profile default.
 */

const FALLBACK_TZ = "Asia/Kolkata";

function safeTz(tz: string | undefined | null): string {
  if (!tz) return FALLBACK_TZ;
  // Reject obvious garbage (random strings); we don't validate against
  // the full IANA tz database, but enforcing a slash protects against
  // silent fallback to UTC if a typo'd value reaches here.
  if (!/^[A-Za-z]+\/[A-Za-z_+-]+(?:\/[A-Za-z_+-]+)?$|^UTC$/.test(tz)) {
    return FALLBACK_TZ;
  }
  return tz;
}

export type DatePreset =
  /** "5 May" */ | "short"
  /** "5 May 2026" */ | "medium"
  /** "Mon, 5 May" */ | "weekday-short"
  /** "5 May, 14:32" */ | "datetime"
  /** "14:32" */ | "time";

/**
 * Format a Date (or ISO string) in the user's preferred timezone.
 * `preset` matches the formats we use across the app.
 */
export function formatDate(
  d: Date | string | number,
  tz: string | null | undefined,
  preset: DatePreset = "short",
): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const timeZone = safeTz(tz);

  switch (preset) {
    case "short":
      return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        timeZone,
      });
    case "medium":
      return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone,
      });
    case "weekday-short":
      return date.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone,
      });
    case "datetime":
      return date.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone,
      });
    case "time":
      return date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone,
      });
  }
}

/**
 * Compact relative-time formatter — "today", "3d ago", "2mo ago".
 * Doesn't use timezone (relative deltas are tz-independent), but kept
 * here so all date-display helpers live together.
 */
export function relativeTime(d: Date | string | number): string {
  const ts = d instanceof Date ? d.getTime() : new Date(d).getTime();
  const diffMs = Date.now() - ts;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
