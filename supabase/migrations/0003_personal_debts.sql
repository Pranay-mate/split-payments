-- Phase 2.5 v5.2 — personal_debts table.
-- Tracks user loans (home/car/personal/education/credit_card/other) so the
-- /wealth net-worth math can subtract liabilities + project them decaying
-- over time. Amortisation is computed on-the-fly server- and client-side
-- (see src/lib/amortise.ts); we store only the snapshot inputs.

CREATE TABLE IF NOT EXISTS public.personal_debts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  name            text NOT NULL,
  debt_type       text NOT NULL DEFAULT 'other',
  -- Encrypted (AES-256-GCM base64). Same scheme as personal_entries.amount.
  principal       text NOT NULL,
  emi             text NOT NULL,
  -- Plaintext numeric — rates aren't sensitive and storing as number lets
  -- the UI sort/filter without decrypting.
  annual_rate_pct numeric(5, 2) NOT NULL,
  start_date      timestamptz NOT NULL DEFAULT now(),
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS personal_debts_user_idx
  ON public.personal_debts (user_id);

CREATE INDEX IF NOT EXISTS personal_debts_user_active_idx
  ON public.personal_debts (user_id, archived_at);

-- RLS stays OFF — we connect via service role and gate access in tRPC.
-- Mirrors the rest of the public.* tables (see 0002_disable_rls.sql).
ALTER TABLE public.personal_debts DISABLE ROW LEVEL SECURITY;
