/**
 * Per-user split computation for itemized bills. Single source of truth —
 * imported by both the server (expenses router) and the client (AddExpense
 * form's optimistic UI), so they can't drift.
 *
 * Each item is divided equally among its sharers; per-user totals are the
 * sum of their share across every item they're on. The 2-decimal rounding
 * residual gets pushed onto the highest-share user so per-user totals
 * still sum to the items' sum (within 1 paisa).
 */

export type ItemForSplit = {
  amount: number;
  sharerIds: string[];
};

export type UserSplit = {
  userId: string;
  amount: number;
};

export function splitsFromItems(items: ItemForSplit[]): UserSplit[] {
  // Only items with at least one sharer contribute. Items with empty
  // sharers are dropped entirely — they don't go into the residual either,
  // since there's no one to assign their amount to.
  const contributing = items.filter((i) => i.sharerIds.length > 0);

  const perUser = new Map<string, number>();
  for (const item of contributing) {
    const per = item.amount / item.sharerIds.length;
    for (const id of item.sharerIds) {
      perUser.set(id, (perUser.get(id) ?? 0) + per);
    }
  }
  const out: UserSplit[] = Array.from(perUser.entries()).map(
    ([userId, amount]) => ({
      userId,
      amount: Math.round(amount * 100) / 100,
    }),
  );

  // Penny-residual: if rounding to 2dp made the sum drift from the items'
  // raw total by ≥1 paisa, push the delta onto whoever has the largest
  // share. Keeps the invariant "sum(splits) === sum(items)" within 1 paisa.
  const itemTotal = contributing.reduce((s, i) => s + i.amount, 0);
  const splitTotal = out.reduce((s, x) => s + x.amount, 0);
  const delta = Math.round((itemTotal - splitTotal) * 100) / 100;
  if (Math.abs(delta) >= 0.01 && out.length > 0) {
    const biggest = out.reduce(
      (best, cur) => (cur.amount > best.amount ? cur : best),
      out[0],
    );
    biggest.amount = Math.round((biggest.amount + delta) * 100) / 100;
  }
  return out;
}
