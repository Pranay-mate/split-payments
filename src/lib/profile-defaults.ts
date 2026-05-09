/**
 * Helpers for seeding a profile's displayName / avatarUrl on first
 * create. Called from every server-side spot that auto-creates a
 * profile row when the user first interacts with the app.
 *
 * Priority for displayName:
 *   1. OAuth user_metadata.full_name / .name (Google login → "Pranay Mate")
 *   2. Email prefix ("pranay@hudle.in" → "pranay")
 *   3. Hardcoded "Member"
 *
 * Priority for avatarUrl:
 *   1. OAuth user_metadata.avatar_url / .picture (Google profile pic)
 *   2. null (UserMenu falls back to a coloured initial)
 */

export type AuthUserDefaults = {
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

export function profileDisplayDefault(user: AuthUserDefaults): string {
  if (user.fullName && user.fullName.trim().length > 0) {
    return user.fullName.trim();
  }
  if (user.email) {
    const prefix = user.email.split("@")[0];
    if (prefix && prefix.length > 0) return prefix;
  }
  return "Member";
}

export function profileAvatarDefault(user: AuthUserDefaults): string | null {
  return user.avatarUrl;
}

/**
 * True when an existing displayName looks like the auto-derived email
 * prefix (i.e. user never customised it). Lets profiles.me upgrade
 * stale email-prefix names to OAuth full names without overwriting
 * names the user has manually edited.
 */
export function looksLikeEmailPrefix(
  displayName: string,
  email: string | null,
): boolean {
  if (!email) return false;
  const prefix = email.split("@")[0];
  return !!prefix && displayName.trim() === prefix;
}
