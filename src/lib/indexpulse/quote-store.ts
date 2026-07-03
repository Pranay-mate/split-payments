/**
 * IndexPulse durable last-good quote store.
 * Persists successful (fresh) quotes to Postgres so a flaky Yahoo/AMFI fetch
 * can degrade to the previous price (flagged `stale: true`) instead of a blank.
 * Every DB access is wrapped in try/catch — these helpers NEVER throw, so the
 * pure-fetch resilience of the data layer is preserved even if the DB is down.
 */

import { inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { indexpulseQuotes } from "@/lib/db/schema";
import type { Quote } from "./types";

/** Persist the fresh quotes (batch upsert). Stale / null-price quotes skipped. */
export async function saveQuotes(quotes: Quote[]): Promise<void> {
  const fresh = quotes.filter((q) => !q.stale && q.price != null);
  if (fresh.length === 0) return;

  const rows = fresh.map((q) => ({
    key: q.key,
    price: q.price!.toString(),
    previousClose: q.previousClose != null ? q.previousClose.toString() : null,
    changePct: q.changePct != null ? q.changePct.toString() : null,
    asOf: q.asOf,
  }));

  try {
    await db
      .insert(indexpulseQuotes)
      .values(rows)
      .onConflictDoUpdate({
        target: indexpulseQuotes.key,
        set: {
          price: sql`excluded.price`,
          previousClose: sql`excluded.previous_close`,
          changePct: sql`excluded.change_pct`,
          asOf: sql`excluded.as_of`,
          updatedAt: sql`now()`,
        },
      });
  } catch (err) {
    console.error("[indexpulse] saveQuotes failed:", err);
  }
}

/**
 * For any stale / null-price quote, substitute the last-good persisted row
 * (kept flagged `stale: true` — it's fallback data). Fresh quotes pass through
 * untouched. On any DB error, returns the input unchanged.
 */
export async function withFallback(quotes: Quote[]): Promise<Quote[]> {
  const staleKeys = quotes
    .filter((q) => q.stale || q.price == null)
    .map((q) => q.key);
  if (staleKeys.length === 0) return quotes;

  try {
    const rows = await db
      .select()
      .from(indexpulseQuotes)
      .where(inArray(indexpulseQuotes.key, staleKeys));

    const byKey = new Map(rows.map((r) => [r.key, r]));

    return quotes.map((q) => {
      if (!q.stale && q.price != null) return q;
      const row = byKey.get(q.key);
      if (!row || row.price == null) return q;
      return {
        key: q.key,
        price: Number(row.price),
        previousClose: row.previousClose != null ? Number(row.previousClose) : null,
        changePct: row.changePct != null ? Number(row.changePct) : null,
        asOf: row.asOf,
        stale: true,
      };
    });
  } catch (err) {
    console.error("[indexpulse] withFallback failed:", err);
    return quotes;
  }
}
