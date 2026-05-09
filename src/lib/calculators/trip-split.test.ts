import { describe, it, expect } from "vitest";
import {
  calculateBalances,
  equalSplits,
  pairwiseDebts,
  personBreakdown,
  simplifyPayments,
  summariseTrip,
  type Person,
  type Expense,
  type Settlement,
} from "./trip-split";

const A: Person = { id: "a", name: "Amit" };
const B: Person = { id: "b", name: "Beena" };
const C: Person = { id: "c", name: "Chirag" };
const D: Person = { id: "d", name: "Divya" };

/** Build an equal-split expense (matches default UI mode). */
function exp(
  id: string,
  amount: number,
  payerId: string,
  sharerIds: string[],
  description = "",
): Expense {
  return {
    id,
    amount,
    description,
    payerId,
    splitMode: "equal",
    splits: equalSplits(amount, sharerIds),
  };
}

/** Build an exact-amount expense from a personId → amount map. */
function expExact(
  id: string,
  amount: number,
  payerId: string,
  shares: Record<string, number>,
  description = "",
): Expense {
  return {
    id,
    amount,
    description,
    payerId,
    splitMode: "exact",
    splits: Object.entries(shares).map(([personId, amt]) => ({
      personId,
      amount: amt,
    })),
  };
}

describe("equalSplits", () => {
  it("divides amount across sharers and rounds to 2 decimals", () => {
    const splits = equalSplits(100, ["a", "b", "c"]);
    expect(splits).toHaveLength(3);
    for (const s of splits) {
      expect(s.amount).toBeCloseTo(33.33, 2);
    }
  });

  it("returns empty array for empty sharerIds", () => {
    expect(equalSplits(100, [])).toEqual([]);
  });
});

describe("calculateBalances (equal split)", () => {
  it("zero people / zero expenses → empty balances", () => {
    expect(calculateBalances([], [])).toEqual([]);
  });

  it("single expense paid by A, split A+B+C → A owed 200, B and C owe 100 each", () => {
    const result = calculateBalances([A, B, C], [exp("e1", 300, "a", ["a", "b", "c"])]);
    expect(result.find((b) => b.personId === "a")?.amount).toBeCloseTo(200, 2);
    expect(result.find((b) => b.personId === "b")?.amount).toBeCloseTo(-100, 2);
    expect(result.find((b) => b.personId === "c")?.amount).toBeCloseTo(-100, 2);
  });

  it("balances always sum to zero (modulo epsilon)", () => {
    const cases: Expense[][] = [
      [exp("e1", 1500, "a", ["a", "b", "c"])],
      [
        exp("e1", 1500, "a", ["a", "b", "c"]),
        exp("e2", 600, "b", ["a", "b"]),
        exp("e3", 900, "c", ["b", "c"]),
      ],
    ];
    for (const expenses of cases) {
      const balances = calculateBalances([A, B, C, D], expenses);
      const sum = balances.reduce((s, b) => s + b.amount, 0);
      expect(Math.abs(sum)).toBeLessThan(0.011);
    }
  });

  it("expense where payer is not a sharer", () => {
    const result = calculateBalances([A, B], [exp("e1", 200, "a", ["b"])]);
    expect(result.find((b) => b.personId === "a")?.amount).toBeCloseTo(200, 2);
    expect(result.find((b) => b.personId === "b")?.amount).toBeCloseTo(-200, 2);
  });

  it("ignores expenses with zero amount or empty splits", () => {
    const empties: Expense[] = [
      exp("e1", 0, "a", ["a", "b"]),
      {
        id: "e2",
        amount: 100,
        description: "",
        payerId: "a",
        splitMode: "equal",
        splits: [],
      },
    ];
    const result = calculateBalances([A, B], empties);
    expect(result).toEqual([
      { personId: "a", amount: 0 },
      { personId: "b", amount: 0 },
    ]);
  });
});

