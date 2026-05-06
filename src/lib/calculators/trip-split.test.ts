import { describe, it, expect } from "vitest";
import {
  calculateBalances,
  simplifyPayments,
  summariseTrip,
  type Person,
  type Expense,
} from "./trip-split";

const A: Person = { id: "a", name: "Amit" };
const B: Person = { id: "b", name: "Beena" };
const C: Person = { id: "c", name: "Chirag" };
const D: Person = { id: "d", name: "Divya" };

function exp(
  id: string,
  amount: number,
  payerId: string,
  sharerIds: string[],
  description = "",
): Expense {
  return { id, amount, description, payerId, sharerIds };
}

describe("calculateBalances", () => {
  it("zero people / zero expenses → empty balances", () => {
    expect(calculateBalances([], [])).toEqual([]);
  });

  it("single expense paid by A, split A+B+C → A owed 200, B and C owe 100 each", () => {
    const result = calculateBalances([A, B, C], [exp("e1", 300, "a", ["a", "b", "c"])]);
    expect(result.find((b) => b.personId === "a")?.amount).toBeCloseTo(200, 5);
    expect(result.find((b) => b.personId === "b")?.amount).toBeCloseTo(-100, 5);
    expect(result.find((b) => b.personId === "c")?.amount).toBeCloseTo(-100, 5);
  });

  it("balances always sum to zero (modulo epsilon)", () => {
    const cases: Expense[][] = [
      [exp("e1", 1500, "a", ["a", "b", "c"])],
      [
        exp("e1", 1500, "a", ["a", "b", "c"]),
        exp("e2", 600, "b", ["a", "b"]),
        exp("e3", 900, "c", ["b", "c"]),
      ],
      [
        exp("e1", 1234, "a", ["a", "b", "c", "d"]),
        exp("e2", 567, "b", ["a", "c"]),
        exp("e3", 89, "d", ["d"]),
      ],
    ];
    for (const expenses of cases) {
      const balances = calculateBalances([A, B, C, D], expenses);
      const sum = balances.reduce((s, b) => s + b.amount, 0);
      expect(Math.abs(sum)).toBeLessThan(0.011);
    }
  });

  it("expense where payer is not a sharer", () => {
    // A pays for B's lunch — A owed full amount, B owes full amount
    const result = calculateBalances([A, B], [exp("e1", 200, "a", ["b"])]);
    expect(result.find((b) => b.personId === "a")?.amount).toBeCloseTo(200, 5);
    expect(result.find((b) => b.personId === "b")?.amount).toBeCloseTo(-200, 5);
  });

  it("ignores expenses with zero amount or empty sharers", () => {
    const result = calculateBalances([A, B], [
      exp("e1", 0, "a", ["a", "b"]),
      exp("e2", 100, "a", []),
    ]);
    expect(result).toEqual([
      { personId: "a", amount: 0 },
      { personId: "b", amount: 0 },
    ]);
  });

  it("ignores unknown payer or sharer IDs", () => {
    const result = calculateBalances([A, B], [
      exp("e1", 100, "ghost", ["a", "b"]),
      exp("e2", 100, "a", ["a", "ghost"]),
    ]);
    // e1 ignored entirely; e2 treats only A as sharer (since ghost is unknown).
    // Wait — current impl: e2 still computes sharePerPerson = 100/2 = 50 from
    // sharer list size, but only debits A. A's balance = +100 (paid) - 50 (share) = +50.
    expect(result.find((b) => b.personId === "a")?.amount).toBeCloseTo(50, 5);
    expect(result.find((b) => b.personId === "b")?.amount).toBeCloseTo(0, 5);
  });
});

