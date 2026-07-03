/**
 * AMFI daily NAV loader for IndexPulse.
 * Fetches AMFI India's free NAVAll.txt dump and extracts Direct-Growth index
 * mutual-fund plans (Nifty / Sensex / index trackers), turning each into an
 * Instrument + latest-NAV Quote. Resilient: any failure yields empty results.
 */

import type { Instrument, Quote } from "./types";

// AMFI moved this file to the portal subdomain; the old www URL now
// 302-redirects here. Point at the canonical location directly so we
// don't depend on redirect-following (and never parse the 302 HTML body).
const NAV_ALL_URL = "https://portal.amfiindia.com/spages/NAVAll.txt";
const FETCH_TIMEOUT_MS = 10_000;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/** Parse an AMFI "dd-Mon-yyyy" date into an ISO date string; fall back to raw. */
function parseAmfiDate(raw: string): string {
  const trimmed = raw.trim();
  const m = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return trimmed;
  const day = m[1].padStart(2, "0");
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return trimmed;
  return `${m[3]}-${mon}-${day}`;
}

/** Classify an index-fund scheme name into an IndexPulse category. */
function categoryForName(name: string): string {
  if (/sensex/i.test(name)) return "Sensex";
  if (/next 50/i.test(name)) return "Nifty Next 50";
  if (/nifty 50/i.test(name)) return "Nifty 50";
  return "Index Fund";
}

export async function fetchAmfiIndexFunds(): Promise<{
  instruments: Instrument[];
  quotes: Map<string, Quote>;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(NAV_ALL_URL, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/plain,*/*",
      },
    });

    if (!res.ok) {
      console.error(`AMFI fetch failed: HTTP ${res.status}`);
      return { instruments: [], quotes: new Map() };
    }

    const text = await res.text();
    const instruments: Instrument[] = [];
    const quotes = new Map<string, Quote>();
    const seen = new Set<string>();

    for (const line of text.split(/\r?\n/)) {
      // Skip blanks and AMC section headers (lines without ";").
      if (!line || !line.includes(";")) continue;

      const parts = line.split(";");
      if (parts.length < 6) continue;

      const schemeCode = parts[0].trim();
      // Skip the column header row and any non-numeric scheme codes.
      if (!/^\d+$/.test(schemeCode)) continue;
      if (seen.has(schemeCode)) continue;

      const name = parts[3].trim();
      // Isolate Direct-Growth index-fund plans.
      if (!/index|nifty|sensex/i.test(name)) continue;
      if (!/direct/i.test(name)) continue;
      if (!/growth/i.test(name)) continue;

      seen.add(schemeCode);

      const navRaw = parts[4].trim();
      const nav = Number.parseFloat(navRaw);
      const price = Number.isFinite(nav) ? nav : null;
      const asOf = parseAmfiDate(parts[5] ?? "");
      const key = "mf:" + schemeCode;

      instruments.push({
        key,
        type: "mf",
        name,
        symbol: schemeCode,
        category: categoryForName(name),
      });

      quotes.set(key, {
        key,
        price,
        previousClose: null,
        changePct: null,
        asOf: asOf || null,
        stale: price === null,
      });
    }

    return { instruments, quotes };
  } catch (err) {
    console.error("AMFI fetch error:", err);
    return { instruments: [], quotes: new Map() };
  } finally {
    clearTimeout(timer);
  }
}
