/**
 * Single source of truth for member-display-name decoration in group
 * UIs. Three jobs in one pass:
 *
 *   1. ALWAYS suffix "(you)" to the current user — so callers can
 *      render member.name directly without remembering to special-
 *      case `m.id === me.id` everywhere (prevents the
 *      "Pranay Mate (you) (you)" double-suffix bug we hit on 2026-05-23
 *      when group-settings + group-detail + record-payment all
 *      appended "(you)" on top of an already-decorated name).
 *
 *   2. For DUPLICATE non-self names, suffix "(guest)" on isGuest
 *      rows so the same-name guest + real user can be told apart.
 *
 *   3. For any remaining duplicates that aren't the current user
 *      and aren't a guest, suffix "(#abcd)" — first 4 chars of the
 *      user id — as a deterministic short-id disambiguator.
 *
 * Non-current-user, non-duplicate rows are left untouched.
 */
export type DisambiguableMember = {
  id: string;
  name: string;
  isGuest?: boolean;
};

export function disambiguateMembers<T extends DisambiguableMember>(
  members: readonly T[],
  currentUserId?: string | null,
): T[] {
  // Group by case-insensitive normalised name to find collisions.
  const buckets = new Map<string, T[]>();
  for (const m of members) {
    const key = (m.name ?? "").trim().toLowerCase();
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(m);
  }

  return members.map((m) => {
    const isSelf = !!currentUserId && m.id === currentUserId;
    const key = (m.name ?? "").trim().toLowerCase();
    const dup = (buckets.get(key)?.length ?? 0) > 1;

    // Current user always gets "(you)" — even when there's no
    // collision, so the caller never has to add it themselves.
    if (isSelf) return { ...m, name: `${m.name} (you)` };

    // Non-current, non-duplicate rows render as-is.
    if (!dup) return m;

    // Collision but not current user → guest or short-id.
    const suffix = m.isGuest ? " (guest)" : ` (#${m.id.slice(0, 4)})`;
    return { ...m, name: `${m.name}${suffix}` };
  });
}
