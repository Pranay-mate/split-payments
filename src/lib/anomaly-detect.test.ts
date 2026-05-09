import { describe, it, expect } from "vitest";
import { detectAnomalies, type AnomalyEntry } from "./anomaly-detect";

function entries(rows: { month: string; cat: string; amounts: number[] }[]): AnomalyEntry[] {
  const out: AnomalyEntry[] = [];
  for (const r of rows) {
    for (const a of r.amounts) {
      out.push({ monthKey: r.month, category: r.cat, amount: a });
    }
  }
  return out;
}

describe("detectAnomalies", () => {
  it("flags a category with current > 1.5× baseline and ≥3 entries", () => {
    const rows = entries([
      { month: "2026-03", cat: "food", amounts: [200, 200, 200] }, // 600
      { month: "2026-04", cat: "food", amounts: [200, 200, 200] }, // 600
      { month: "2026-05", cat: "food", amounts: [400, 400, 400] }, // 1200 = 2× baseline
    ]);
    const out = detectAnomalies(rows, "2026-05");
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe("food");
    expect(out[0].current).toBe(1200);
    expect(out[0].baseline).toBe(600);
    expect(out[0].severity).toBeCloseTo(1.0, 2); // 100% over
    expect(out[0].entryCount).toBe(3);
    expect(out[0].baselineMonths).toBe(2);
  });

  it("skips when current is only 1.4× baseline (under threshold)", () => {
    const rows = entries([
      { month: "2026-03", cat: "food", amounts: [500, 500] },
      { month: "2026-04", cat: "food", amounts: [500, 500] },
      { month: "2026-05", cat: "food", amounts: [700, 350, 350] }, // 1400 = 1.4× of 1000
    ]);
    expect(detectAnomalies(rows, "2026-05")).toEqual([]);
  });

  it("skips when current month has fewer than 3 entries (avoid one-off blip)", () => {
    const rows = entries([
      { month: "2026-03", cat: "stay", amounts: [5000] },
      { month: "2026-04", cat: "stay", amounts: [5000] },
      { month: "2026-05", cat: "stay", amounts: [50000] }, // 1 entry, 10× baseline
    ]);
    expect(detectAnomalies(rows, "2026-05")).toEqual([]);
  });

  it("skips when baseline is < 2 months of history", () => {
    const rows = entries([
      { month: "2026-04", cat: "food", amounts: [500, 500, 500] },
      { month: "2026-05", cat: "food", amounts: [2000, 2000, 2000] },
    ]);
    expect(detectAnomalies(rows, "2026-05")).toEqual([]);
  });

  it("skips low-amount categories (₹<200/mo noise floor)", () => {
    const rows = entries([
      { month: "2026-03", cat: "tips", amounts: [10, 10] },
      { month: "2026-04", cat: "tips", amounts: [10, 10] },
      { month: "2026-05", cat: "tips", amounts: [50, 50, 50] }, // 150 < 200 floor
    ]);
    expect(detectAnomalies(rows, "2026-05")).toEqual([]);
  });

  it("returns up to 2 anomalies, sorted by severity (worst first)", () => {
    const rows = entries([
      // food: 2× over
      { month: "2026-03", cat: "food", amounts: [200, 200, 200] },
      { month: "2026-04", cat: "food", amounts: [200, 200, 200] },
      { month: "2026-05", cat: "food", amounts: [400, 400, 400] },
      // entertainment: 5× over
      { month: "2026-03", cat: "entertainment", amounts: [200, 200, 200] },
      { month: "2026-04", cat: "entertainment", amounts: [200, 200, 200] },
      { month: "2026-05", cat: "entertainment", amounts: [1000, 1000, 1000] },
      // travel: 3× over
      { month: "2026-03", cat: "travel", amounts: [200, 200, 200] },
      { month: "2026-04", cat: "travel", amounts: [200, 200, 200] },
      { month: "2026-05", cat: "travel", amounts: [600, 600, 600] },
    ]);
    const out = detectAnomalies(rows, "2026-05");
    expect(out).toHaveLength(2);
    expect(out[0].category).toBe("entertainment"); // worst
    expect(out[1].category).toBe("travel");
  });

  it("ignores categories that didn't occur in the current month", () => {
    const rows = entries([
      { month: "2026-03", cat: "food", amounts: [200, 200, 200] },
      { month: "2026-04", cat: "food", amounts: [2000, 2000, 2000] }, // big in April
      { month: "2026-05", cat: "groceries", amounts: [500, 500, 500] }, // current is groceries, not food
    ]);
    expect(detectAnomalies(rows, "2026-05")).toEqual([]);
  });

  it("returns empty array on empty input", () => {
    expect(detectAnomalies([], "2026-05")).toEqual([]);
  });

  it("baseline averages prior months (not all-time)", () => {
    const rows = entries([
      // 6 months of food at ₹600/mo
      { month: "2025-12", cat: "food", amounts: [200, 200, 200] },
      { month: "2026-01", cat: "food", amounts: [200, 200, 200] },
      { month: "2026-02", cat: "food", amounts: [200, 200, 200] },
      { month: "2026-03", cat: "food", amounts: [200, 200, 200] },
      { month: "2026-04", cat: "food", amounts: [200, 200, 200] },
      // current spike
      { month: "2026-05", cat: "food", amounts: [500, 500, 500] }, // 1500 = 2.5× baseline
    ]);
    const out = detectAnomalies(rows, "2026-05");
    expect(out).toHaveLength(1);
    expect(out[0].baseline).toBe(600);
    expect(out[0].severity).toBeCloseTo(1.5, 2);
  });
});
