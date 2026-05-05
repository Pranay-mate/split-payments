/**
 * Single source of truth for EasySplits branding + URLs.
 * Update here, propagates everywhere.
 */

export const SITE = {
  name: "EasySplits",
  tagline: "Split expenses with friends — fast, free, and works offline.",
  description:
    "Free expense-splitting app for groups, trips, roommates and friends. Multi-currency, offline-capable, India-first defaults.",
  url: "https://easysplits.vercel.app",
  ogLocale: "en_IN",
  defaultCurrency: "INR",
  socials: {
    github: "https://github.com/Pranay-mate/split-payments",
  },
} as const;

export const FEATURES = [
  {
    title: "Splits that just work",
    body: "Equal, by share, by exact amount, or by percentage. Receipts add up to the rupee.",
  },
  {
    title: "Works offline",
    body: "On a trek with no signal? Add expenses anyway — they sync the moment you reconnect.",
  },
  {
    title: "Multi-currency from day one",
    body: "Travelling? Pick the group currency, log expenses in any currency, settle up in one.",
  },
  {
    title: "Simplify payments",
    body: "Five friends, twelve expenses? Settle the whole group in 2 transfers, not 12.",
  },
  {
    title: "Free forever",
    body: "Core features will always be free. No paywall on splitting a chai bill.",
  },
  {
    title: "India-first defaults",
    body: "INR by default. UPI-friendly settle-up flow. Built for how Indians actually split.",
  },
] as const;

export function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
