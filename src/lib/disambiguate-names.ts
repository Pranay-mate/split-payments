/**
 * When two members in a group share the same display name (e.g. a guest
 * named "Pranay Mate" added by hand + the real Pranay Mate joining via
 * Google), the UI's split-picker chips render two identical-looking
 * pills — confusing and bug-shaped.
 *
 * disambiguateMembers() walks the list once, finds collisions, and
 * suffixes the display name so users can tell them apart:
 *
 *   - "(you)"     for the current user
 *   - "(guest)"   for members flagged isGuest
 *   - "(#abcd)"   first-4 chars of the user id for any other duplicate
 *
 * Singletons are left untouched. Returns a new array of the same shape;
 * only the `name` field is mutated.
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
  // Group by case-insensitive normalised name.
  const buckets = new Map<string, T[]>();
  for (const m of members) {
    const key = (m.name ?? "").trim().toLowerCase();
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(m);
  }

  return members.map((m) => {
    const key = (m.name ?? "").trim().toLowerCase();
    const dup = (buckets.get(key)?.length ?? 0) > 1;
    if (!dup) return m;

    let suffix = "";
    if (currentUserId && m.id === currentUserId) suffix = " (you)";
    else if (m.isGuest) suffix = " (guest)";
    else suffix = ` (#${m.id.slice(0, 4)})`;
    return { ...m, name: `${m.name}${suffix}` };
  });
}
