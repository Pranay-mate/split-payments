/**
 * Predefined expense categories. Stored as plain text in the DB so we can
 * add new ones without an enum migration; constrained by Zod on the server
 * to keep the set tight.
 *
 * Order here is the order shown in pickers/charts.
 */

export const CATEGORY_KEYS = [
  "food",
  "travel",
  "stay",
  "groceries",
  "health",
  "shopping",
  "alcohol",
  "bills",
  "entertainment",
  "income",
  "investment",
  "tax",
  "other",
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const DEFAULT_CATEGORY: CategoryKey = "other";

type CategoryMeta = {
  label: string;
  emoji: string;
  /** Tailwind-friendly chip styles (light + dark variants). */
  chipClass: string;
  /** Hex color used by chart libs. Tuned for white + dark backgrounds. */
  hex: string;
};

export const CATEGORIES: Record<CategoryKey, CategoryMeta> = {
  food: {
    label: "Food",
    emoji: "🍽️",
    chipClass:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    hex: "#f59e0b",
  },
  travel: {
    label: "Travel",
    emoji: "🚗",
    chipClass: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
    hex: "#0ea5e9",
  },
  stay: {
    label: "Stay",
    emoji: "🏨",
    chipClass:
      "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
    hex: "#8b5cf6",
  },
  groceries: {
    label: "Groceries",
    emoji: "🛒",
    chipClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    hex: "#10b981",
  },
  health: {
    label: "Health",
    emoji: "💪",
    chipClass:
      "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300",
    hex: "#ec4899",
  },
  shopping: {
    label: "Shopping",
    emoji: "🛍️",
    chipClass:
      "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-300",
    hex: "#d946ef",
  },
  alcohol: {
    label: "Alcohol",
    emoji: "🍻",
    chipClass:
      "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
    hex: "#f97316",
  },
  bills: {
    label: "Bills",
    emoji: "⚡",
    chipClass:
      "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    hex: "#64748b",
  },
  entertainment: {
    label: "Entertainment",
    emoji: "🎬",
    chipClass:
      "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    hex: "#f43f5e",
  },
  income: {
    label: "Income",
    emoji: "💰",
    chipClass:
      "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
    hex: "#16a34a",
  },
  investment: {
    label: "Investment",
    emoji: "📈",
    chipClass:
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300",
    hex: "#06b6d4",
  },
  tax: {
    label: "Tax",
    emoji: "🏛️",
    chipClass:
      "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200",
    hex: "#78716c",
  },
  other: {
    label: "Other",
    emoji: "📦",
    chipClass:
      "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300",
    hex: "#a1a1aa",
  },
};

/** Resolves a possibly-unknown category string to a safe CategoryKey. */
export function toCategoryKey(value: string | null | undefined): CategoryKey {
  if (value && (CATEGORY_KEYS as readonly string[]).includes(value)) {
    return value as CategoryKey;
  }
  return DEFAULT_CATEGORY;
}
