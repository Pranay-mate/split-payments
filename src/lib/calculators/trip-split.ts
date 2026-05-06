export type Person = {
  id: string;
  name: string;
};

export type Expense = {
  id: string;
  description: string;
  /** Amount paid in rupees. */
  amount: number;
  payerId: string;
  /** Equal split among these person IDs. */
  sharerIds: string[];
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
 * 1 paisa epsilon. Balances closer to zero than this are treated as settled
 * (avoids ping-pong on float precision artefacts).
 */
const EPSILON = 0.01;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Net balance per person across all expenses.
 *
 *   balance(p) = (sum of amounts p paid) − (sum of p's share in each expense)
 *
 * Positive balance means others owe p; negative means p owes others.
 * The sum of all balances is always zero (modulo float epsilon).
 */
export function calculateBalances(
  people: Person[],
  expenses: Expense[],
): Balance[] {
  const totals = new Map<string, number>();
  for (const p of people) totals.set(p.id, 0);

  for (const e of expenses) {
    if (e.amount <= 0 || e.sharerIds.length === 0) continue;
    if (!totals.has(e.payerId)) continue;

    const sharePerPerson = e.amount / e.sharerIds.length;

    totals.set(e.payerId, (totals.get(e.payerId) ?? 0) + e.amount);
    for (const sid of e.sharerIds) {
      if (!totals.has(sid)) continue;
      totals.set(sid, (totals.get(sid) ?? 0) - sharePerPerson);
    }
  }

  return people.map((p) => ({
    personId: p.id,
    amount: round2(totals.get(p.id) ?? 0),
  }));
}

/**
 * Greedy debt minimiser. Repeatedly settles the largest creditor against the
 * largest debtor for the smaller of the two amounts. Produces at most N − 1
 * transactions for N people with non-zero balances — this is the practical
 * minimum (true minimum is NP-hard but greedy hits it almost always).
 */
export function simplifyPayments(balances: Balance[]): Settlement[] {
  const work = balances.map((b) => ({
    personId: b.personId,
    amount: round2(b.amount),
  }));

  const settlements: Settlement[] = [];
  // Safety bound: greedy strictly reduces non-zero count, so this terminates
  // long before the bound. The bound just guards against pathological floats.
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

/**
 * Convenience: balances + settlements + total spent.
 */
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
