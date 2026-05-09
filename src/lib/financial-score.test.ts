import { describe, it, expect } from "vitest";
import {
  computeScore,
  investingTargetForAge,
  type ScoreInputs,
} from "./financial-score";

const empty: ScoreInputs = {
  age: null,
  retirementAge: null,
  isFreelancer: false,
  hasDependents: false,
  hasCcCarryover: false,
  monthlyIncome: null,
  monthlyExpenses: null,
  liquidSavings: null,
  termCoverAmount: null,
  healthCoverAmount: null,
  totalEmi: null,
  investmentBalance: null,
  monthlyInvestment: null,
};

describe("financial-score · computeScore", () => {
  describe("empty profile", () => {
    it("scores from defaults (no-deps term + no-CC-carryover) but flags hasEnoughData=false", () => {
      // hasDependents=false → term sub maxes at 10pts (genuine no-need).
      // hasCcCarryover=false → CC sub maxes at 5pts.
      // Other pillars: no inputs → 0.
      // Total = 15. The UI gates score display behind hasEnoughData so
      // a user who hasn't completed onboarding never sees this.
      const r = computeScore(empty);
      expect(r.total).toBe(15);
      expect(r.band).toBe("red");
      expect(r.hasEnoughData).toBe(false);
    });
  });

  describe("emergency fund pillar", () => {
    it("hits full marks at the freelancer target (9 months)", () => {
      const r = computeScore({
        ...empty,
        isFreelancer: true,
        monthlyExpenses: 50000,
        liquidSavings: 50000 * 9,
      });
      const p = r.pillars.find((x) => x.key === "emergency")!;
      expect(p.score).toBe(20);
      expect(p.nextAction).toBeNull();
    });

    it("hits full marks at the salaried target (6 months)", () => {
      const r = computeScore({
        ...empty,
        isFreelancer: false,
        monthlyExpenses: 50000,
        liquidSavings: 50000 * 6,
      });
      const p = r.pillars.find((x) => x.key === "emergency")!;
      expect(p.score).toBe(20);
    });

    it("scales linearly below target", () => {
      const r = computeScore({
        ...empty,
        monthlyExpenses: 50000,
        liquidSavings: 50000 * 3, // half of 6 months
      });
      const p = r.pillars.find((x) => x.key === "emergency")!;
      expect(p.score).toBe(10);
    });

    it("surfaces a concrete next-action with rupee target", () => {
      const r = computeScore({
        ...empty,
        monthlyExpenses: 30000,
        liquidSavings: 30000 * 2, // 2 months — 4 to go
      });
      const p = r.pillars.find((x) => x.key === "emergency")!;
      expect(p.nextAction).toMatch(/120,000|1,20,000/); // either Indian or Western locale rendering
    });
  });

  describe("insurance pillar", () => {
    it("term half = full marks when no dependents", () => {
      const r = computeScore({
        ...empty,
        hasDependents: false,
        healthCoverAmount: 1500000,
      });
      const p = r.pillars.find((x) => x.key === "insurance")!;
      expect(p.score).toBe(20); // 10 (no-deps) + 10 (health)
    });

    it("term half scales with cover ratio when dependents", () => {
      const r = computeScore({
        ...empty,
        hasDependents: true,
        monthlyIncome: 100000,
        termCoverAmount: 100000 * 12 * 5, // 5× annual = half target
        healthCoverAmount: 0,
      });
      const p = r.pillars.find((x) => x.key === "insurance")!;
      // term = 5pts (half of 10) + health = 0 → 5 total
      expect(p.score).toBe(5);
    });

    it("health half hits 10 at ₹15L", () => {
      const r = computeScore({
        ...empty,
        hasDependents: false,
        healthCoverAmount: 1500000,
      });
      const p = r.pillars.find((x) => x.key === "insurance")!;
      expect(p.score).toBe(20);
    });

    it("health half scales below ₹15L", () => {
      const r = computeScore({
        ...empty,
        hasDependents: false,
        healthCoverAmount: 750000, // half of ₹15L
      });
      const p = r.pillars.find((x) => x.key === "insurance")!;
      expect(p.score).toBe(15); // 10 (no-deps) + 5 (half health)
    });

    it("nextAction nudges health top-up first when both gaps exist", () => {
      const r = computeScore({
        ...empty,
        hasDependents: true,
        monthlyIncome: 100000,
        termCoverAmount: 0,
        healthCoverAmount: 0,
      });
      const p = r.pillars.find((x) => x.key === "insurance")!;
      expect(p.nextAction).toMatch(/health/i);
    });
  });

  describe("debt pillar", () => {
    it("no EMIs + no CC carryover = 20", () => {
      const r = computeScore({
        ...empty,
        monthlyIncome: 100000,
        totalEmi: 0,
        hasCcCarryover: false,
      });
      const p = r.pillars.find((x) => x.key === "debt")!;
      expect(p.score).toBe(20);
    });

    it("CC carryover drops 5pts", () => {
      const r = computeScore({
        ...empty,
        monthlyIncome: 100000,
        totalEmi: 0,
        hasCcCarryover: true,
      });
      const p = r.pillars.find((x) => x.key === "debt")!;
      expect(p.score).toBe(15);
      expect(p.nextAction).toMatch(/credit-card/i);
    });

    it("EMI 50% of income → 0 EMI sub-score", () => {
      const r = computeScore({
        ...empty,
        monthlyIncome: 100000,
        totalEmi: 50000,
      });
      const p = r.pillars.find((x) => x.key === "debt")!;
      expect(p.score).toBe(5); // 0 EMI + 5 no-CC
    });

    it("EMI 25% of income → middle of EMI band", () => {
      const r = computeScore({
        ...empty,
        monthlyIncome: 100000,
        totalEmi: 25000,
      });
      const p = r.pillars.find((x) => x.key === "debt")!;
      // EMI ratio 0.25 → 15 - 30*0.25 = 7.5 → rounds to 8 + 5 no-CC = 13
      expect(p.score).toBe(13);
    });
  });

  describe("savings rate pillar", () => {
    it("30% rate hits 20", () => {
      const r = computeScore({
        ...empty,
        monthlyIncome: 100000,
        monthlyExpenses: 70000,
      });
      const p = r.pillars.find((x) => x.key === "savingsRate")!;
      expect(p.score).toBe(20);
    });

    it("20% rate scales", () => {
      const r = computeScore({
        ...empty,
        monthlyIncome: 100000,
        monthlyExpenses: 80000,
      });
      const p = r.pillars.find((x) => x.key === "savingsRate")!;
      // 0.2 / 0.3 * 20 = 13.33 → rounds to 13
      expect(p.score).toBe(13);
    });

    it("spending more than earning = 0", () => {
      const r = computeScore({
        ...empty,
        monthlyIncome: 100000,
        monthlyExpenses: 110000,
      });
      const p = r.pillars.find((x) => x.key === "savingsRate")!;
      expect(p.score).toBe(0);
      expect(p.message).toMatch(/spending more/i);
    });
  });

  describe("investing pillar", () => {
    it("4× annual income + active SIP = 20", () => {
      const r = computeScore({
        ...empty,
        monthlyIncome: 100000,
        investmentBalance: 100000 * 12 * 4,
        monthlyInvestment: 10000,
      });
      const p = r.pillars.find((x) => x.key === "investing")!;
      expect(p.score).toBe(20);
    });

    it("balance only, no SIP — caps at 15", () => {
      const r = computeScore({
        ...empty,
        monthlyIncome: 100000,
        investmentBalance: 100000 * 12 * 4,
        monthlyInvestment: 0,
      });
      const p = r.pillars.find((x) => x.key === "investing")!;
      expect(p.score).toBe(15);
      expect(p.nextAction).toMatch(/SIP/);
    });

    it("SIP only, no balance = 5", () => {
      const r = computeScore({
        ...empty,
        monthlyIncome: 100000,
        investmentBalance: 0,
        monthlyInvestment: 5000,
      });
      const p = r.pillars.find((x) => x.key === "investing")!;
      expect(p.score).toBe(5);
    });
  });

  describe("totals + bands", () => {
    it("a fully-loaded ideal profile scores ≥80 (green)", () => {
      const r = computeScore({
        age: 32,
        retirementAge: 60,
        isFreelancer: false,
        hasDependents: true,
        hasCcCarryover: false,
        monthlyIncome: 200000,
        monthlyExpenses: 100000, // 50% rate
        liquidSavings: 100000 * 6, // 6 months
        termCoverAmount: 200000 * 12 * 10, // 10×
        healthCoverAmount: 1500000,
        totalEmi: 0,
        investmentBalance: 200000 * 12 * 4, // 4× annual
        monthlyInvestment: 30000,
      });
      expect(r.total).toBeGreaterThanOrEqual(80);
      expect(r.band).toBe("green");
      expect(r.hasEnoughData).toBe(true);
    });

    it("hasEnoughData requires income, expenses, and liquid savings", () => {
      const r = computeScore({ ...empty, monthlyIncome: 100000 });
      expect(r.hasEnoughData).toBe(false);
    });

    it("band thresholds: red < 40, amber 40-59, emerald 60-79, green 80+", () => {
      // Construct profiles that hit each band
      const baseInputs = {
        ...empty,
        monthlyIncome: 100000,
        monthlyExpenses: 100000, // 0% savings rate
        liquidSavings: 0,
        totalEmi: 50000, // ratio 0.5 → EMI 0
        hasCcCarryover: true,
      };
      const red = computeScore(baseInputs);
      expect(red.band).toBe("red");
    });
  });
});

