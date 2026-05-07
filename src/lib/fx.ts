/**
 * Free FX rates from open.er-api.com (no API key required).
 * Cached in-memory for 6 hours per base currency.
 *
 * Works both client and server — `fetch` + `Map` are universal.
 */

const cache = new Map<string, { rates: Record<string, number>; at: number }>();
const TTL_MS = 6 * 60 * 60 * 1000;

export const COMMON_CURRENCIES = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "SGD",
  "AUD",
  "JPY",
  "CAD",
  "CHF",
  "THB",
  "MYR",
] as const;

export async function fetchRates(base: string): Promise<Record<string, number>> {
  const upper = base.toUpperCase();
  const hit = cache.get(upper);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rates;

  const res = await fetch(`https://open.er-api.com/v6/latest/${upper}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`FX fetch failed (${res.status})`);
  }
  const data: { result?: string; rates?: Record<string, number> } = await res.json();
  if (data.result !== "success" || !data.rates) {
    throw new Error("FX response invalid");
  }

  cache.set(upper, { rates: data.rates, at: Date.now() });
  return data.rates;
}

/** Returns the rate to multiply `from` amount by to get `to` amount. */
export async function getRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const rates = await fetchRates(from);
  const r = rates[to.toUpperCase()];
  if (!r || !Number.isFinite(r)) {
    throw new Error(`No FX rate available for ${from} → ${to}`);
  }
  return r;
}

/** Sanity check — server-side uses this to validate client-supplied rates. */
export function isReasonableRate(rate: number): boolean {
  return Number.isFinite(rate) && rate > 0 && rate < 100_000;
}
