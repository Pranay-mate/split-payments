/**
 * Post Office / Small Savings Schemes — quarterly rate snapshot.
 *
 * The Department of Posts doesn't expose an API for these. Rates are
 * announced by the Ministry of Finance quarterly (Apr / Jul / Oct / Jan
 * windows), published as a Gazette notification, then surfaced on
 * indiapost.gov.in as HTML/PDF. Hardcoding here is deliberate:
 *
 *   - Rates change at most 4× a year and often stay flat for multiple
 *     quarters, so the maintenance cost is ~5 min per quarter
 *   - A wrong rate in a finance app is a trust violation; an unreliable
 *     scraper that silently breaks beats a clean manual update
 *   - The quarterly cadence aligns with the actual data refresh
 *
 * **To update each quarter:**
 *   1. Open https://www.indiapost.gov.in/Financial/Pages/Content/Interest-Rate.aspx
 *      (or the latest Finance Ministry Gazette notification)
 *   2. Update SMALL_SAVINGS_LAST_UPDATED + each scheme's `ratePct`
 *   3. Bump APP_VERSION minor (e.g. 1.0 → 1.1) so users see a banner
 *      and pick up fresh rates without forcing a reload
 */

/** Quarter the rates were last verified for. Format: "Q<n> FY<yy-yy>". */
export const SMALL_SAVINGS_LAST_UPDATED_QUARTER = "Q1 FY26-27";
/** Date used in the panel footer for "Last updated …". */
export const SMALL_SAVINGS_LAST_UPDATED_DATE = "2026-04-01";
/** Canonical source — link from the panel footer for verification. */
export const SMALL_SAVINGS_SOURCE_URL =
  "https://www.indiapost.gov.in/Financial/Pages/Content/Interest-Rate.aspx";

/**
 * Compute the next quarter-start (Jan 1 / Apr 1 / Jul 1 / Oct 1) after
 * a given reference date. The Ministry of Finance announces small-
 * savings rates at the start of each fiscal quarter, so this is the
 * natural "next refresh due" boundary.
 */
function nextQuarterStart(after: Date): Date {
  const month = after.getUTCMonth(); // 0-11
  let nextMonth: number;
  let nextYear = after.getUTCFullYear();
  if (month < 3) nextMonth = 3;
  else if (month < 6) nextMonth = 6;
  else if (month < 9) nextMonth = 9;
  else {
    nextMonth = 0;
    nextYear += 1;
  }
  return new Date(Date.UTC(nextYear, nextMonth, 1));
}

export type SmallSavingsUpdateStatus =
  | "fresh"
  | "due-soon"
  | "due"
  | "overdue";

/**
 * "Is it time to update the hardcoded small-savings rates?" — surfaced
 * on the admin tab so the founder doesn't ship stale rates by forgetting.
 *
 *   - `fresh`     — more than 14 days until the next quarter starts
 *   - `due-soon`  — within 14 days before the next quarter (yellow nudge)
 *   - `due`       — quarter has started, within the first 7 days (amber)
 *   - `overdue`   — more than 7 days past the quarter start (red)
 */
export function getSmallSavingsUpdateStatus(now: Date = new Date()): {
  status: SmallSavingsUpdateStatus;
  nextDueDate: Date;
  daysUntilDue: number;
} {
  const lastUpdated = new Date(SMALL_SAVINGS_LAST_UPDATED_DATE);
  const nextDueDate = nextQuarterStart(lastUpdated);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilDue = Math.floor(
    (nextDueDate.getTime() - now.getTime()) / msPerDay,
  );
  let status: SmallSavingsUpdateStatus;
  if (daysUntilDue > 14) status = "fresh";
  else if (daysUntilDue > 0) status = "due-soon";
  else if (daysUntilDue > -7) status = "due";
  else status = "overdue";
  return { status, nextDueDate, daysUntilDue };
}

export type TaxBenefit = "80C" | "EEE" | null;

export type SmallSavingsScheme = {
  /** Stable React key + analytics handle. */
  key: string;
  /** Full name as published in Gazette. */
  name: string;
  /** Abbreviation (shown when the panel is space-constrained). */
  shortName?: string;
  /** Single emoji that visually identifies the scheme. */
  emoji: string;
  /** Per annum interest rate. Stored as percent (8.2 = 8.2%). */
  ratePct: number;
  /** Human-readable tenure or compounding cadence. */
  tenure: string;
  /** Hard lock-in in years, if any (used to surface "5-year lock"). */
  lockInYears?: number;
  /**
   * 80C = principal deductible up to ₹1.5L/yr; EEE = exempt-exempt-exempt
   * (contribution + interest + maturity all tax-free); null = taxable.
   */
  taxBenefit?: TaxBenefit;
  /** Minimum investment amount, formatted with INR symbol. */
  minInvestment: string;
  /** Maximum cap per year (or lifetime, where applicable). */
  maxInvestment?: string;
  /** Eligibility constraint (e.g. "Age 60+", "Girl child"). */
  forWhom?: string;
  /** One-line nuance worth surfacing next to the rate. */
  notes?: string;
};