describe("financial-score · investingTargetForAge (age-adjusted glide)", () => {
  it("falls back to fixed 4× when age is null", () => {
    expect(investingTargetForAge(null, 60)).toBe(4);
    expect(investingTargetForAge(null, null)).toBe(4);
  });

  it("returns 0.5× at the start of the curve (age ≤ 25)", () => {
    expect(investingTargetForAge(20, 60)).toBe(0.5);
    expect(investingTargetForAge(25, 60)).toBe(0.5);
  });

  it("returns 8× at retirement age and beyond", () => {
    expect(investingTargetForAge(60, 60)).toBe(8);
    expect(investingTargetForAge(70, 60)).toBe(8);
  });

  it("uses default retirement of 60 when retirementAge is null", () => {
    expect(investingTargetForAge(30, null)).toBe(
      investingTargetForAge(30, 60),
    );
  });

  it("interpolates linearly between 25 and retirement", () => {
    // Age 30, retire at 60 → progress 5/35 → target = 0.5 + 5/35 * 7.5
    const t30 = investingTargetForAge(30, 60);
    expect(t30).toBeCloseTo(0.5 + (5 / 35) * 7.5, 5);
    // Age 45, retire at 60 → progress 20/35 → target = 0.5 + 20/35 * 7.5
    const t45 = investingTargetForAge(45, 60);
    expect(t45).toBeCloseTo(0.5 + (20 / 35) * 7.5, 5);
  });

  it("steeper curve for earlier retirement (FIRE)", () => {
    // Age 30 retiring at 45 should have a much higher target than retiring at 60.
    const fire = investingTargetForAge(30, 45);
    const standard = investingTargetForAge(30, 60);
    expect(fire).toBeGreaterThan(standard);
  });

  it("flatter curve for later retirement", () => {
    const standard = investingTargetForAge(30, 60);
    const late = investingTargetForAge(30, 65);
    expect(late).toBeLessThan(standard);
  });
});