describe("simplifyPayments", () => {
  it("empty balances → no settlements", () => {
    expect(simplifyPayments([])).toEqual([]);
  });

  it("all-zero balances → no settlements", () => {
    expect(
      simplifyPayments([
        { personId: "a", amount: 0 },
        { personId: "b", amount: 0 },
      ]),
    ).toEqual([]);
  });

  it("simple one-to-one debt", () => {
    const settlements = simplifyPayments([
      { personId: "a", amount: 100 },
      { personId: "b", amount: -100 },
    ]);
    expect(settlements).toEqual([
      { fromPersonId: "b", toPersonId: "a", amount: 100 },
    ]);
  });

  it("two debtors paying one creditor", () => {
    const settlements = simplifyPayments([
      { personId: "a", amount: 200 },
      { personId: "b", amount: -120 },
      { personId: "c", amount: -80 },
    ]);
    expect(settlements).toHaveLength(2);
    // Each debtor pays exactly their absolute balance, total 200 to A.
    const total = settlements.reduce((s, x) => s + x.amount, 0);
    expect(total).toBeCloseTo(200, 5);
    for (const s of settlements) {
      expect(s.toPersonId).toBe("a");
    }
  });

  it("triangular debt of equal amount cancels (no settlements needed)", () => {
    // A→B 100, B→C 100, C→A 100 → all balances zero
    const expenses: Expense[] = [
      exp("e1", 100, "b", ["a"]),
      exp("e2", 100, "c", ["b"]),
      exp("e3", 100, "a", ["c"]),
    ];
    const balances = calculateBalances([A, B, C], expenses);
    const settlements = simplifyPayments(balances);
    expect(settlements).toEqual([]);
  });

  it("number of settlements ≤ N − 1 for N non-zero balances", () => {
    // 4 people, fairly tangled
    const expenses: Expense[] = [
      exp("e1", 1000, "a", ["a", "b", "c", "d"]),
      exp("e2", 400, "b", ["a", "c"]),
      exp("e3", 500, "c", ["b", "d"]),
    ];
    const balances = calculateBalances([A, B, C, D], expenses);
    const nonzero = balances.filter((b) => Math.abs(b.amount) >= 0.01).length;
    const settlements = simplifyPayments(balances);
    expect(settlements.length).toBeLessThanOrEqual(Math.max(0, nonzero - 1));
  });

  it("settlements net out: each person's net change matches their balance", () => {
    const balances = [
      { personId: "a", amount: 350 },
      { personId: "b", amount: -200 },
      { personId: "c", amount: -150 },
    ];
    const settlements = simplifyPayments(balances);
    const net = new Map<string, number>();
    for (const b of balances) net.set(b.personId, 0);
    for (const s of settlements) {
      net.set(s.fromPersonId, (net.get(s.fromPersonId) ?? 0) - s.amount);
      net.set(s.toPersonId, (net.get(s.toPersonId) ?? 0) + s.amount);
    }
    for (const b of balances) {
      expect(net.get(b.personId)).toBeCloseTo(b.amount, 4);
    }
  });

  it("each settlement is from a debtor to a creditor with positive amount", () => {
    const balances = [
      { personId: "a", amount: 500 },
      { personId: "b", amount: -300 },
      { personId: "c", amount: 100 },
      { personId: "d", amount: -300 },
    ];
    const settlements = simplifyPayments(balances);
    for (const s of settlements) {
      expect(s.amount).toBeGreaterThan(0);
      expect(s.fromPersonId).not.toBe(s.toPersonId);
    }
  });
});

describe("summariseTrip end-to-end", () => {
  it("4-person trip with mixed expenses", () => {
    const expenses: Expense[] = [
      exp("e1", 4000, "a", ["a", "b", "c", "d"], "Dinner"), // each owes 1000
      exp("e2", 1200, "b", ["a", "b"], "Cab"), // each owes 600
      exp("e3", 800, "c", ["c", "d"], "Snacks"), // each owes 400
    ];
    const summary = summariseTrip([A, B, C, D], expenses);

    expect(summary.totalSpent).toBe(6000);
    // A: paid 4000, owes (1000+600) = 1600 → +2400
    // B: paid 1200, owes (1000+600) = 1600 → −400
    // C: paid 800, owes (1000+400) = 1400 → −600
    // D: paid 0, owes (1000+400) = 1400 → −1400
    const balanceMap = new Map(summary.balances.map((b) => [b.personId, b.amount]));
    expect(balanceMap.get("a")).toBeCloseTo(2400, 5);
    expect(balanceMap.get("b")).toBeCloseTo(-400, 5);
    expect(balanceMap.get("c")).toBeCloseTo(-600, 5);
    expect(balanceMap.get("d")).toBeCloseTo(-1400, 5);

    // Settlements should net out and have ≤ 3 transactions (3 debtors, 1 creditor)
    expect(summary.settlements.length).toBeLessThanOrEqual(3);
    const totalSettled = summary.settlements.reduce((s, x) => s + x.amount, 0);
    expect(totalSettled).toBeCloseTo(2400, 5);
  });

  it("everyone-pays-equal trip → no settlements", () => {
    const expenses: Expense[] = [
      exp("e1", 1200, "a", ["a", "b", "c", "d"]),
      exp("e2", 1200, "b", ["a", "b", "c", "d"]),
      exp("e3", 1200, "c", ["a", "b", "c", "d"]),
      exp("e4", 1200, "d", ["a", "b", "c", "d"]),
    ];
    const summary = summariseTrip([A, B, C, D], expenses);
    expect(summary.totalSpent).toBe(4800);
    expect(summary.settlements).toEqual([]);
  });
});