/**
 * All Post Office / small-savings schemes. Ordered roughly by intended
 * sort (rate desc) but the panel re-sorts at render time so changing
 * order here doesn't matter visually.
 */
export const SMALL_SAVINGS_SCHEMES: SmallSavingsScheme[] = [
  {
    key: "ssy",
    name: "Sukanya Samriddhi Yojana",
    shortName: "SSY",
    emoji: "👧",
    ratePct: 8.2,
    tenure: "21 years (or marriage of girl after 18)",
    lockInYears: 21,
    taxBenefit: "EEE",
    minInvestment: "₹250",
    maxInvestment: "₹1.5 lakh/yr",
    forWhom: "Girl child, opened before age 10",
    notes: "Tax-free interest + maturity (EEE).",
  },
  {
    key: "scss",
    name: "Senior Citizens Savings Scheme",
    shortName: "SCSS",
    emoji: "👴",
    ratePct: 8.2,
    tenure: "5 years (extendable by 3)",
    lockInYears: 5,
    taxBenefit: "80C",
    minInvestment: "₹1,000",
    maxInvestment: "₹30 lakh",
    forWhom: "Age 60+ (or 55+ retired)",
    notes: "Quarterly interest payout. TDS applies on interest >₹50k/yr.",
  },
  {
    key: "nsc",
    name: "National Savings Certificate",
    shortName: "NSC",
    emoji: "📜",
    ratePct: 7.7,
    tenure: "5 years",
    lockInYears: 5,
    taxBenefit: "80C",
    minInvestment: "₹1,000",
    notes: "Interest reinvested (also 80C eligible). Compounded annually.",
  },
  {
    key: "kvp",
    name: "Kisan Vikas Patra",
    shortName: "KVP",
    emoji: "🌾",
    ratePct: 7.5,
    tenure: "Doubles in ~115 months (9 yr 7 mo)",
    minInvestment: "₹1,000",
    taxBenefit: null,
    notes: "No tax benefit; interest fully taxable.",
  },
  {
    key: "td-5y",
    name: "Post Office Time Deposit (5 year)",
    shortName: "POTD 5y",
    emoji: "🏦",
    ratePct: 7.5,
    tenure: "5 years",
    lockInYears: 5,
    taxBenefit: "80C",
    minInvestment: "₹1,000",
    notes: "Only the 5-year TD qualifies for 80C.",
  },
  {
    key: "mis",
    name: "Post Office Monthly Income Scheme",
    shortName: "MIS",
    emoji: "💰",
    ratePct: 7.4,
    tenure: "5 years",
    lockInYears: 5,
    minInvestment: "₹1,000",
    maxInvestment: "₹9 lakh (single) / ₹15 lakh (joint)",
    taxBenefit: null,
    notes: "Monthly interest credit. Useful for retirees needing cash flow.",
  },
  {
    key: "ppf",
    name: "Public Provident Fund",
    shortName: "PPF",
    emoji: "🏛️",
    ratePct: 7.1,
    tenure: "15 years (extendable in 5-yr blocks)",
    lockInYears: 15,
    taxBenefit: "EEE",
    minInvestment: "₹500/yr",
    maxInvestment: "₹1.5 lakh/yr",
    notes: "EEE — contribution + interest + maturity all tax-free.",
  },
  {
    key: "td-3y",
    name: "Post Office Time Deposit (3 year)",
    shortName: "POTD 3y",
    emoji: "🏦",
    ratePct: 7.1,
    tenure: "3 years",
    lockInYears: 3,
    minInvestment: "₹1,000",
    taxBenefit: null,
  },
  {
    key: "td-2y",
    name: "Post Office Time Deposit (2 year)",
    shortName: "POTD 2y",
    emoji: "🏦",
    ratePct: 7.0,
    tenure: "2 years",
    lockInYears: 2,
    minInvestment: "₹1,000",
    taxBenefit: null,
  },
  {
    key: "td-1y",
    name: "Post Office Time Deposit (1 year)",
    shortName: "POTD 1y",
    emoji: "🏦",
    ratePct: 6.9,
    tenure: "1 year",
    lockInYears: 1,
    minInvestment: "₹1,000",
    taxBenefit: null,
  },
  {
    key: "rd",
    name: "Post Office Recurring Deposit",
    shortName: "POTD-RD",
    emoji: "💸",
    ratePct: 6.7,
    tenure: "5 years (60 monthly deposits)",
    lockInYears: 5,
    minInvestment: "₹100/month",
    taxBenefit: null,
    notes: "Compounded quarterly. Penalty for skipped deposits.",
  },
  {
    key: "savings",
    name: "Post Office Savings Account",
    shortName: "POSA",
    emoji: "💳",
    ratePct: 4.0,
    tenure: "Liquid",
    minInvestment: "₹500",
    taxBenefit: null,
    notes: "Interest up to ₹10k/yr tax-free under section 80TTA.",
  },
];
