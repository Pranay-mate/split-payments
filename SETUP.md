# EasySplits — Local Setup

You already added the 3 public Supabase env vars to Vercel. To run the app locally + apply database migrations, you also need them in `.env.local`.

## Step 1 — create `.env.local`

In the project root (`learning/split-payments/`), create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres.xxxxx:YOUR_NEW_DB_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

`.env.local` is gitignored — it never leaves your machine.

### Where to get each value

In your Supabase project dashboard:

| Variable | Where to find |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → Project API keys → **anon public** |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → Project API keys → **service_role** (click "Reveal") |
| `DATABASE_URL` | Settings → Database → Connection string → **URI** (use the **Pooler / Transaction** mode URL, replace `[YOUR-PASSWORD]` with your DB password) |

The DB password is the one you reset earlier — never paste it in chat.

## Step 2 — apply schema to Supabase

> ⚠ **Drizzle-kit `pnpm db:push` is broken against Supabase** as of 0.31.x.
> The introspection step throws `TypeError: Cannot read properties of undefined (reading 'replace')`
> on certain CHECK constraints. Versions 0.31.7, 0.31.10 confirmed broken.
>
> **Workaround:** apply schema changes via the **Supabase SQL Editor** instead.
> When schema.ts changes, ask for the equivalent SQL — paste + Run.
>
> Initial schema for a fresh project is in `drizzle/migrations/` (if generated) or
> can be derived from `src/lib/db/schema.ts`.

### Supabase SQL Editor flow (reliable)

1. Open Supabase dashboard → **SQL Editor** → New query
2. Paste the SQL provided in the relevant commit / chat
3. Click **Run** — choose **"Run without RLS"** to match the rest of the schema
4. Done

### Drizzle-kit flow (currently broken)

```bash
pnpm db:push    # ❌ fails on Supabase CHECK constraints
pnpm db:generate # ❌ also introspects, same failure
pnpm db:studio   # may work for browsing
```

If the bug ever gets fixed upstream, restore the standard flow.

## Step 3 — enable Google OAuth in Supabase

1. Supabase dashboard → **Authentication → Providers → Google**
2. Toggle on
3. Get a Google Client ID + Secret from https://console.cloud.google.com → APIs → Credentials → "Create OAuth 2.0 Client ID"
4. Authorised redirect URIs: paste the URL Supabase shows (`https://xxxxx.supabase.co/auth/v1/callback`)
5. Save Client ID + Secret in Supabase

## Step 4 — start the dev server

```bash
pnpm dev
```

Visit `http://localhost:3000`. You should see the site as before, plus once you sign in the (still-to-be-built) `/app/...` pages will work.

## Useful commands

```bash
pnpm test           # vitest
pnpm test:watch     # vitest --watch
pnpm lint
pnpm build
pnpm db:push        # apply schema to Supabase
pnpm db:studio      # open Drizzle Studio (visual DB explorer)
```

## Where data lives

- **Trip Splitter / Bill Splitter (public tools):** browser localStorage only — no DB
- **Authenticated app (groups, expenses):** Supabase Postgres in Mumbai region
- **Offline mutation queue (Phase 1.E proper):** IndexedDB (not yet built)
