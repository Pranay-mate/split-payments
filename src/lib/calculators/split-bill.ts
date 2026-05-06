export type SplitBillInput = {
  /** Bill amount in rupees. */
  billAmount: number;
  /** Number of people splitting. Must be ≥ 1. */
  numPeople: number;
  /** Optional tip in rupees. Defaults to 0. */
  tipAmount?: number;
};

export type SplitBillResult = {
  baseAmount: number;
  tipAmount: number;
  grandTotal: number;
  /** Raw per-person share before rounding. */
  rawPerPerson: number;
  /** Per-person share, rounded up to the nearest rupee. */
  perPerson: number;
  /** Excess collected from rounding up to whole rupees. */
  roundingExcess: number;
};

/**
 * Splits a bill (with optional tip) equally between people. Each person's
 * share is always rounded up to the nearest whole rupee — small excess goes
 * toward tip rounding / one person can pay slightly less to balance.
 */
export function calculateSplitBill(input: SplitBillInput): SplitBillResult {
  const billAmount = Math.max(0, input.billAmount);
  const numPeople = Math.max(1, Math.floor(input.numPeople));
  const tipAmount = Math.max(0, input.tipAmount ?? 0);

  const grandTotal = billAmount + tipAmount;
  const rawPerPerson = grandTotal / numPeople;
  const perPerson = Math.ceil(rawPerPerson);
  const roundingExcess = perPerson * numPeople - grandTotal;

  return {
    baseAmount: billAmount,
    tipAmount,
    grandTotal,
    rawPerPerson,
    perPerson,
    roundingExcess,
  };
}
