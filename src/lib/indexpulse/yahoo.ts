/**
 * Yahoo Finance quote loader for IndexPulse ETFs.
 * Uses the free (unofficial) v7 quote endpoint, falling back to the v8 chart
 * endpoint per-symbol when v7 is gated. NSE symbols get a ".NS" suffix. Never
 * throws: missing / failed symbols come back as stale quotes.
 */

import type { Quote } from "./types";

const FETCH_TIMEOUT_MS = 10_000;
const BATCH_SIZE = 40;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Build a stale placeholder quote for a symbol we could not resolve. */
function staleQuote(symbol: string): Quote {
  return {
    key: "etf:" + symbol,
    price: null,
    previousClose: null,
    changePct: null,
    asOf: null,
    stale: true,
  };
}

/** Compute % change vs previous close when both values are present. */
function pctChange(price: number | null, prev: number | null): number | null {
  if (price === null || prev === null || prev === 0) return null;
  return ((price - prev) / prev) * 100;
}

/** ISO string from Yahoo epoch-seconds timestamp, or null. */
function isoFromEpoch(seconds: unknown): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

/** Split an array into chunks of at most `size`. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Fetch a batch via the v7 quote endpoint. Returns null on any failure. */
async function fetchV7Batch(symbols: string[]): Promise<Map<string, Quote> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const query = symbols.map((s) => `${s}.NS`).join(",");
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
    });

    if (!res.ok) return null; // 401 etc. → signal caller to fall back.

    const json = (await res.json()) as {
      quoteResponse?: { result?: unknown[] };
    };
    const results = json?.quoteResponse?.result ?? [];
    if (!Array.isArray(results) || results.length === 0) return null;

    const out = new Map<string, Quote>();
    for (const raw of results) {
      const r = (raw ?? {}) as Record<string, unknown>;
      const rawSym = typeof r.symbol === "string" ? r.symbol : "";
      const symbol = rawSym.replace(/\.NS$/i, "");
      if (!symbol) continue;
      const price =
        typeof r.regularMarketPrice === "number" ? r.regularMarketPrice : null;
      const prev =
        typeof r.regularMarketPreviousClose === "number"
          ? r.regularMarketPreviousClose
          : null;
      out.set("etf:" + symbol, {
        key: "etf:" + symbol,
        price,
        previousClose: prev,
        changePct: pctChange(price, prev),
        asOf: isoFromEpoch(r.regularMarketTime),
        stale: price === null,
      });
    }
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch a single symbol via the v8 chart endpoint. */
async function fetchV8Single(symbol: string): Promise<Quote> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol + ".NS",
    )}?range=5d&interval=1d`;
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
    });
    if (!res.ok) return staleQuote(symbol);

    const json = (await res.json()) as {
      chart?: { result?: Array<{ meta?: Record<string, unknown> }> };
    };
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return staleQuote(symbol);

    const price =
      typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : null;
    const prev =
      typeof meta.chartPreviousClose === "number"
        ? meta.chartPreviousClose
        : typeof meta.previousClose === "number"
          ? meta.previousClose
          : null;
    return {
      key: "etf:" + symbol,
      price,
      previousClose: prev,
      changePct: pctChange(price, prev),
      asOf: isoFromEpoch(meta.regularMarketTime),
      stale: price === null,
    };
  } catch {
    return staleQuote(symbol);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchYahooQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  if (unique.length === 0) return out;

  for (const batch of chunk(unique, BATCH_SIZE)) {
    const v7 = await fetchV7Batch(batch);

    if (v7) {
      for (const symbol of batch) {
        out.set("etf:" + symbol, v7.get("etf:" + symbol) ?? staleQuote(symbol));
      }
      continue;
    }

    // v7 gated/empty → fall back to per-symbol v8 chart.
    const settled = await Promise.all(batch.map((s) => fetchV8Single(s)));
    settled.forEach((q, i) => {
      out.set("etf:" + batch[i], q ?? staleQuote(batch[i]));
    });
  }

  return out;
}