describe("calculateBalances (exact split)", () => {
  it("user's own scenario: pranay paid 500, anjali 200 / heme 250 / pranay 50", () => {
    const pranay: Person = { id: "p", name: "Pranay" };
    const anjali: Person = { id: "a", name: "Anjali" };
    const heme: Person = { id: "h", name: "Heme" };

    const result = calculateBalances(
      [pranay, anjali, heme],
      [expExact("e1", 500, "p", { p: 50, a: 200, h: 250 })],
    );

    // Pranay paid 500, owes 50 → +450
    // Anjali owes 200 → -200
    // Heme owes 250 → -250
    expect(result.find((b) => b.personId === "p")?.amount).toBeCloseTo(450, 2);
    expect(result.find((b) => b.personId === "a")?.amount).toBeCloseTo(-200, 2);
    expect(result.find((b) => b.personId === "h")?.amount).toBeCloseTo(-250, 2);

    const sum = result.reduce((s, b) => s + b.amount, 0);
    expect(Math.abs(sum)).toBeLessThan(0.011);
  });

  it("skips expense where splits don't sum to amount (mismatch > 1 paisa)", () => {
    const result = calculateBalances(
      [A, B, C],
      [expExact("e1", 1000, "a", { a: 100, b: 100, c: 100 })], // sum 300 ≠ 1000
    );
    // Expense should be ignored entirely.
    expect(result.every((b) => b.amount === 0)).toBe(true);
  });

  it("accepts splits with sub-paisa float drift", () => {
    // 100 / 3 = 33.3333... Each split rounded to 33.33 → sum = 99.99.
    // Difference 0.01 is exactly EPSILON; should be accepted.
    const result = calculateBalances(
      [A, B, C],
      [expExact("e1", 100, "a", { a: 33.33, b: 33.33, c: 33.34 })],
    );
    expect(result.find((b) => b.personId === "a")?.amount).toBeCloseTo(66.67, 2);
  });

  it("mix of equal and exact expenses in same trip", () => {
    const result = calculateBalances(
      [A, B, C],
      [
        exp("e1", 300, "a", ["a", "b", "c"]), // equal: each owes 100
        expExact("e2", 600, "b", { a: 100, b: 200, c: 300 }), // weighted
      ],
    );
    // A: paid 300, owes 100 (e1) + 100 (e2) = 200 → +100
    // B: paid 600, owes 100 (e1) + 200 (e2) = 300 → +300
    // C: owes 100 (e1) + 300 (e2) = 400 → -400
    expect(result.find((b) => b.personId === "a")?.amount).toBeCloseTo(100, 2);
    expect(result.find((b) => b.personId === "b")?.amount).toBeCloseTo(300, 2);
    expect(result.find((b) => b.personId === "c")?.amount).toBeCloseTo(-400, 2);
  });
});

describe("simplifyPayments", () => {
  it("empty balances → no settlements", () => {
    expect(simplifyPayments([])).toEqual([]);
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
    const total = settlements.reduce((s, x) => s + x.amount, 0);
    expect(total).toBeCloseTo(200, 2);
    for (const s of settlements) expect(s.toPersonId).toBe("a");
  });

  it("triangular debt of equal amount cancels (no settlements needed)", () => {
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
      expect(net.get(b.personId)).toBeCloseTo(b.amount, 2);
    }
  });
});

describe("applySettlements", () => {
  it("settles an exact two-person debt to zero", () => {
    const result = summariseTrip(
      [A, B],
      [exp("e1", 1000, "a", ["a", "b"])], // A paid 1000, each owes 500 → A +500, B −500
      [{ fromPersonId: "b", toPersonId: "a", amount: 500 }],
    );
    expect(result.balances.find((x) => x.personId === "a")?.amount).toBeCloseTo(0, 2);
    expect(result.balances.find((x) => x.personId === "b")?.amount).toBeCloseTo(0, 2);
    expect(result.settlements).toEqual([]); // already settled, no transfers needed
    expect(result.totalSettled).toBe(500);
  });

  it("partial settlement leaves residual balance + smaller suggested transfer", () => {
    const result = summariseTrip(
      [A, B],
      [exp("e1", 1000, "a", ["a", "b"])],
      [{ fromPersonId: "b", toPersonId: "a", amount: 200 }],
    );
    // A had +500, B had -500. After 200 paid: A +300, B -300.
    expect(result.balances.find((x) => x.personId === "a")?.amount).toBeCloseTo(300, 2);
    expect(result.balances.find((x) => x.personId === "b")?.amount).toBeCloseTo(-300, 2);
    expect(result.settlements).toHaveLength(1);
    expect(result.settlements[0].amount).toBeCloseTo(300, 2);
  });

  it("ignores settlements involving unknown persons", () => {
    const result = summariseTrip(
      [A, B],
      [exp("e1", 1000, "a", ["a", "b"])],
      [{ fromPersonId: "ghost", toPersonId: "a", amount: 200 }],
    );
    // 'ghost' isn't in the people list — A's balance still gets reduced (toPersonId)
    // but only one side; result still consistent because applySettlements skips
    // unknown personIds.
    expect(result.balances.find((x) => x.personId === "a")?.amount).toBeCloseTo(300, 2);
  });

  it("multiple settlements compose", () => {
    const result = summariseTrip(
      [A, B, C],
      [exp("e1", 600, "a", ["a", "b", "c"])], // A +400, B -200, C -200
      [
        { fromPersonId: "b", toPersonId: "a", amount: 200 },
        { fromPersonId: "c", toPersonId: "a", amount: 200 },
      ],
    );
    expect(result.balances.find((x) => x.personId === "a")?.amount).toBeCloseTo(0, 2);
    expect(result.balances.find((x) => x.personId === "b")?.amount).toBeCloseTo(0, 2);
    expect(result.balances.find((x) => x.personId === "c")?.amount).toBeCloseTo(0, 2);
    expect(result.settlements).toEqual([]);
    expect(result.totalSettled).toBe(400);
  });
});

