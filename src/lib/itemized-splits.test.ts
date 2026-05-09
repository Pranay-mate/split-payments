import { describe, it, expect } from "vitest";
import { splitsFromItems } from "./itemized-splits";

describe("splitsFromItems", () => {
  it("splits a single item evenly between 2 sharers", () => {
    const out = splitsFromItems([{ amount: 100, sharerIds: ["a", "b"] }]);
    expect(out).toHaveLength(2);
    expect(out.find((s) => s.userId === "a")?.amount).toBe(50);
    expect(out.find((s) => s.userId === "b")?.amount).toBe(50);
  });

  it("splits a single item evenly between 3 sharers (penny residual)", () => {
    const out = splitsFromItems([{ amount: 100, sharerIds: ["a", "b", "c"] }]);
    const sum = out.reduce((s, x) => s + x.amount, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(0.01);
    // one of them carries the extra paisa
    const sorted = out.map((x) => x.amount).sort();
    expect(sorted[0]).toBeCloseTo(33.33, 2);
    expect(sorted[1]).toBeCloseTo(33.33, 2);
    expect(sorted[2]).toBeCloseTo(33.34, 2);
  });

  it("aggregates the same user's share across multiple items", () => {
    const out = splitsFromItems([
      { amount: 600, sharerIds: ["a", "b", "c"] }, // pizza
      { amount: 50, sharerIds: ["a"] }, // tea (a only)
    ]);
    const a = out.find((s) => s.userId === "a")?.amount ?? 0;
    const b = out.find((s) => s.userId === "b")?.amount ?? 0;
    expect(a).toBeGreaterThan(b); // tea pushes a higher
    const sum = out.reduce((s, x) => s + x.amount, 0);
    expect(Math.abs(sum - 650)).toBeLessThan(0.01);
  });

  it("preserves sum-to-the-rupee invariant on awkward divisors", () => {
    // 7 sharers on ₹100 = 14.2857… each. 2dp rounding drifts.
    const sharers = ["a", "b", "c", "d", "e", "f", "g"];
    const out = splitsFromItems([{ amount: 100, sharerIds: sharers }]);
    const sum = out.reduce((s, x) => s + x.amount, 0);
    expect(Math.abs(sum - 100)).toBeLessThan(0.01);
  });

  it("skips items with no sharers — dropped item's amount goes nowhere", () => {
    const out = splitsFromItems([
      { amount: 600, sharerIds: ["a", "b"] },
      { amount: 50, sharerIds: [] }, // dropped, doesn't influence anyone's share
    ]);
    const sum = out.reduce((s, x) => s + x.amount, 0);
    // Splits sum to the items actually distributed, not the literal
    // items[].amount sum. The empty-sharers item is treated as if it
    // wasn't passed in. (Form validation upstream prevents this case
    // anyway; this is safety for direct callers.)
    expect(sum).toBeCloseTo(600, 2);
  });

  it("returns empty array for empty input", () => {
    expect(splitsFromItems([])).toEqual([]);
  });

  it("handles a single sharer on multiple items", () => {
    const out = splitsFromItems([
      { amount: 100, sharerIds: ["a"] },
      { amount: 50, sharerIds: ["a"] },
    ]);
    expect(out).toEqual([{ userId: "a", amount: 150 }]);
  });

  it("residual goes to the highest-share user", () => {
    // Construct a case where rounding under-reports total. After 2dp
    // rounding, the user who owes the most should absorb the residual.
    const out = splitsFromItems([
      { amount: 333.33, sharerIds: ["heavy", "light"] }, // 166.665 each
      { amount: 100, sharerIds: ["heavy"] },
    ]);
    const sum = out.reduce((s, x) => s + x.amount, 0);
    expect(Math.abs(sum - 433.33)).toBeLessThan(0.01);
    const heavy = out.find((s) => s.userId === "heavy")!;
    const light = out.find((s) => s.userId === "light")!;
    expect(heavy.amount).toBeGreaterThan(light.amount);
  });
});
