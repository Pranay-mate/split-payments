import { describe, expect, it } from "vitest";
import { deriveBadges, pillarSeries } from "./financial-badges";

const baseScores = {
  emergency: 0,
  insurance: 0,
  debt: 0,
  savingsRate: 0,
  investing: 0,
};

const snap = (
  date: string,
  total: number,
  band: "red" | "amber" | "emerald" | "green",
  overrides: Partial<typeof baseScores> = {},
) => ({
  total,
  band,
  snapshottedAt: new Date(date),
  pillarScores: { ...baseScores, ...overrides },
});

describe("deriveBadges", () => {
  it("returns nothing for empty history", () => {
    expect(deriveBadges([])).toEqual([]);
  });

  it("awards Safety Net the first time emergency hits 20", () => {
    const history = [
      snap("2026-01-01", 10, "amber", { emergency: 10 }),
      snap("2026-02-01", 25, "amber", { emergency: 20 }),
      snap("2026-03-01", 30, "amber", { emergency: 20 }),
    ];
    const badges = deriveBadges(history);
    const safety = badges.find((b) => b.key === "safety_net");
    expect(safety?.earnedOn).toBe("2026-02-01");
  });

  it("does not award Safety Net if emergency never reaches 20", () => {
    const history = [snap("2026-01-01", 10, "amber", { emergency: 19 })];
    expect(deriveBadges(history).find((b) => b.key === "safety_net")).toBeUndefined();
  });

  it("awards Green Band on first green snapshot", () => {
    const history = [
      snap("2026-01-01", 70, "emerald"),
      snap("2026-02-01", 85, "green"),
    ];
    const green = deriveBadges(history).find((b) => b.key === "green_band");
    expect(green?.earnedOn).toBe("2026-02-01");
  });

  it("awards +10 Improvement when total climbs 10+ from an earlier low", () => {
    const history = [
      snap("2026-01-01", 50, "amber"),
      snap("2026-02-01", 45, "amber"),
      snap("2026-03-01", 55, "amber"), // +10 vs 45
    ];
    const jump = deriveBadges(history).find((b) => b.key === "ten_point_jump");
    expect(jump?.earnedOn).toBe("2026-03-01");
  });

  it("does not award +10 Improvement when scores hover within 9 pts", () => {
    const history = [
      snap("2026-01-01", 50, "amber"),
      snap("2026-02-01", 58, "amber"),
      snap("2026-03-01", 56, "amber"),
    ];
    expect(
      deriveBadges(history).find((b) => b.key === "ten_point_jump"),
    ).toBeUndefined();
  });

  it("awards Consistent Green on the third distinct green month", () => {
    const history = [
      snap("2026-01-15", 82, "green"),
      snap("2026-01-25", 82, "green"), // same month — does not count
      snap("2026-02-10", 84, "green"),
      snap("2026-03-05", 88, "green"), // earns it here
    ];
    const streak = deriveBadges(history).find((b) => b.key === "consistent_green");
    expect(streak?.earnedOn).toBe("2026-03-05");
  });

  it("does not award Consistent Green with only 2 green months", () => {
    const history = [
      snap("2026-01-15", 82, "green"),
      snap("2026-02-10", 84, "green"),
    ];
    expect(
      deriveBadges(history).find((b) => b.key === "consistent_green"),
    ).toBeUndefined();
  });

  it("returns badges sorted newest-first", () => {
    const history = [
      snap("2026-01-01", 70, "emerald", { emergency: 20 }),
      snap("2026-02-01", 85, "green"),
    ];
    const badges = deriveBadges(history);
    expect(badges[0].earnedOn >= badges[badges.length - 1].earnedOn).toBe(true);
  });
});

describe("pillarSeries", () => {
  it("groups scores by pillar key chronologically", () => {
    const history = [
      snap("2026-01-01", 30, "amber", { emergency: 5, debt: 10 }),
      snap("2026-02-01", 45, "amber", { emergency: 10, debt: 12 }),
    ];
    const series = pillarSeries(history);
    expect(series.emergency.map((p) => p.score)).toEqual([5, 10]);
    expect(series.debt.map((p) => p.score)).toEqual([10, 12]);
  });
});
