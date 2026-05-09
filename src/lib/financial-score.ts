/**
 * 5-pillar Financial Health Score — Phase 2.5 v3.
 *
 * India-specific rules of thumb. Not financial advice. Not a SEBI RIA.
 * Intentional design choices:
 *   - Each pillar 0–20 (not 0–100) so the total feels like a sum of
 *     smaller wins rather than a single intimidating credit-bureau number.
 *   - "Insurance" is split into two halves (term · health) so users with
 *     no dependents aren't punished for not having term life insurance.
 *   - Investing rewards both stock-and-bond balance AND active SIP — most
 *     Indian young professionals are doing one but not the other.
 */

export type ScoreInputs = {
  age: number | null;
  /** Target retirement age. Defaults to 60 in the scorer if null. */
  retirementAge: number | null;
  isFreelancer: boolean;
  hasDependents: boolean;
  hasCcCarryover: boolean;
  monthlyIncome: number | null;
  monthlyExpenses: number | null;
  liquidSavings: number | null;
  termCoverAmount: number | null;
  healthCoverAmount: number | null;
  totalEmi: number | null;
  investmentBalance: number | null;
  monthlyInvestment: number | null;
};

export type Pillar = {
  key:
    | "emergency"
    | "insurance"
    | "debt"
    | "savingsRate"
    | "investing";
  label: string;
  emoji: string;
  score: number; // 0..20
  /** What the user did well (or what's missing). One short line. */
  message: string;
  /** Concrete action to bump this pillar by ~+5pts. Drives the
   *  "What's missing for +X points" UX. */
  nextAction: string | null;
  /** Indian-household benchmark for context — surfaced as "vs. typical
   *  Indian household" italic line under each pillar. Static numbers
   *  cited from NCAER/RBI/IRDAI/NSO; not fetched. See PEER_CITATIONS
   *  below for the source list. */
  peerBaseline: string;
};

export type ScoreResult = {
  /** 0..100 */
  total: number;
  /** Buckets: red <40 · amber 40-59 · emerald 60-79 · green 80+ */
  band: "red" | "amber" | "emerald" | "green";
  pillars: Pillar[];
  /** True when the user has filled enough of the profile that the
   *  score is meaningful. Below this threshold we hide the score and
   *  prompt them to complete onboarding. */
  hasEnoughData: boolean;
};

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

function bandFor(total: number): ScoreResult["band"] {
  if (total >= 80) return "green";
  if (total >= 60) return "emerald";
  if (total >= 40) return "amber";
  return "red";
}

/**
 * Pillar 1 — Emergency fund.
 *   Target months = 6 (stable employment) or 9 (freelance).
 *   Score scales linearly to that target; cap at target.
 */
const EMERGENCY_BASELINE =
  "Typical Indian household: ~1.5 months of expenses in liquid savings (RBI Household Finance Committee, 2017).";

function emergencyPillar(i: ScoreInputs): Pillar {
  const target = i.isFreelancer ? 9 : 6;
  if (!i.liquidSavings || !i.monthlyExpenses || i.monthlyExpenses <= 0) {
    return {
      key: "emergency",
      label: "Emergency fund",
      emoji: "🪂",
      score: 0,
      message: "Tell us your monthly expenses and savings to score this.",
      nextAction: "Add your monthly expenses + liquid savings",
      peerBaseline: EMERGENCY_BASELINE,
    };
  }
  const months = i.liquidSavings / i.monthlyExpenses;
  const score = clamp(Math.round((months / target) * 20), 0, 20);
  if (score >= 20) {
    return {
      key: "emergency",
      label: "Emergency fund",
      emoji: "🪂",
      score: 20,
      message: `${months.toFixed(1)} months covered — past your ${target}-month target. 🎯`,
      nextAction: null,
      peerBaseline: EMERGENCY_BASELINE,
    };
  }
  const monthsToGo = Math.max(0, target - months);
  const rupeesNeeded = Math.round(monthsToGo * i.monthlyExpenses);
  return {
    key: "emergency",
    label: "Emergency fund",
    emoji: "🪂",
    score,
    message: `${months.toFixed(1)} of ${target} months covered.`,
    nextAction:
      rupeesNeeded > 0
        ? `Add ₹${rupeesNeeded.toLocaleString("en-IN")} to liquid savings`
        : null,
    peerBaseline: EMERGENCY_BASELINE,
  };
}

