/**
 * Achievement-badge derivation from the user's score_snapshots history.
 *
 * Pure function — given an ordered (oldest-first) list of snapshots,
 * returns the set of badges the user has earned and on which date.
 *
 * Badges intentionally personal-only (no peer-percentile claims) —
 * matches the "Option C" decision locked when v4.0 shipped.
 */

export type SnapshotForBadges = {
  total: number;
  band: "red" | "amber" | "emerald" | "green";
  snapshottedAt: Date | string;
  pillarScores: Record<string, number>;
};

export type Badge = {
  key: string;
  label: string;
  emoji: string;
  /** One-line description of what the user did to earn it. */
  description: string;
  /** Date the user first qualified — ISO yyyy-mm-dd. */
  earnedOn: string;
};

export type BadgeDef = {
  key: string;
  label: string;
  emoji: string;
  description: string;
};

/**
 * Every badge that exists in the system, in display order. Surfaced to
 * the UI so locked/unearned badges render alongside earned ones —
 * users can see the full progression rather than an empty section.
 */
export const ALL_BADGES: BadgeDef[] = [
  { key: "safety_net", label: "Safety Net", emoji: "🪂", description: "Hit your full emergency-fund target." },
  { key: "well_insured", label: "Well Insured", emoji: "🛡️", description: "Insurance coverage at 18+/20." },
  { key: "debt_free", label: "Debt Free", emoji: "🪜", description: "Zero rolling debt, EMIs comfortably under 40%." },
  { key: "power_saver", label: "Power Saver", emoji: "💪", description: "Savings rate around 25%+ of income." },
  { key: "compounder", label: "Compounder", emoji: "🌱", description: "Investments + active SIP firing on both halves." },
  { key: "solid_foundation", label: "Solid Foundation", emoji: "🏛️", description: "Total score crossed 60 — solid foundations." },
  { key: "green_band", label: "Green Band", emoji: "🌟", description: "Total score crossed 80 — green band hit." },
  { key: "ten_point_jump", label: "+10 Improvement", emoji: "📈", description: "Score climbed 10+ points from an earlier check-in." },
  { key: "consistent_green", label: "Consistent Green", emoji: "🔥", description: "Held the green band across 3 distinct months." },
];

const PILLAR_BADGES: Array<{
  key: string;
  pillarKey: string;
  threshold: number;
  label: string;
  emoji: string;
  description: string;
}> = [
  {
    key: "safety_net",
    pillarKey: "emergency",
    threshold: 20,
    label: "Safety Net",
    emoji: "🪂",
    description: "Hit your full emergency-fund target.",
  },
  {
    key: "well_insured",
    pillarKey: "insurance",
    threshold: 18,
    label: "Well Insured",
    emoji: "🛡️",
    description: "Insurance coverage at 18+/20.",
  },
  {
    key: "debt_free",
    pillarKey: "debt",
    threshold: 20,
    label: "Debt Free",
    emoji: "🪜",
    description: "Zero rolling debt, EMIs comfortably under 40%.",
  },
  {
    key: "power_saver",
    pillarKey: "savingsRate",
    threshold: 17,
    label: "Power Saver",
    emoji: "💪",
    description: "Savings rate around 25%+ of income.",
  },
  {
    key: "compounder",
    pillarKey: "investing",
    threshold: 15,
    label: "Compounder",
    emoji: "🌱",
    description: "Investments + active SIP firing on both halves.",
  },
];

function isoDate(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

/**
 * Earliest snapshot index where `predicate(snap)` first becomes true.
 * Returns -1 if never.
 */
function firstHit<T>(items: T[], predicate: (x: T) => boolean): number {
  for (let i = 0; i < items.length; i++) if (predicate(items[i])) return i;
  return -1;
}

/**
 * Return all badges the user has earned, sorted newest-first.
 * `history` must be oldest-first (matches the personal.profile.history
 * router's order).
 */
export function deriveBadges(history: SnapshotForBadges[]): Badge[] {
  if (history.length === 0) return [];
  const earned: Badge[] = [];

  // Pillar-threshold badges
  for (const def of PILLAR_BADGES) {
    const idx = firstHit(
      history,
      (s) => (s.pillarScores[def.pillarKey] ?? 0) >= def.threshold,
    );
    if (idx === -1) continue;
    earned.push({
      key: def.key,
      label: def.label,
      emoji: def.emoji,
      description: def.description,
      earnedOn: isoDate(history[idx].snapshottedAt),
    });
  }

  // Total-score band badges
  const greenIdx = firstHit(history, (s) => s.band === "green");
  if (greenIdx !== -1) {
    earned.push({
      key: "green_band",
      label: "Green Band",
      emoji: "🌟",
      description: "Total score crossed 80 — green band hit.",
      earnedOn: isoDate(history[greenIdx].snapshottedAt),
    });
  }
  const emeraldIdx = firstHit(history, (s) => s.band === "emerald" || s.band === "green");
  if (emeraldIdx !== -1) {
    earned.push({
      key: "solid_foundation",
      label: "Solid Foundation",
      emoji: "🏛️",
      description: "Total score crossed 60 — solid foundations.",
      earnedOn: isoDate(history[emeraldIdx].snapshottedAt),
    });
  }

  // Improvement badge: total improved by ≥10 from any earlier snapshot.
  // Only awarded once the bigger gap is achieved.
  let bigJumpAt = -1;
  let runningMin = history[0].total;
  for (let i = 1; i < history.length; i++) {
    if (history[i].total - runningMin >= 10) {
      bigJumpAt = i;
      break;
    }
    if (history[i].total < runningMin) runningMin = history[i].total;
  }
  if (bigJumpAt !== -1) {
    earned.push({
      key: "ten_point_jump",
      label: "+10 Improvement",
      emoji: "📈",
      description: "Score climbed 10+ points from an earlier check-in.",
      earnedOn: isoDate(history[bigJumpAt].snapshottedAt),
    });
  }

  // 3-month green streak — distinct calendar months.
  const greenMonths = new Set<string>();
  for (let i = 0; i < history.length; i++) {
    if (history[i].band !== "green") continue;
    const d = new Date(history[i].snapshottedAt);
    greenMonths.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  if (greenMonths.size >= 3) {
    // Earned on the third distinct green-month snapshot.
    const monthsSeen = new Set<string>();
    for (let i = 0; i < history.length; i++) {
      if (history[i].band !== "green") continue;
      const d = new Date(history[i].snapshottedAt);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthsSeen.has(k)) continue;
      monthsSeen.add(k);
      if (monthsSeen.size === 3) {
        earned.push({
          key: "consistent_green",
          label: "Consistent Green",
          emoji: "🔥",
          description: "Held the green band across 3 distinct months.",
          earnedOn: isoDate(history[i].snapshottedAt),
        });
        break;
      }
    }
  }

  // Newest-first display order.
  earned.sort((a, b) => (a.earnedOn < b.earnedOn ? 1 : -1));
  return earned;
}

/**
 * Return per-pillar score series for sparkline rendering. Output is
 * keyed by pillar key with arrays in chronological order, each entry
 * { score, snapshottedAt }.
 */
export function pillarSeries(
  history: SnapshotForBadges[],
): Record<string, Array<{ score: number; at: Date | string }>> {
  const out: Record<string, Array<{ score: number; at: Date | string }>> = {};
  for (const s of history) {
    for (const [k, v] of Object.entries(s.pillarScores)) {
      (out[k] ??= []).push({ score: v, at: s.snapshottedAt });
    }
  }
  return out;
}
