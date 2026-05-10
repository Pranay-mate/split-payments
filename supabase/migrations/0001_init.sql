-- =====================================================================
-- 0001_init — EasySplits initial schema
-- =====================================================================
-- Applied automatically by the Supabase GitHub integration on push to
-- main, or manually via `supabase db push` when running the CLI locally.
--
-- Idempotent: every CREATE / ALTER guards with IF NOT EXISTS / DO block
-- so re-runs against an existing project are safe.
--
-- Mirrors src/lib/db/schema.ts (TypeScript / Drizzle). When you change
-- the schema, prefer adding a new migration file (e.g. 0002_*.sql) over
-- editing this one — keeps history replayable.
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


-- expense_items: line items inside one expense (itemized bill split)
CREATE TABLE IF NOT EXISTS expense_items (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  uuid          NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  description text          NOT NULL DEFAULT '',
  amount      numeric(14,2) NOT NULL,                    -- in expense's original currency
  sharer_ids  uuid[]        NOT NULL DEFAULT '{}'::uuid[],
  position    integer       NOT NULL DEFAULT 0,
  created_at  timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expense_items_expense_idx ON expense_items(expense_id);


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


-- personal_entries: Personal Finance Tracker (Phase 2.5).
-- v1.1 encrypts amount + description at the field level (AES-256-GCM,
-- key in PFT_ENCRYPTION_KEY env var). Postgres only ever sees base64
-- ciphertext. Other columns (type, category, currency, occurred_at)
-- stay plaintext — they're metadata, not value-sensitive, and we
-- need them for SQL-side filtering / GROUP BY.
CREATE TABLE IF NOT EXISTS personal_entries (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid          NOT NULL,
  type         text          NOT NULL,                          -- income | expense | investment
  amount       text          NOT NULL,                          -- encrypted (AES-256-GCM, base64)
  currency     varchar(3)    NOT NULL DEFAULT 'INR',
  category     text          NOT NULL DEFAULT 'other',          -- src/lib/categories.ts keys
  description  text          NOT NULL,                          -- encrypted (same scheme)
  occurred_at  timestamptz   NOT NULL DEFAULT now(),
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now(),
  deleted_at   timestamptz                                       -- soft delete; keep monthly comparisons stable
);
CREATE INDEX IF NOT EXISTS personal_entries_user_idx     ON personal_entries(user_id);
CREATE INDEX IF NOT EXISTS personal_entries_occurred_idx ON personal_entries(occurred_at);


-- financial_profiles: backs the 5-pillar Financial Health Scorecard (Phase 2.5 v3).
-- One row per user. Amount columns are encrypted at the application layer
-- (AES-256-GCM, same scheme as personal_entries). Demographic flags stay
-- plaintext — not value-sensitive, useful for future filtering.
CREATE TABLE IF NOT EXISTS financial_profiles (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL UNIQUE,
  age                  integer,
  retirement_age       integer,                     -- target retirement age; drives investing-pillar glide
  is_freelancer        boolean     NOT NULL DEFAULT false,
  has_dependents       boolean     NOT NULL DEFAULT false,
  has_cc_carryover     boolean     NOT NULL DEFAULT false,
  monthly_income       text,                        -- encrypted
  monthly_expenses     text,                        -- encrypted
  liquid_savings       text,                        -- encrypted
  term_cover_amount    text,                        -- encrypted
  health_cover_amount  text,                        -- encrypted
  total_emi            text,                        -- encrypted
  investment_balance   text,                        -- encrypted
  monthly_investment   text,                        -- encrypted
  completed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);


-- push_subscriptions: Web Push API subscription endpoints (one per device per user)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL,
  endpoint         text        NOT NULL UNIQUE,
  p256dh           text        NOT NULL,
  auth             text        NOT NULL,
  preferences      text        NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_notified_at timestamptz
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);


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

-- expense_items is new in this schema rev; CREATE TABLE above is idempotent.

-- v3.6: retirement_age added for the investing-pillar glide path.
ALTER TABLE financial_profiles
  ADD COLUMN IF NOT EXISTS retirement_age integer;

-- v4.0: score_snapshots — append-only history of the Financial Health Score.
-- Written on every profile.upsert(markCompleted=true). Drives trajectory
-- chart, monthly delta, and the streak badge.
CREATE TABLE IF NOT EXISTS score_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL,
  total           integer     NOT NULL,
  band            text        NOT NULL,
  pillar_scores   text        NOT NULL,                 -- JSON
  snapshotted_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS score_snapshots_user_idx    ON score_snapshots(user_id);
CREATE INDEX IF NOT EXISTS score_snapshots_user_at_idx ON score_snapshots(user_id, snapshotted_at);

