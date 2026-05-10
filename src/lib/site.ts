/**
 * Single source of truth for EasySplits branding + URLs.
 * Update here, propagates everywhere.
 */

export const SITE = {
  name: "EasySplits",
  tagline:
    "Split bills with friends and track your own money — free, offline-first, India-built.",
  description:
    "Free expense-splitting + personal finance app. Group splits with multi-currency, simplify-payments, and offline support, plus a personal tracker with a 5-pillar Financial Health Scorecard, goals, and anomaly alerts. India-first defaults.",
  url: "https://easy-split-payments.vercel.app",
  ogLocale: "en_IN",
  defaultCurrency: "INR",
  socials: {
    github: "https://github.com/Pranay-mate/split-payments",
  },
} as const;

/**
 * Feature lists, split by product surface so the landing can render
 * them as two grouped sections ("For groups" / "For yourself") without
 * a wall of generic tiles.
 */
export const SPLIT_FEATURES = [
  {
    title: "Splits that add up",
    body: "Equal, by share, exact amount, or percentage. Itemized bills (one receipt, multiple line items). Math is rupee-precise.",
  },
  {
    title: "Simplified ⇄ Pairwise",
    body: "Toggle between minimum-transfers (greedy) and pay-the-person-you-actually-owed. Each row has a 'Why?' that shows the math.",
  },
  {
    title: "Trip mode + categories",
    body: "Daily summaries, per-category breakdown, contribution bars, settlement progress ring. Voice input for hands-free entry.",
  },
  {
    title: "Multi-currency, day one",
    body: "Pick the group currency, log in any currency, settle in primary. Spot-rate conversion at entry time.",
  },
  {
    title: "Reminders + activity feed",
    body: "Daily push for unsettled balances >7 days old. Comments on expenses. Activity feed surfaces who did what.",
  },
  {
    title: "CSV / PDF export",
    body: "Export the group's expenses, settlements, and balances any time. No vendor lock-in.",
  },
] as const;

export const PERSONAL_FEATURES = [
  {
    title: "Encrypted personal tracker",
    body: "Track your income, expenses, investments — in your own private ledger. Amounts encrypted with AES-256-GCM at the field level.",
  },
  {
    title: "Financial Health Scorecard",
    body: "5 pillars (Emergency, Insurance, Debt, Savings rate, Investing) scored against Indian rules of thumb. 60-second wizard, 0–100 score.",
  },
  {
    title: "Goals with progress bars",
    body: "Pick a template (or set your own target) and watch progress as your scorecard updates. Auto-completes when you cross the line.",
  },
  {
    title: "Achievement badges",
    body: "9 unlockable badges across pillars + total-score milestones. Per-pillar mini-sparklines show the trend at a glance.",
  },
  {
    title: "Anomaly alerts",
    body: "Spending in any category jumps ≥50% above your own baseline? Get a heads-up — banner + optional push. Mute or rate-limit anytime.",
  },
  {
    title: "Indian peer benchmarks",
    body: "Each pillar shows how typical Indian households compare (RBI, IRDAI, NSO, AMFI). Citations linked in the scorecard footer.",
  },
] as const;

/**
 * Legacy combined list — kept exported because some pages still
 * import FEATURES. Newer code should consume the split arrays above.
 */
export const FEATURES = [...SPLIT_FEATURES, ...PERSONAL_FEATURES] as const;

export function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
