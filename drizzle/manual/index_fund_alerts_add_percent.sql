-- IndexPulse v2: add percent-mode alert columns to an EXISTING table.
-- Apply via Supabase → SQL Editor → Run. Idempotent.

ALTER TABLE index_fund_alerts
  ADD COLUMN IF NOT EXISTS mode       text NOT NULL DEFAULT 'amount',
  ADD COLUMN IF NOT EXISTS base_price numeric(14, 4);
