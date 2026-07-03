-- IndexPulse: price alerts table (admin-only feature).
-- Apply via Supabase → SQL Editor → New query → paste → Run (Run without RLS),
-- per SETUP.md (drizzle-kit db:push is broken against Supabase CHECK constraints).
-- Mirrors `indexFundAlerts` in src/lib/db/schema.ts.

CREATE TABLE IF NOT EXISTS index_fund_alerts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL,
  instrument_key    text NOT NULL,
  instrument_type   text NOT NULL,
  name              text NOT NULL,
  symbol            text NOT NULL,
  condition         text NOT NULL,
  threshold         numeric(14, 4) NOT NULL,
  channels          text NOT NULL DEFAULT '["in_app"]',
  enabled           boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  last_value        numeric(14, 4),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS index_fund_alerts_user_idx
  ON index_fund_alerts (user_id);