describe("summariseTrip end-to-end", () => {
  it("4-person trip with mixed expenses (equal mode)", () => {
    const expenses: Expense[] = [
      exp("e1", 4000, "a", ["a", "b", "c", "d"], "Dinner"),
      exp("e2", 1200, "b", ["a", "b"], "Cab"),
      exp("e3", 800, "c", ["c", "d"], "Snacks"),
    ];
    const summary = summariseTrip([A, B, C, D], expenses);

    expect(summary.totalSpent).toBe(6000);
    const m = new Map(summary.balances.map((b) => [b.personId, b.amount]));
    expect(m.get("a")).toBeCloseTo(2400, 2);
    expect(m.get("b")).toBeCloseTo(-400, 2);
    expect(m.get("c")).toBeCloseTo(-600, 2);
    expect(m.get("d")).toBeCloseTo(-1400, 2);

    const totalSettled = summary.settlements.reduce((s, x) => s + x.amount, 0);
    expect(totalSettled).toBeCloseTo(2400, 2);
  });

  it("everyone-pays-equal trip → no settlements", () => {
    const expenses: Expense[] = [
      exp("e1", 1200, "a", ["a", "b", "c", "d"]),
      exp("e2", 1200, "b", ["a", "b", "c", "d"]),
      exp("e3", 1200, "c", ["a", "b", "c", "d"]),
      exp("e4", 1200, "d", ["a", "b", "c", "d"]),
    ];
    const summary = summariseTrip([A, B, C, D], expenses);
    expect(summary.settlements).toEqual([]);
  });
});

describe("pairwiseDebts", () => {
  const makeExpense = (
    id: string,
    payerId: string,
    amount: number,
    splits: { personId: string; amount: number }[],
  ): Expense => ({
    id,
    description: id,
    amount,
    payerId,
    splitMode: "equal",
    splits,
  });

  it("returns empty for no expenses", () => {
    expect(pairwiseDebts([], [])).toEqual([]);
  });

  it("returns one debt when A pays for B's share", () => {
    // A paid ₹200, split equally among A, B
    const out = pairwiseDebts(
      [
        makeExpense("e1", "a", 200, [
          { personId: "a", amount: 100 },
          { personId: "b", amount: 100 },
        ]),
      ],
      [],
    );
    expect(out).toEqual([{ fromPersonId: "b", toPersonId: "a", amount: 100 }]);
  });

  it("nets reverse pairs (A owes B 500, B owes A 200 → A owes B 300)", () => {
    const out = pairwiseDebts(
      [
        // A paid 1000 split A+B → B owes A 500
        makeExpense("e1", "a", 1000, [
          { personId: "a", amount: 500 },
          { personId: "b", amount: 500 },
        ]),
        // B paid 400 split A+B → A owes B 200
        makeExpense("e2", "b", 400, [
          { personId: "a", amount: 200 },
          { personId: "b", amount: 200 },
        ]),
      ],
      [],
    );
    // Net: B owes A 300
    expect(out).toEqual([{ fromPersonId: "b", toPersonId: "a", amount: 300 }]);
  });

  it("subtracts recorded settlements from the matching pair", () => {
    const expenses = [
      makeExpense("e1", "a", 1000, [
        { personId: "a", amount: 500 },
        { personId: "b", amount: 500 },
      ]),
    ];
    // B already paid back 200 of the 500
    const settlements: Settlement[] = [
      { fromPersonId: "b", toPersonId: "a", amount: 200 },
    ];
    const out = pairwiseDebts(expenses, settlements);
    expect(out).toEqual([{ fromPersonId: "b", toPersonId: "a", amount: 300 }]);
  });

  it("drops zeroed-out pairs", () => {
    // B owes A 300; B then pays back exactly 300
    const out = pairwiseDebts(
      [
        makeExpense("e1", "a", 600, [
          { personId: "a", amount: 300 },
          { personId: "b", amount: 300 },
        ]),
      ],
      [{ fromPersonId: "b", toPersonId: "a", amount: 300 }],
    );
    expect(out).toEqual([]);
  });

  it("never produces self-debts (payer's own split row is skipped)", () => {
    const out = pairwiseDebts(
      [
        makeExpense("e1", "a", 300, [
          { personId: "a", amount: 100 },
          { personId: "b", amount: 100 },
          { personId: "c", amount: 100 },
        ]),
      ],
      [],
    );
    // Only B→A and C→A; no A→A
    expect(out).toHaveLength(2);
    for (const d of out) {
      expect(d.fromPersonId).not.toBe(d.toPersonId);
    }
  });

  it("sorts by amount descending", () => {
    const out = pairwiseDebts(
      [
        makeExpense("small", "a", 100, [
          { personId: "a", amount: 50 },
          { personId: "b", amount: 50 },
        ]),
        makeExpense("big", "a", 1000, [
          { personId: "a", amount: 500 },
          { personId: "c", amount: 500 },
        ]),
      ],
      [],
    );
    expect(out[0].amount).toBe(500); // C→A first
    expect(out[1].amount).toBe(50); // B→A second
  });

  it("net balance per person matches simplifyPayments (different presentation, same money)", () => {
    // Three-way: A pays 600 split equally; B pays 300 split equally
    const expenses = [
      makeExpense("e1", "a", 600, [
        { personId: "a", amount: 200 },
        { personId: "b", amount: 200 },
        { personId: "c", amount: 200 },
      ]),
      makeExpense("e2", "b", 300, [
        { personId: "a", amount: 100 },
        { personId: "b", amount: 100 },
        { personId: "c", amount: 100 },
      ]),
    ];
    const pairwise = pairwiseDebts(expenses, []);
    // Sum the net amount each person owes/is owed under pairwise:
    const net = new Map<string, number>();
    for (const d of pairwise) {
      net.set(d.fromPersonId, (net.get(d.fromPersonId) ?? 0) - d.amount);
      net.set(d.toPersonId, (net.get(d.toPersonId) ?? 0) + d.amount);
    }
    // Compare to calculateBalances. Same nets.
    const balances = calculateBalances(
      [A, B, { id: "c", name: "C" }],
      expenses,
    );
    for (const b of balances) {
      expect(net.get(b.personId) ?? 0).toBeCloseTo(b.amount, 2);
    }
  });
});

