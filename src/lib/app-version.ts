/**
 * App version — semver-ish `major.minor`.
 *
 * Bump rules:
 *   - Minor (1.0 → 1.1 → 1.2): normal release. SwUpdateBanner shows;
 *     user clicks Reload when ready, or 2-min idle auto-applies.
 *   - Major (1.x → 2.0): force release. ForceUpdateModal blocks the
 *     entire app until the user reloads. Reserve for genuinely
 *     breaking situations (schema migrations the client can't handle,
 *     security fixes, broken core flows). Force-fatigue is real.
 *
 * IMPORTANT: keep this value in sync with APP_VERSION in `public/sw.js`.
 * Service workers run in a separate JS context and can't import this
 * file — two constants, same value, bumped together.
 */
export const APP_VERSION = "2.0";

export function parseMajor(version: string): number {
  const major = parseInt(version.split(".")[0] ?? "0", 10);
  return Number.isFinite(major) ? major : 0;
}