-- v4.2: financial_goals — user-defined targets keyed to pillar/total scores.
-- See src/lib/db/schema.ts for the full design rationale (no encryption,
-- pillar 0..20 / total 0..100, completed_at flips on first >= target_score
-- crossing). current_value is snapshotted on profile.upsert(markCompleted=true)
-- so listing goals doesn't need to recompute the score.
CREATE TABLE IF NOT EXISTS financial_goals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL,
  goal_kind       text        NOT NULL,                 -- 'pillar' | 'total'
  pillar_key      text,                                  -- null when goal_kind='total'
  label           text        NOT NULL,
  target_score    integer     NOT NULL,
  target_date     timestamptz,
  current_value   integer     NOT NULL DEFAULT 0,
  completed_at    timestamptz,
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS financial_goals_user_idx        ON financial_goals(user_id);
CREATE INDEX IF NOT EXISTS financial_goals_user_active_idx ON financial_goals(user_id, archived_at);

-- v3.5.1: anomaly_mutes — per-(user, category) "Mute 30 days" overrides.
-- Both the in-app anomaly query and the cron pass filter out categories
-- with muted_until > now(). Re-muting bumps the existing row.
CREATE TABLE IF NOT EXISTS anomaly_mutes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL,
  category      text        NOT NULL,
  muted_until   timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS anomaly_mutes_user_category_uniq ON anomaly_mutes(user_id, category);
CREATE INDEX        IF NOT EXISTS anomaly_mutes_user_idx           ON anomaly_mutes(user_id);

-- v3.5.1: 2-alerts/month cap on anomaly pushes. Reset when month rolls over.
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS anomaly_count_this_month integer NOT NULL DEFAULT 0;
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS anomaly_count_month text NOT NULL DEFAULT '';

-- Profile editor (v1): user-level preferences. dob is text (YYYY-MM-DD)
-- so it round-trips cleanly through JSON without timezone confusion.
-- timezone defaults to Asia/Kolkata since this is an India-first app.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS dob text;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system';
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'INR';

-- Groups: user-driven archive state (separate from deletedAt = removed).
-- Archived groups still load on direct click; just hidden from the
-- default /app/groups list (collapsed under an expander).
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- v5.0: personal_recurrences — monthly recurring income/expenses/investments.
-- Daily cron picks rows with next_due_at <= now() AND paused_at IS NULL,
-- creates a matching personal_entries row, advances next_due_at by 1 month.
CREATE TABLE IF NOT EXISTS personal_recurrences (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL,
  type            text        NOT NULL,                 -- income | expense | investment
  amount          text        NOT NULL,                 -- AES-256-GCM encrypted
  description     text        NOT NULL,                 -- AES-256-GCM encrypted
  category        text        NOT NULL DEFAULT 'other',
  currency        varchar(3)  NOT NULL DEFAULT 'INR',
  schedule_day    integer     NOT NULL,                 -- 1..31; 29-31 fall back to last-day-of-month
  next_due_at     timestamptz NOT NULL,
  last_fired_at   timestamptz,
  paused_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS personal_recurrences_user_idx ON personal_recurrences(user_id);
CREATE INDEX IF NOT EXISTS personal_recurrences_due_idx  ON personal_recurrences(next_due_at);

-- v5.1: personal_holdings — investment positions powering /app/personal/wealth.
-- Encrypted: units, avg_cost, current_value, notes. Returns computed server-side.
-- archived_at = sold/closed; hidden from net worth.
CREATE TABLE IF NOT EXISTS personal_holdings (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL,
  name            text        NOT NULL,
  type            text        NOT NULL,                 -- mutual_fund | fd | stock | gold | bond | other
  units           text        NOT NULL,                 -- encrypted
  avg_cost        text        NOT NULL,                 -- encrypted (per unit, INR)
  current_value  text        NOT NULL,                 -- encrypted (total, INR)
  as_of           timestamptz NOT NULL,
  notes           text,                                  -- encrypted; nullable
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS personal_holdings_user_idx        ON personal_holdings(user_id);
CREATE INDEX IF NOT EXISTS personal_holdings_user_active_idx ON personal_holdings(user_id, archived_at);

-- Shareable wealth pages (opt-in). Regenerating the token invalidates
-- any old shared URLs. show_amounts defaults FALSE — public viewer only
-- sees ratios + type breakdown; rupee values are hidden until the user
-- explicitly opts in to revealing them.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS wealth_share_token text;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS wealth_share_show_amounts boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_wealth_share_token_uniq
  ON profiles(wealth_share_token)
  WHERE wealth_share_token IS NOT NULL;

-- Net-worth snapshots (Phase 2.5 v5.2). One row per user per calendar
-- day; UNIQUE (user_id, snapshot_date) so editing holdings multiple
-- times in a day collapses to a single point. snapshot_date is text
-- 'YYYY-MM-DD' to avoid pg `date` round-trip pain through tz-aware
-- Date objects in the app code. All amount columns are encrypted.
CREATE TABLE IF NOT EXISTS personal_net_worth_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  snapshot_date   text NOT NULL,
  total_value     text NOT NULL,                          -- encrypted
  liquid_savings  text NOT NULL,                          -- encrypted
  holdings_value  text NOT NULL,                          -- encrypted
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS personal_net_worth_user_idx
  ON personal_net_worth_snapshots(user_id, snapshot_date);
CREATE UNIQUE INDEX IF NOT EXISTS personal_net_worth_user_date_uniq
  ON personal_net_worth_snapshots(user_id, snapshot_date);