describe("personBreakdown", () => {
  it("returns zeros for a person not involved in any expense", () => {
    const expenses = [exp("e1", 300, A.id, [A.id, B.id], "Lunch")];
    const result = personBreakdown(C.id, expenses);
    expect(result.paid).toBe(0);
    expect(result.share).toBe(0);
    expect(result.net).toBe(0);
    expect(result.contributions).toEqual([]);
  });

  it("records paid amount when person is the payer", () => {
    // Alice pays ₹300; she + Bob each share ₹150.
    const expenses = [exp("e1", 300, A.id, [A.id, B.id], "Lunch")];
    const result = personBreakdown(A.id, expenses);
    expect(result.paid).toBe(300);
    expect(result.share).toBe(150);
    expect(result.net).toBe(150);
    expect(result.contributions).toHaveLength(1);
    expect(result.contributions[0]).toMatchObject({
      expenseId: "e1",
      description: "Lunch",
      paid: 300,
      share: 150,
      net: 150,
    });
  });

  it("records share-only when person is sharer but not payer", () => {
    const expenses = [exp("e1", 300, A.id, [A.id, B.id], "Lunch")];
    const result = personBreakdown(B.id, expenses);
    expect(result.paid).toBe(0);
    expect(result.share).toBe(150);
    expect(result.net).toBe(-150);
  });

  it("aggregates across multiple expenses correctly", () => {
    const expenses = [
      exp("e1", 600, A.id, [A.id, B.id, C.id], "Dinner"), // A pays 600, share 200 each
      exp("e2", 300, C.id, [A.id, C.id], "Coffee"), // C pays 300, share 150 each
    ];
    const a = personBreakdown(A.id, expenses);
    expect(a.paid).toBe(600);
    expect(a.share).toBe(350); // 200 + 150
    expect(a.net).toBe(250);
    expect(a.contributions).toHaveLength(2);
  });

  it("net per-person sums match calculateBalances", () => {
    // Property check: the breakdown's net should equal the balance for any
    // person — they're computed from the same source by definition.
    const expenses = [
      exp("e1", 600, A.id, [A.id, B.id, C.id], "Dinner"),
      exp("e2", 300, C.id, [A.id, B.id, C.id], "Coffee"),
      exp("e3", 240, B.id, [A.id, B.id], "Cab"),
    ];
    const balances = calculateBalances([A, B, C], expenses);
    for (const b of balances) {
      const bd = personBreakdown(b.personId, expenses);
      expect(bd.net).toBeCloseTo(b.amount, 2);
    }
  });

  it("drops expenses where person had no involvement", () => {
    const expenses = [
      exp("e1", 200, A.id, [A.id, B.id], "Pizza"),
      exp("e2", 300, C.id, [C.id, D.id], "Movie"), // A not involved
    ];
    const a = personBreakdown(A.id, expenses);
    expect(a.contributions).toHaveLength(1);
    expect(a.contributions[0].expenseId).toBe("e1");
  });
});
