-- =====================================================================
-- EasySplits — full database schema
-- =====================================================================
-- Run in Supabase SQL Editor → "Run without RLS" (matches the rest of
-- our auth model: server-side queries via Drizzle bypass RLS).
--
-- Idempotent: safe to re-run. Uses IF NOT EXISTS / DO blocks so existing
-- objects aren't recreated.
--
-- Mirrors src/lib/db/schema.ts. Source of truth: that file. This SQL is
-- here because drizzle-kit's introspection step is broken on Supabase
-- (https://github.com/drizzle-team/drizzle-orm/issues — see SETUP.md).
-- =====================================================================

-- 1. ENUMS ------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE split_mode AS ENUM ('equal', 'exact', 'share', 'percent');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- 2. TABLES -----------------------------------------------------------

-- profiles: extends Supabase auth.users with display name + avatar
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid        PRIMARY KEY,
  display_name text        NOT NULL,
  avatar_url   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);


-- groups: a shared expense group (trip, household, etc.)
CREATE TABLE IF NOT EXISTS groups (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  primary_currency varchar(3)  NOT NULL DEFAULT 'INR',
  invite_token     text        NOT NULL UNIQUE
                                DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by       uuid        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE INDEX IF NOT EXISTS groups_created_by_idx   ON groups(created_by);
CREATE INDEX IF NOT EXISTS groups_invite_token_idx ON groups(invite_token);


-- group_members: junction (which users belong to which group)
CREATE TABLE IF NOT EXISTS group_members (
  group_id  uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   uuid        NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_members_pk UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS group_members_user_idx ON group_members(user_id);


-- expenses: one expense within a group
CREATE TABLE IF NOT EXISTS expenses (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         uuid          NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description      text          NOT NULL DEFAULT '',
  amount           numeric(14,2) NOT NULL,                  -- in original currency
  currency         varchar(3)    NOT NULL,
  converted_amount numeric(14,2) NOT NULL,                  -- in group's primary currency
  fx_rate          numeric(18,8) NOT NULL,                  -- amount * fx_rate = converted_amount
  payer_id         uuid          NOT NULL,
  split_mode       split_mode    NOT NULL DEFAULT 'equal',
  category         text          NOT NULL DEFAULT 'other',
  occurred_at      timestamptz   NOT NULL DEFAULT now(),
  created_by       uuid          NOT NULL,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_group_idx ON expenses(group_id);
CREATE INDEX IF NOT EXISTS expenses_payer_idx ON expenses(payer_id);


-- expense_splits: per-person share (in primary currency) for an expense
CREATE TABLE IF NOT EXISTS expense_splits (
  expense_id uuid          NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id    uuid          NOT NULL,
  amount     numeric(14,2) NOT NULL,
  CONSTRAINT expense_splits_pk UNIQUE (expense_id, user_id)
);
CREATE INDEX IF NOT EXISTS expense_splits_user_idx ON expense_splits(user_id);


-- expense_comments: thread-style comments on an expense
CREATE TABLE IF NOT EXISTS expense_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid        NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL,
  body       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expense_comments_expense_idx ON expense_comments(expense_id);


-- settlements: recorded payment from one member to another
CREATE TABLE IF NOT EXISTS settlements (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid          NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_user_id uuid          NOT NULL,
  to_user_id   uuid          NOT NULL,
  amount       numeric(14,2) NOT NULL,                       -- in primary currency
  note         text                   DEFAULT '',
  occurred_at  timestamptz   NOT NULL DEFAULT now(),
  created_at   timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS settlements_group_idx ON settlements(group_id);
CREATE INDEX IF NOT EXISTS settlements_from_idx  ON settlements(from_user_id);
CREATE INDEX IF NOT EXISTS settlements_to_idx    ON settlements(to_user_id);


-- claim_tokens: single-use token that lets a real auth user claim a shadow
-- profile's history. Token is shared out-of-band by the group creator.
CREATE TABLE IF NOT EXISTS claim_tokens (
  token             text        PRIMARY KEY,
  shadow_profile_id uuid        NOT NULL,
  group_id          uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by        uuid        NOT NULL,
  expires_at        timestamptz NOT NULL,
  used_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS claim_tokens_shadow_idx ON claim_tokens(shadow_profile_id);
CREATE INDEX IF NOT EXISTS claim_tokens_group_idx  ON claim_tokens(group_id);


-- events: append-only audit log (also drives offline replay + per-expense history)
CREATE TABLE IF NOT EXISTS events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid                 REFERENCES groups(id) ON DELETE CASCADE,
  expense_id      uuid,                                       -- foreign-keyless on purpose: survives expense deletion
  event_type      text        NOT NULL,
  actor_id        uuid        NOT NULL,
  payload         text        NOT NULL,                       -- JSON-encoded snapshot
  client_event_id uuid                 UNIQUE,                -- idempotent retries
  occurred_at     timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_group_idx    ON events(group_id);
CREATE INDEX IF NOT EXISTS events_actor_idx    ON events(actor_id);
CREATE INDEX IF NOT EXISTS events_occurred_idx ON events(occurred_at);
CREATE INDEX IF NOT EXISTS events_expense_idx  ON events(expense_id);


-- =====================================================================
-- DEFENSIVE ALTERS — for projects that ran an earlier version of this
-- schema and need to catch up. Idempotent.
-- =====================================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS expense_id uuid;
CREATE INDEX IF NOT EXISTS events_expense_idx ON events(expense_id);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS claimed_by uuid;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other';
