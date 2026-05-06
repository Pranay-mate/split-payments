export type RoundingMode = "none" | "10" | "50" | "100";

export type SplitBillInput = {
  /** Pre-tip, pre-extras bill amount in rupees. */
  billAmount: number;
  /** Number of people splitting. Must be ≥ 1. */
  numPeople: number;
  /** Tip percentage (0–100). */
  tipPercent: number;
  /** Extra service charge percent (some restaurants pre-add this; user can include or not). */
  extraServiceChargePercent: number;
  /** Round each person's share up to nearest unit. */
  rounding: RoundingMode;
};

export type SplitBillResult = {
  /** Bill before tip + service charge. */
  baseAmount: number;
  /** Tip in rupees. */
  tipAmount: number;
  /** Extra service charge in rupees. */
  serviceCharge: number;
  /** Final total to pay (base + tip + service). */
  grandTotal: number;
  /** Raw per-person share (no rounding applied). */
  rawPerPerson: number;
  /** Per-person share after rounding (each person pays this). */
  perPerson: number;
  /**
   * Sum across all people minus the actual grand total.
   * If positive, the group pays a tiny excess (rounded up).
   */
  roundingExcess: number;
};

const ROUNDING_UNITS: Record<RoundingMode, number> = {
  none: 0,
  "10": 10,
  "50": 50,
  "100": 100,
};

export function calculateSplitBill(input: SplitBillInput): SplitBillResult {
  const billAmount = Math.max(0, input.billAmount);
  const numPeople = Math.max(1, Math.floor(input.numPeople));
  const tip = Math.max(0, input.tipPercent) / 100;
  const service = Math.max(0, input.extraServiceChargePercent) / 100;

  const tipAmount = billAmount * tip;
  const serviceCharge = billAmount * service;
  const grandTotal = billAmount + tipAmount + serviceCharge;
  const rawPerPerson = grandTotal / numPeople;

  const unit = ROUNDING_UNITS[input.rounding];
  const perPerson =
    unit > 0 ? Math.ceil(rawPerPerson / unit) * unit : rawPerPerson;
  const roundingExcess = perPerson * numPeople - grandTotal;

  return {
    baseAmount: billAmount,
    tipAmount,
    serviceCharge,
    grandTotal,
    rawPerPerson,
    perPerson,
    roundingExcess,
  };
}