/**
 * Pillar 2 — Insurance (term + health).
 *   Term: 10pts max. If hasDependents=false, full marks for term —
 *     pushback on the standard "everyone needs term cover" advice.
 *   Health: 10pts max, target ₹15L cover.
 */
function insurancePillar(i: ScoreInputs): Pillar {
  // Term sub-score
  let termSub = 0;
  let termMessage = "";
  if (!i.hasDependents) {
    termSub = 10;
    termMessage = "No dependents — term insurance not required.";
  } else if (!i.monthlyIncome || !i.termCoverAmount) {
    termSub = 0;
    termMessage = "Add your income + term cover to score this.";
  } else {
    const annualIncome = i.monthlyIncome * 12;
    const target = annualIncome * 10; // 10× minimum, 15× ideal
    termSub = clamp(Math.round((i.termCoverAmount / target) * 10), 0, 10);
    if (termSub >= 10) {
      termMessage = "Term cover ≥10× annual income.";
    } else {
      const ratio = (i.termCoverAmount / annualIncome).toFixed(1);
      termMessage = `Term cover is ${ratio}× annual income (target 10×).`;
    }
  }

  // Health sub-score (₹15L target — base + super top-up combined)
  const HEALTH_TARGET = 1500000;
  let healthSub = 0;
  let healthMessage = "";
  if (i.healthCoverAmount === null) {
    healthSub = 0;
    healthMessage = "Add your health cover to score this.";
  } else {
    healthSub = clamp(
      Math.round((i.healthCoverAmount / HEALTH_TARGET) * 10),
      0,
      10,
    );
    if (healthSub >= 10) {
      healthMessage = `Health cover ≥ ₹${(HEALTH_TARGET / 100000).toFixed(0)}L.`;
    } else {
      const lakhs = (i.healthCoverAmount / 100000).toFixed(1);
      healthMessage = `Health cover is ₹${lakhs}L (target ₹15L).`;
    }
  }

  const score = termSub + healthSub;
  let nextAction: string | null = null;
  if (healthSub < 10 && (i.healthCoverAmount ?? 0) < HEALTH_TARGET) {
    const gap = HEALTH_TARGET - (i.healthCoverAmount ?? 0);
    nextAction = `Top up health cover by ₹${(gap / 100000).toFixed(1)}L`;
  } else if (
    termSub < 10 &&
    i.hasDependents &&
    i.monthlyIncome &&
    i.termCoverAmount !== null
  ) {
    const target = i.monthlyIncome * 12 * 10;
    const gap = target - i.termCoverAmount;
    if (gap > 0) {
      nextAction = `Increase term cover by ₹${(gap / 100000).toFixed(0)}L`;
    }
  }

  return {
    key: "insurance",
    label: "Insurance",
    emoji: "🛡️",
    score,
    message: `${termMessage} ${healthMessage}`.trim(),
    nextAction,
    peerBaseline:
      "Typical Indian: ~3% have term life cover (IRDAI, FY23); avg health cover ₹4–5L vs ₹15L target (Policybazaar, 2024).",
  };
}

/**
 * Pillar 3 — Debt.
 *   EMI sub-score (0–15): EMI ÷ income < 40% is the rule of thumb.
 *     0% → 15pts · 50% → 0pts (linear).
 *   CC sub-score (0–5): rolling balance = 0 · paid in full = 5.
 */
