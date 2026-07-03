/**
 * IndexPulse quote orchestrator.
 * Merges the static ETF catalog with AMFI index funds and serves current
 * quotes, backed by simple module-level in-memory caches (AMFI 30 min, Yahoo
 * 2 min). Fully resilient: source outages degrade to stale quotes, never throw.
 */

import { ETF_CATALOG } from "./catalog";
import { fetchAmfiIndexFunds } from "./amfi";
import { fetchYahooQuotes } from "./yahoo";
import type { Instrument, Quote } from "./types";

const AMFI_TTL_MS = 30 * 60 * 1000; // 30 minutes
const YAHOO_TTL_MS = 2 * 60 * 1000; // 2 minutes

type AmfiCache = {
  at: number;
  instruments: Instrument[];
  quotes: Map<string, Quote>;
};

type YahooCache = {
  at: number;
  quotes: Map<string, Quote>;
};

let amfiCache: AmfiCache | null = null;
let yahooCache: YahooCache | null = null;

/** Load AMFI index funds, using the cached copy while it is fresh. */
async function getAmfi(): Promise<AmfiCache> {
  const now = Date.now();
  if (amfiCache && now - amfiCache.at < AMFI_TTL_MS) return amfiCache;

  const { instruments, quotes } = await fetchAmfiIndexFunds();
  // Only replace a previously-good cache if we actually got data, so a
  // transient AMFI outage doesn't blow away known instruments.
  if (instruments.length === 0 && amfiCache) return amfiCache;

  amfiCache = { at: now, instruments, quotes };
  return amfiCache;
}

/** Load all ETF quotes from Yahoo, using the cached copy while it is fresh. */
async function getAllEtfQuotes(): Promise<Map<string, Quote>> {
  const now = Date.now();
  if (yahooCache && now - yahooCache.at < YAHOO_TTL_MS) return yahooCache.quotes;

  const symbols = ETF_CATALOG.map((i) => i.symbol);
  const quotes = await fetchYahooQuotes(symbols);
  yahooCache = { at: now, quotes };
  return quotes;
}

export async function getCatalog(): Promise<Instrument[]> {
  const amfi = await getAmfi();
  return [...ETF_CATALOG, ...amfi.instruments];
}

/** Fallback stale quote for any key we can't resolve. */
function staleFor(key: string): Quote {
  return {
    key,
    price: null,
    previousClose: null,
    changePct: null,
    asOf: null,
    stale: true,
  };
}

export async function getQuotes(keys?: string[]): Promise<Quote[]> {
  // When keys are given, derive the source split from them directly — do
  // NOT resolve the full catalog, since that would fetch AMFI even for an
  // ETF-only request (e.g. the 30-min market-hours alert cron). Only build
  // the catalog when the caller omits keys (the full dashboard listing).
  const requested =
    keys && keys.length > 0
      ? keys
      : (await getCatalog()).map((i) => i.key);

  const wantEtf = requested.some((k) => k.startsWith("etf:"));
  const wantMf = requested.some((k) => k.startsWith("mf:"));

  const [etfQuotes, amfi] = await Promise.all([
    wantEtf ? getAllEtfQuotes() : Promise.resolve(new Map<string, Quote>()),
    wantMf ? getAmfi() : Promise.resolve<AmfiCache>({ at: 0, instruments: [], quotes: new Map() }),
  ]);

  const out: Quote[] = [];
  for (const key of requested) {
    if (key.startsWith("etf:")) {
      out.push(etfQuotes.get(key) ?? staleFor(key));
    } else if (key.startsWith("mf:")) {
      out.push(amfi.quotes.get(key) ?? staleFor(key));
    } else {
      out.push(staleFor(key));
    }
  }
  return out;
}
