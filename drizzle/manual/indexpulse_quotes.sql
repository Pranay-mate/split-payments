-- IndexPulse: durable last-good quote cache. Apply via Supabase SQL Editor.
-- Backs the persist-last-good fallback in src/lib/indexpulse/quote-store.ts.

CREATE TABLE IF NOT EXISTS indexpulse_quotes (
  key            text PRIMARY KEY,          -- "etf:NIFTYBEES" | "mf:120716"
  price          numeric(14, 4),
  previous_close numeric(14, 4),
  change_pct     numeric(10, 4),
  as_of          text,                      -- ISO date/datetime from the source
  updated_at     timestamptz NOT NULL DEFAULT now()
);