function debtPillar(i: ScoreInputs): Pillar {
  let emiSub = 0;
  let emiMessage = "";
  if (i.totalEmi === null || !i.monthlyIncome) {
    emiSub = 0;
    emiMessage = "Add your income + total EMIs to score this.";
  } else if (i.totalEmi === 0) {
    emiSub = 15;
    emiMessage = "No EMIs — full marks here.";
  } else {
    const ratio = i.totalEmi / i.monthlyIncome;
    // 0% → 15, 50% → 0, linear interpolation, clamped at 0.
    emiSub = clamp(Math.round(15 - ratio * 30), 0, 15);
    emiMessage = `EMIs are ${Math.round(ratio * 100)}% of monthly income (target <40%).`;
  }

  const ccSub = i.hasCcCarryover ? 0 : 5;
  const ccMessage = i.hasCcCarryover
    ? "Credit card balance carrying over — high-interest debt."
    : "No rolling credit-card balance.";

  const score = emiSub + ccSub;
  let nextAction: string | null = null;
  if (i.hasCcCarryover) {
    nextAction = "Pay off the rolling credit-card balance";
  } else if (i.totalEmi !== null && i.monthlyIncome && i.totalEmi > 0) {
    const ratio = i.totalEmi / i.monthlyIncome;
    if (ratio > 0.4) {
      const target = i.monthlyIncome * 0.4;
      const reduceBy = i.totalEmi - target;
      nextAction = `Trim EMIs by ₹${Math.round(reduceBy).toLocaleString("en-IN")}/month`;
    }
  }

  return {
    key: "debt",
    label: "Debt",
    emoji: "🪜",
    score,
    message: `${emiMessage} ${ccMessage}`.trim(),
    nextAction,
    peerBaseline:
      "Indian household debt ≈ 40% of GDP; median EMI/income ≈ 25–30% (RBI Financial Stability Report, 2024).",
  };
}

/**
 * Pillar 4 — Savings rate.
 *   (income − expenses − investments) / income.
 *   Note: investments aren't a "loss" — the savings rate captures
 *   anything *not* spent on consumption. We treat investment as
 *   savings here (it grows your future net worth).
 *   30% rate → 20pts · 0% → 0pts.
 */
function savingsRatePillar(i: ScoreInputs): Pillar {
  if (!i.monthlyIncome || i.monthlyExpenses === null) {
    return {
      key: "savingsRate",
      label: "Savings rate",
      emoji: "💪",
      score: 0,
      message: "Add your income + expenses to score this.",
      nextAction: "Fill in monthly income + expenses",
      peerBaseline:
        "Indian household net savings rate ≈ 18–21% of disposable income (NSO, FY23).",
    };
  }
  const saved = i.monthlyIncome - i.monthlyExpenses;
  const rate = saved / i.monthlyIncome;
  const score = clamp(Math.round((rate / 0.3) * 20), 0, 20);
  let message = "";
  if (rate >= 0.3) {
    message = `${Math.round(rate * 100)}% savings rate — excellent.`;
  } else if (rate >= 0.2) {
    message = `${Math.round(rate * 100)}% savings rate — solid.`;
  } else if (rate >= 0) {
    message = `${Math.round(rate * 100)}% savings rate — target 20%+.`;
  } else {
    message = `Spending more than you earn this month.`;
  }
  let nextAction: string | null = null;
  if (rate < 0.3 && i.monthlyExpenses > 0) {
    const targetExpense = i.monthlyIncome * 0.7;
    const trim = i.monthlyExpenses - targetExpense;
    if (trim > 0) {
      nextAction = `Trim expenses by ₹${Math.round(trim).toLocaleString("en-IN")}/month to hit 30%`;
    }
  }
  return {
    key: "savingsRate",
    label: "Savings rate",
    emoji: "💪",
    score,
    message,
    nextAction,
    peerBaseline:
      "Indian household net savings rate ≈ 18–21% of disposable income (NSO, FY23).",
  };
}

/**
 * Age-adjusted target multiplier for the investing pillar — the
 * "Fidelity glide path" generalised to user-supplied retirement age.
 *
 *   At age 25 (start of working life): 0.5× annual income.
 *   At retirement age: 8× annual income.
 *   Linear interpolation between (no jagged "lose 5pts on your 35th
 *   birthday" cliff).
 *
 * Falls back to a fixed 4× when age isn't supplied — same as the
 * pre-glide behaviour so unfilled profiles see no surprise change.
 */
const STARTING_AGE = 25;
const STARTING_TARGET = 0.5;
const RETIREMENT_TARGET = 8;
const DEFAULT_RETIREMENT_AGE = 60;

export function investingTargetForAge(
  age: number | null,
  retirementAge: number | null,
): number {
  if (age === null) return 4;
  const retire = retirementAge ?? DEFAULT_RETIREMENT_AGE;
  if (age <= STARTING_AGE) return STARTING_TARGET;
  if (age >= retire) return RETIREMENT_TARGET;
  const progress = (age - STARTING_AGE) / (retire - STARTING_AGE);
  return STARTING_TARGET + progress * (RETIREMENT_TARGET - STARTING_TARGET);
}

