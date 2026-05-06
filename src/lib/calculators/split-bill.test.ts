import { describe, it, expect } from "vitest";
import { calculateSplitBill } from "./split-bill";

describe("calculateSplitBill", () => {
  describe("happy path", () => {
    it("splits an evenly divisible bill with no tip", () => {
      const r = calculateSplitBill({
        billAmount: 1000,
        numPeople: 4,
      });
      expect(r.perPerson).toBe(250);
      expect(r.grandTotal).toBe(1000);
      expect(r.tipAmount).toBe(0);
      expect(r.roundingExcess).toBe(0);
    });

    it("adds an optional tip in rupees", () => {
      const r = calculateSplitBill({
        billAmount: 1000,
        numPeople: 4,
        tipAmount: 200,
      });
      expect(r.grandTotal).toBe(1200);
      expect(r.perPerson).toBe(300);
      expect(r.roundingExcess).toBe(0);
    });

    it("rounds per-person up to whole rupee when bill doesn't divide evenly", () => {
      const r = calculateSplitBill({
        billAmount: 101,
        numPeople: 4,
      });
      expect(r.rawPerPerson).toBeCloseTo(25.25, 5);
      expect(r.perPerson).toBe(26);
      // 26 × 4 = 104; excess vs 101 = 3
      expect(r.roundingExcess).toBe(3);
    });

    it("rounding excess is always less than numPeople rupees", () => {
      const cases = [
        { billAmount: 1234, numPeople: 5 },
        { billAmount: 999, numPeople: 7 },
        { billAmount: 12345, numPeople: 11 },
      ];
      for (const c of cases) {
        const r = calculateSplitBill(c);
        expect(r.roundingExcess).toBeLessThan(c.numPeople);
        expect(r.roundingExcess).toBeGreaterThanOrEqual(0);
      }
    });

    it("perPerson × numPeople always covers grandTotal (never short)", () => {
      const cases = [
        { billAmount: 1000, numPeople: 3, tipAmount: 50 },
        { billAmount: 555, numPeople: 9 },
        { billAmount: 12_345.67, numPeople: 6, tipAmount: 100 },
      ];
      for (const c of cases) {
        const r = calculateSplitBill(c);
        expect(r.perPerson * c.numPeople).toBeGreaterThanOrEqual(r.grandTotal);
      }
    });
  });

  describe("input clamping", () => {
    it("clamps numPeople to at least 1", () => {
      const r = calculateSplitBill({ billAmount: 100, numPeople: 0 });
      expect(r.perPerson).toBe(100);
    });

    it("floors fractional numPeople", () => {
      const r = calculateSplitBill({ billAmount: 300, numPeople: 3.7 });
      // floor(3.7) = 3
      expect(r.perPerson).toBe(100);
    });

    it("clamps negative billAmount to 0", () => {
      const r = calculateSplitBill({ billAmount: -500, numPeople: 4 });
      expect(r.baseAmount).toBe(0);
      expect(r.perPerson).toBe(0);
      expect(r.grandTotal).toBe(0);
    });

    it("clamps negative tipAmount to 0", () => {
      const r = calculateSplitBill({
        billAmount: 1000,
        numPeople: 4,
        tipAmount: -100,
      });
      expect(r.tipAmount).toBe(0);
      expect(r.perPerson).toBe(250);
    });

    it("treats undefined tip as 0", () => {
      const r = calculateSplitBill({ billAmount: 200, numPeople: 2 });
      expect(r.tipAmount).toBe(0);
      expect(r.perPerson).toBe(100);
    });
  });

  describe("realistic scenarios", () => {
    it("typical group dinner: ₹2,400 bill, 5 people, ₹100 tip", () => {
      const r = calculateSplitBill({
        billAmount: 2400,
        numPeople: 5,
        tipAmount: 100,
      });
      expect(r.grandTotal).toBe(2500);
      expect(r.perPerson).toBe(500);
    });

    it("uneven bill: ₹1,377 bill, 3 people", () => {
      const r = calculateSplitBill({
        billAmount: 1377,
        numPeople: 3,
      });
      expect(r.rawPerPerson).toBe(459);
      expect(r.perPerson).toBe(459);
      expect(r.roundingExcess).toBe(0);
    });

    it("solo (1 person) gets the entire amount", () => {
      const r = calculateSplitBill({
        billAmount: 850,
        numPeople: 1,
        tipAmount: 50,
      });
      expect(r.perPerson).toBe(900);
    });

    it("decimal bill amount rounds correctly", () => {
      const r = calculateSplitBill({
        billAmount: 333.33,
        numPeople: 3,
      });
      expect(r.rawPerPerson).toBeCloseTo(111.11, 5);
      expect(r.perPerson).toBe(112);
    });
  });

  describe("invariants (property-based-ish)", () => {
    const inputs = [
      { billAmount: 100, numPeople: 1 },
      { billAmount: 1234.56, numPeople: 7, tipAmount: 50 },
      { billAmount: 0, numPeople: 5 },
      { billAmount: 99.99, numPeople: 3, tipAmount: 0.5 },
      { billAmount: 100_000, numPeople: 13, tipAmount: 1000 },
    ];

    it("perPerson is always a non-negative integer", () => {
      for (const input of inputs) {
        const r = calculateSplitBill(input);
        expect(r.perPerson).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(r.perPerson)).toBe(true);
      }
    });

    it("breakdown adds up to grandTotal", () => {
      for (const input of inputs) {
        const r = calculateSplitBill(input);
        expect(r.baseAmount + r.tipAmount).toBeCloseTo(r.grandTotal, 5);
      }
    });
  });
});
