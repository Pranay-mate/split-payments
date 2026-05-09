export type Person = {
  id: string;
  name: string;
};

export type SplitMode = "equal" | "exact" | "share" | "percent";

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
 * Per-person breakdown — how a single person's net balance was built
 * from the expense ledger. Used by the "Why?" expander on simplified
 * settlements: surfacing these two numbers (paid vs. share) explains
 * where the debt came from in honest first-principles terms — no need
 * to walk the greedy algorithm's intermediate transfers.
 *
 *   net = paid − share
 *
 * `contributions` is the per-expense slice for users who want to drill
 * deeper. Each row holds:
 *   { description, paid, share, net }
 * where `paid` is the full amount if this person was the payer (else 0),
 * `share` is their split row from that expense (0 if they weren't a
 * sharer), and `net = paid − share`. Rows where both are 0 are dropped.
 */
export type PersonBreakdown = {
  paid: number;
  share: number;
  net: number;
  contributions: Array<{
    expenseId: string;
    description: string;
    paid: number;
    share: number;
    net: number;
  }>;
};

export function personBreakdown(
  personId: string,
  expenses: Expense[],
): PersonBreakdown {
  let paid = 0;
  let share = 0;
  const contributions: PersonBreakdown["contributions"] = [];
  for (const e of expenses) {
    const p = e.payerId === personId ? e.amount : 0;
    const s = e.splits.find((x) => x.personId === personId)?.amount ?? 0;
    if (p === 0 && s === 0) continue;
    paid += p;
    share += s;
    contributions.push({
      expenseId: e.id,
      description: e.description,
      paid: round2(p),
      share: round2(s),
      net: round2(p - s),
    });
  }
  return {
    paid: round2(paid),
    share: round2(share),
    net: round2(paid - share),
    contributions,
  };
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
  /** Simplified (greedy debt-minimisation) — fewest transfers possible. */
  settlements: Settlement[];
  /** Pairwise — pay back the person you actually transacted with. ≥ simplified count. */
  pairwiseSettlements: Settlement[];
  totalSpent: number;
  totalSettled: number;
};

/**
 * Apply recorded settlements (payer → receiver, amount) to a set of balances.
 * Settling reduces the payer's debt (+= amount) and the receiver's credit
 * (-= amount), so a fully settled group nets to zero.
 */
export function applySettlements(
  balances: Balance[],
  settlements: Settlement[],
): Balance[] {
  if (settlements.length === 0) return balances;
  const map = new Map<string, number>();
  for (const b of balances) map.set(b.personId, b.amount);
  for (const s of settlements) {
    if (s.amount <= 0) continue;
    if (map.has(s.fromPersonId)) {
      map.set(s.fromPersonId, (map.get(s.fromPersonId) ?? 0) + s.amount);
    }
    if (map.has(s.toPersonId)) {
      map.set(s.toPersonId, (map.get(s.toPersonId) ?? 0) - s.amount);
    }
  }
  return balances.map((b) => ({ ...b, amount: round2(map.get(b.personId) ?? 0) }));
}

/**
 * Pairwise debts — net amount owed between every pair of people based on the
 * actual transactions, NOT the simplified greedy graph. Use this when users
 * want to "pay back the person you actually transacted with" rather than
 * having the algorithm route them through a third party.
 *
 * Algorithm:
 *   1. For each expense, every non-payer split row creates a (debtor → payer)
 *      debt of split.amount.
 *   2. Recorded settlements subtract from the matching pair (from → to).
 *   3. For each unordered pair {A, B}, net the two directions: if A→B is
 *      ₹500 and B→A is ₹200, output A→B for ₹300 and drop B→A.
 *   4. Drop pairs that net to zero (within 1 paisa).
 *   5. Sort by amount descending so the biggest debts surface first.
 *
 * Note: simplifyPayments(balances) and pairwiseDebts(expenses, settlements)
 * give the same NET balance per person — they just present differently.
 * Pairwise typically has more transfers (≥ simplified count).
 */
export function pairwiseDebts(
  expenses: Expense[],
  recordedSettlements: Settlement[] = [],
): Settlement[] {
  // Pair key: "from|to" — direction matters here.
  const debts = new Map<string, number>();
  const bump = (from: string, to: string, amount: number) => {
    if (amount <= 0 || from === to) return;
    const key = `${from}|${to}`;
    debts.set(key, (debts.get(key) ?? 0) + amount);
  };

  for (const e of expenses) {
    for (const s of e.splits) {
      if (s.personId === e.payerId) continue;
      bump(s.personId, e.payerId, s.amount);
    }
  }

  // Settlements reduce the matching directional debt.
  for (const s of recordedSettlements) {
    if (s.amount <= 0) continue;
    const key = `${s.fromPersonId}|${s.toPersonId}`;
    debts.set(key, (debts.get(key) ?? 0) - s.amount);
  }

  // Net out reverse pairs and emit the dominant direction.
  const out: Settlement[] = [];
  const seen = new Set<string>();
  for (const [key, amount] of debts) {
    if (seen.has(key)) continue;
    const [from, to] = key.split("|");
    const reverseKey = `${to}|${from}`;
    const reverse = debts.get(reverseKey) ?? 0;
    seen.add(key);
    seen.add(reverseKey);
    const net = round2(amount - reverse);
    if (Math.abs(net) < EPSILON) continue;
    if (net > 0) {
      out.push({ fromPersonId: from, toPersonId: to, amount: net });
    } else {
      out.push({ fromPersonId: to, toPersonId: from, amount: -net });
    }
  }

  return out.sort((a, b) => b.amount - a.amount);
}

export function summariseTrip(
  people: Person[],
  expenses: Expense[],
  recordedSettlements: Settlement[] = [],
): TripSummary {
  const rawBalances = calculateBalances(people, expenses);
  const balances = applySettlements(rawBalances, recordedSettlements);
  const settlements = simplifyPayments(balances);
  const pairwiseSettlements = pairwiseDebts(expenses, recordedSettlements);
  const totalSpent = expenses.reduce((sum, e) => sum + Math.max(0, e.amount), 0);
  const totalSettled = recordedSettlements.reduce(
    (sum, s) => sum + Math.max(0, s.amount),
    0,
  );
  return {
    balances,
    settlements,
    pairwiseSettlements,
    totalSpent,
    totalSettled,
  };
}
