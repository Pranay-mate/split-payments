export type Person = {
  id: string;
  name: string;
};

export type SplitMode = "equal" | "exact";

export type Split = {
  personId: string;
  /** Amount this person is responsible for (in rupees). */
  amount: number;
};

export type Expense = {
  id: string;
  description: string;
  /** Total amount paid in rupees. Should equal sum of splits[].amount (within 1 paisa). */
  amount: number;
  payerId: string;
  splitMode: SplitMode;
  splits: Split[];
};

export type Balance = {
  personId: string;
  /** Positive = is owed money. Negative = owes money. */
  amount: number;
};

export type Settlement = {
  fromPersonId: string;
  toPersonId: string;
  amount: number;
};

/**
 * 1 paisa epsilon. Balances closer to zero than this are treated as settled.
 * Also used as the tolerance for "splits sum to amount" validation.
 */
const EPSILON = 0.01;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Builds equal-split shares for a given amount across sharer IDs. Used by the
 * form when the user picks "Equal" split, and by tests as a convenient helper.
 */
export function equalSplits(amount: number, sharerIds: string[]): Split[] {
  if (sharerIds.length === 0) return [];
  const per = round2(amount / sharerIds.length);
  return sharerIds.map((id) => ({ personId: id, amount: per }));
}

/**
 * Net balance per person across all expenses.
 *
 *   balance(p) = (sum of amounts p paid) − (sum of p's split amounts)
 *
 * Positive = owed money, negative = owes money. Sum of all balances ≈ 0.
 *
 * Expenses where splits don't sum to amount (within 1 paisa) are skipped to
 * keep balances coherent — the UI must validate before saving.
 */
export function calculateBalances(
  people: Person[],
  expenses: Expense[],
): Balance[] {
  const totals = new Map<string, number>();
  for (const p of people) totals.set(p.id, 0);

  for (const e of expenses) {
    if (e.amount <= 0 || e.splits.length === 0) continue;
    if (!totals.has(e.payerId)) continue;

    const splitSum = e.splits.reduce((s, x) => s + Math.max(0, x.amount), 0);
    if (Math.abs(splitSum - e.amount) > EPSILON) continue;

    totals.set(e.payerId, (totals.get(e.payerId) ?? 0) + e.amount);
    for (const split of e.splits) {
      if (!totals.has(split.personId)) continue;
      if (split.amount <= 0) continue;
      totals.set(
        split.personId,
        (totals.get(split.personId) ?? 0) - split.amount,
      );
    }
  }

  return people.map((p) => ({
    personId: p.id,
    amount: round2(totals.get(p.id) ?? 0),
  }));
}

/**
 * Greedy debt minimiser. Pairs largest creditor with largest debtor each
 * iteration. ≤ N − 1 transfers for N non-zero balances.
 */
export function simplifyPayments(balances: Balance[]): Settlement[] {
  const work = balances.map((b) => ({
    personId: b.personId,
    amount: round2(b.amount),
  }));

  const settlements: Settlement[] = [];
  const safetyMax = work.length * work.length + 10;
  let iter = 0;

  while (iter++ < safetyMax) {
    let creditorIdx = -1;
    let debtorIdx = -1;
    let maxPos = EPSILON;
    let minNeg = -EPSILON;

    for (let i = 0; i < work.length; i++) {
      const a = work[i].amount;
      if (a > maxPos) {
        maxPos = a;
        creditorIdx = i;
      }
      if (a < minNeg) {
        minNeg = a;
        debtorIdx = i;
      }
    }

    if (creditorIdx === -1 || debtorIdx === -1) break;

    const creditor = work[creditorIdx];
    const debtor = work[debtorIdx];
    const settle = round2(Math.min(creditor.amount, -debtor.amount));

    settlements.push({
      fromPersonId: debtor.personId,
      toPersonId: creditor.personId,
      amount: settle,
    });

    creditor.amount = round2(creditor.amount - settle);
    debtor.amount = round2(debtor.amount + settle);
  }

  return settlements;
}

export type TripSummary = {
  balances: Balance[];
  settlements: Settlement[];
  totalSpent: number;
};

export function summariseTrip(
  people: Person[],
  expenses: Expense[],
): TripSummary {
  const balances = calculateBalances(people, expenses);
  const settlements = simplifyPayments(balances);
  const totalSpent = expenses.reduce((sum, e) => sum + Math.max(0, e.amount), 0);
  return { balances, settlements, totalSpent };
}
