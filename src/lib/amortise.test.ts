import { describe, expect, it } from "vitest";
import {
  debtTrajectory,
  freedomDate,
  monthsBetween,
  monthsToFreedom,
  outstandingAfterMonths,
  outstandingAt,
  totalOutstandingAt,
} from "./amortise";

describe("monthsBetween", () => {
  it("returns 0 for the same date", () => {
    const d = new Date("2026-05-17");
    expect(monthsBetween(d, d)).toBe(0);
  });

  it("counts whole months across years", () => {
    expect(
      monthsBetween(new Date("2025-01-15"), new Date("2026-05-15")),
    ).toBe(16);
  });

  it("does NOT count partial months when the day-of-month hasn't been reached", () => {
    // 2026-02-10 is only 2 days short of one full month from 2026-01-12,
    // but it's still less than a full month so should round down.
    expect(
      monthsBetween(new Date("2026-01-12"), new Date("2026-02-10")),
    ).toBe(0);
  });

  it("is negative when end is before start", () => {
    expect(
      monthsBetween(new Date("2026-05-15"), new Date("2026-01-15")),
    ).toBe(-4);
  });
});

describe("outstandingAfterMonths — reducing balance", () => {
  // Sanity check against an iterative computation for a 1L loan @ 12% / 1 year.
  // EMI = ₹8884.88. Iterating month-by-month (interest = balance * 0.01,
  // principal = EMI - interest, balance -= principal) gives ₹51,492.09 at
  // the end of month 6. ±₹1 tolerance for floating-point.
  it("matches textbook amortisation after 6 months on a 1L / 12% / 12m loan", () => {
    const balance = outstandingAfterMonths(100000, 8884.88, 12, 6);
    expect(balance).toBeCloseTo(51492, 0);
  });

  it("returns the principal unchanged when months <= 0", () => {
    expect(outstandingAfterMonths(500000, 5000, 8, 0)).toBe(500000);
    expect(outstandingAfterMonths(500000, 5000, 8, -3)).toBe(500000);
  });

  it("handles zero-interest loans linearly", () => {
    expect(outstandingAfterMonths(120000, 10000, 0, 5)).toBe(70000);
    expect(outstandingAfterMonths(120000, 10000, 0, 12)).toBe(0);
    expect(outstandingAfterMonths(120000, 10000, 0, 20)).toBe(0);
  });

  it("clamps to 0 once the loan is fully repaid", () => {
    // Tiny loan, big EMI — paid off in <2 months.
    expect(outstandingAfterMonths(1000, 600, 12, 10)).toBe(0);
  });

  it("does not go below 0 even on aggressive overpayment", () => {
    expect(outstandingAfterMonths(50000, 100000, 8, 24)).toBe(0);
  });

  it("returns a growing balance when EMI < interest (warning case)", () => {
    // EMI 100/mo on 1L @ 12% — interest alone is ₹1000/mo. Loan grows.
    const after12 = outstandingAfterMonths(100000, 100, 12, 12);
    expect(after12).toBeGreaterThan(100000);
  });
});

describe("outstandingAt — date-based", () => {
  it("returns 0 once the loan has run past tenure", () => {
    const loan = {
      principal: 100000,
      emi: 8884.88,
      annualRatePct: 12,
      startDate: new Date("2025-01-01"),
    };
    // 24 months later — well past the 12-month tenure
    expect(outstandingAt(loan, new Date("2027-01-01"))).toBe(0);
  });

  it("returns the principal at startDate", () => {
    const loan = {
      principal: 500000,
      emi: 6000,
      annualRatePct: 8.5,
      startDate: new Date("2026-05-17"),
    };
    expect(outstandingAt(loan, new Date("2026-05-17"))).toBe(500000);
  });

  it("matches outstandingAfterMonths for a chosen offset", () => {
    const loan = {
      principal: 4000000,
      emi: 35000,
      annualRatePct: 8.5,
      startDate: new Date("2026-01-01"),
    };
    const byMonths = outstandingAfterMonths(4000000, 35000, 8.5, 12);
    const byDate = outstandingAt(loan, new Date("2027-01-01"));
    expect(byDate).toBeCloseTo(byMonths, 0);
  });
});