describe("financial-score · investing pillar uses the age-glide", () => {
  const baseSeven = {
    ...empty,
    monthlyIncome: 120000,
    investmentBalance: 1000000,
    monthlyInvestment: 50000, // active SIP — gets +5
  };

  it("age 28 retiring at 60 lifts the score for the same balance", () => {
    const oldFixed = computeScore({
      ...baseSeven,
      age: null, // forces fixed 4× target — old behaviour
    });
    const newGlide = computeScore({
      ...baseSeven,
      age: 28,
      retirementAge: 60,
    });
    const oldP = oldFixed.pillars.find((p) => p.key === "investing")!;
    const newP = newGlide.pillars.find((p) => p.key === "investing")!;
    expect(newP.score).toBeGreaterThan(oldP.score);
  });

  it("FIRE target (retire at 45) is harsher than retire at 60", () => {
    const fire = computeScore({ ...baseSeven, age: 28, retirementAge: 45 });
    const standard = computeScore({
      ...baseSeven,
      age: 28,
      retirementAge: 60,
    });
    const fireP = fire.pillars.find((p) => p.key === "investing")!;
    const stdP = standard.pillars.find((p) => p.key === "investing")!;
    expect(fireP.score).toBeLessThan(stdP.score);
  });

  it("user past retirement age caps at 8× target", () => {
    // 10L invested ÷ 14.4L annual income = 0.694× of an 8× target.
    // (0.694 / 8) × 15 = 1.30 → rounds to 1. Plus 5 for active SIP = 6.
    const out = computeScore({
      ...baseSeven,
      age: 65,
      retirementAge: 60,
    });
    const p = out.pillars.find((p) => p.key === "investing")!;
    expect(p.score).toBe(6);
  });
});

