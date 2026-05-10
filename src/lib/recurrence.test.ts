import { describe, it, expect } from "vitest";
import { computeNextDue, lastDayOfMonth } from "./recurrence";

describe("lastDayOfMonth", () => {
  it("January = 31", () => expect(lastDayOfMonth(2026, 0)).toBe(31));
  it("April = 30", () => expect(lastDayOfMonth(2026, 3)).toBe(30));
  it("February (non-leap) = 28", () => expect(lastDayOfMonth(2026, 1)).toBe(28));
  it("February (leap) = 29", () => expect(lastDayOfMonth(2024, 1)).toBe(29));
});

describe("computeNextDue (first fire)", () => {
  it("returns later date in same month if scheduleDay is in the future", () => {
    // Today is 8 May 2026, scheduleDay = 15 → due 15 May 2026
    const ref = new Date(2026, 4, 8);
    const next = computeNextDue(15, ref, null);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(4);
    expect(next.getDate()).toBe(15);
  });

  it("returns same day if today === scheduleDay (still 'today or later')", () => {
    const ref = new Date(2026, 4, 15, 10, 0, 0);
    const next = computeNextDue(15, ref, null);
    expect(next.getDate()).toBe(15);
    expect(next.getMonth()).toBe(4);
  });

  it("rolls to next month if scheduleDay already passed", () => {
    // Today is 20 May, scheduleDay = 5 → due 5 June
    const ref = new Date(2026, 4, 20);
    const next = computeNextDue(5, ref, null);
    expect(next.getMonth()).toBe(5); // June
    expect(next.getDate()).toBe(5);
  });

  it("clamps day 31 to last day in shorter months", () => {
    // Reference 1 Feb 2026, scheduleDay = 31 → 28 Feb 2026
    const ref = new Date(2026, 1, 1);
    const next = computeNextDue(31, ref, null);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(28);
  });

  it("clamps day 31 to 29 Feb in a leap year", () => {
    const ref = new Date(2024, 1, 1);
    const next = computeNextDue(31, ref, null);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(29);
  });
});

describe("computeNextDue (subsequent fires)", () => {
  it("advances exactly one calendar month from lastFiredAt", () => {
    const fired = new Date(2026, 4, 15); // 15 May
    const next = computeNextDue(15, new Date(), fired);
    expect(next.getMonth()).toBe(5); // June
    expect(next.getDate()).toBe(15);
  });

  it("clamps schedule day to last-day in shorter target month", () => {
    // Fired 31 Jan → next is 28 Feb 2026
    const fired = new Date(2026, 0, 31);
    const next = computeNextDue(31, new Date(), fired);
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(28);
  });

  it("crosses year boundary correctly", () => {
    const fired = new Date(2026, 11, 15); // 15 Dec
    const next = computeNextDue(15, new Date(), fired);
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(0); // Jan
    expect(next.getDate()).toBe(15);
  });

  it("rejects scheduleDay outside 1-31", () => {
    expect(() => computeNextDue(0, new Date(), null)).toThrow();
    expect(() => computeNextDue(32, new Date(), null)).toThrow();
  });
});
