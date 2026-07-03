/**
 * IndexPulse core types.
 * Shared shapes for India-listed index instruments (ETFs + index mutual funds)
 * and their current price/NAV quotes. Consumed by the AMFI, Yahoo, and quotes
 * orchestrator modules.
 */

export type InstrumentType = "etf" | "mf";

export type Instrument = {
  key: string; // stable id: "etf:NIFTYBEES" or "mf:120716"
  type: InstrumentType;
  name: string; // display name
  symbol: string; // Yahoo symbol (ETF, WITHOUT .NS suffix, e.g. "NIFTYBEES") or AMFI scheme code (MF, e.g. "120716")
  category: string; // e.g. "Nifty 50", "Nifty Next 50", "Gold", "Sensex", "International", "Sectoral", "Index Fund"
};

export type Quote = {
  key: string;
  price: number | null; // current price (ETF) or latest NAV (MF), INR
  previousClose: number | null; // prior close (ETF); for MF may be null
  changePct: number | null; // % change vs previousClose; null if unknown
  asOf: string | null; // ISO date/datetime string
  stale: boolean; // true if the fetch failed / data unavailable
};