describe("monthsToFreedom", () => {
  it("matches the constructed tenure", () => {
    // Standard 1L/12%/12m loan with the textbook EMI.
    expect(monthsToFreedom({
      principal: 100000,
      emi: 8884.88,
      annualRatePct: 12,
      startDate: new Date("2026-01-01"),
    })).toBe(12);
  });

  it("handles zero-interest by linear division", () => {
    expect(monthsToFreedom({
      principal: 120000,
      emi: 10000,
      annualRatePct: 0,
      startDate: new Date("2026-01-01"),
    })).toBe(12);
  });

  it("returns Infinity when EMI doesn't cover interest", () => {
    expect(monthsToFreedom({
      principal: 100000,
      emi: 100,
      annualRatePct: 12,
      startDate: new Date("2026-01-01"),
    })).toBe(Infinity);
  });

  it("rounds up — partial month means one more EMI to clear", () => {
    // 100k at 0% with EMI 30000 → 3.33 months → should round to 4.
    expect(monthsToFreedom({
      principal: 100000,
      emi: 30000,
      annualRatePct: 0,
      startDate: new Date("2026-01-01"),
    })).toBe(4);
  });
});

describe("freedomDate", () => {
  it("returns a date `months` after startDate", () => {
    const fd = freedomDate({
      principal: 100000,
      emi: 8884.88,
      annualRatePct: 12,
      startDate: new Date("2026-01-01"),
    });
    expect(fd).not.toBeNull();
    expect(fd!.getFullYear()).toBe(2027);
    expect(fd!.getMonth()).toBe(0); // January (loan paid by end of Jan 2027)
  });

  it("returns null for non-amortising loans", () => {
    expect(freedomDate({
      principal: 100000,
      emi: 100,
      annualRatePct: 12,
      startDate: new Date("2026-01-01"),
    })).toBeNull();
  });
});

describe("totalOutstandingAt", () => {
  it("sums multiple loans", () => {
    const loans = [
      { principal: 1000, emi: 1100, annualRatePct: 0, startDate: new Date("2026-05-01") },
      { principal: 2000, emi: 2100, annualRatePct: 0, startDate: new Date("2026-05-01") },
    ];
    expect(totalOutstandingAt(loans, new Date("2026-05-01"))).toBe(3000);
    expect(totalOutstandingAt(loans, new Date("2026-06-01"))).toBe(0);
  });

  it("returns 0 for an empty list", () => {
    expect(totalOutstandingAt([], new Date())).toBe(0);
  });
});

describe("debtTrajectory", () => {
  it("returns months+1 points (the as-of date + each future month)", () => {
    const traj = debtTrajectory(
      [{ principal: 100000, emi: 8884.88, annualRatePct: 12, startDate: new Date("2026-01-01") }],
      new Date("2026-01-01"),
      12,
    );
    expect(traj).toHaveLength(13);
  });

  it("trajectory ends at 0 once the loan is fully repaid", () => {
    const traj = debtTrajectory(
      [{ principal: 100000, emi: 8884.88, annualRatePct: 12, startDate: new Date("2026-01-01") }],
      new Date("2026-01-01"),
      18,
    );
    expect(traj[traj.length - 1].outstanding).toBe(0);
  });

  it("is monotonically decreasing for a well-formed loan", () => {
    const traj = debtTrajectory(
      [{ principal: 500000, emi: 6500, annualRatePct: 9, startDate: new Date("2026-01-01") }],
      new Date("2026-01-01"),
      24,
    );
    for (let i = 1; i < traj.length; i++) {
      expect(traj[i].outstanding).toBeLessThanOrEqual(traj[i - 1].outstanding);
    }
  });
});