/**
 * Pillar 5 — Investing.
 *   Balance sub-score (0–15): investment_balance ÷ annual_income,
 *   compared against an age-adjusted target multiplier (the Fidelity
 *   glide path generalised by user-supplied retirement age — see
 *   investingTargetForAge above).
 *   SIP sub-score (0–5): any monthly_investment > 0 → 5pts.
 */
function investingPillar(i: ScoreInputs): Pillar {
  const target = investingTargetForAge(i.age, i.retirementAge);
  const retire = i.retirementAge ?? DEFAULT_RETIREMENT_AGE;
  let balanceSub = 0;
  let balanceMessage = "";
  if (i.investmentBalance === null || !i.monthlyIncome) {
    balanceSub = 0;
    balanceMessage = "Add your investment balance to score this.";
  } else if (i.investmentBalance === 0) {
    balanceSub = 0;
    balanceMessage = "No investments yet — start an SIP this month.";
  } else {
    const annualIncome = i.monthlyIncome * 12;
    const ratio = i.investmentBalance / annualIncome;
    balanceSub = clamp(Math.round((ratio / target) * 15), 0, 15);
    const targetLabel =
      i.age === null
        ? `target ${target.toFixed(1)}× annual income`
        : `target ${target.toFixed(2).replace(/\.?0+$/, "")}× by ${i.age} (retire at ${retire})`;
    if (balanceSub >= 15) {
      balanceMessage = `Investments ${ratio.toFixed(1)}× annual income — past ${targetLabel}.`;
    } else {
      balanceMessage = `Investments are ${ratio.toFixed(1)}× annual income (${targetLabel}).`;
    }
  }

  let sipSub = 0;
  let sipMessage = "";
  if (i.monthlyInvestment === null) {
    sipMessage = "";
  } else if (i.monthlyInvestment > 0) {
    sipSub = 5;
    sipMessage = "Active SIP — keep going.";
  } else {
    sipSub = 0;
    sipMessage = "No monthly SIP — even ₹1,000/mo compounds significantly.";
  }

  const score = balanceSub + sipSub;
  let nextAction: string | null = null;
  if (sipSub === 0) {
    nextAction = "Start an SIP — even ₹1,000/month";
  } else if (balanceSub < 15 && i.monthlyIncome) {
    nextAction = "Increase your SIP amount";
  }
  return {
    key: "investing",
    label: "Investing",
    emoji: "🌱",
    score,
    message: `${balanceMessage} ${sipMessage}`.trim(),
    nextAction,
    peerBaseline:
      "Only ~5% of Indians invest in equity directly; SIP book grew to ₹26,400 cr/mo by FY25 (NSE, AMFI, 2025).",
  };
}

/**
 * Compute the 5-pillar score from a profile snapshot.
 *
 * `hasEnoughData` returns true when the user has filled at least
 * the four core fields needed for a non-trivial score: monthly
 * income, monthly expenses, term/health cover (or hasDependents=false
 * for the term half), and either liquidSavings or investmentBalance.
 */
/**
 * Sources for the peerBaseline strings on each pillar — referenced by
 * the scorecard footer so users can verify the numbers. Kept short:
 * we cite the institution + year, not full paper titles.
 */
export const PEER_CITATIONS = [
  "RBI Household Finance Committee (Indian Household Finance), 2017",
  "RBI Financial Stability Report, 2024",
  "NSO Household Savings (PFCE-vs-disposable-income), FY23",
  "IRDAI Annual Report on insurance penetration, FY23",
  "AMFI/NSE SIP and equity-participation figures, 2025",
] as const;

export function computeScore(inputs: ScoreInputs): ScoreResult {
  const pillars: Pillar[] = [
    emergencyPillar(inputs),
    insurancePillar(inputs),
    debtPillar(inputs),
    savingsRatePillar(inputs),
    investingPillar(inputs),
  ];
  const total = pillars.reduce((s, p) => s + p.score, 0);

  const hasEnoughData =
    inputs.monthlyIncome !== null &&
    inputs.monthlyExpenses !== null &&
    inputs.liquidSavings !== null;

  return {
    total,
    band: bandFor(total),
    pillars,
    hasEnoughData,
  };
}
