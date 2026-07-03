# IndexPulse

Admin-only index-fund & ETF price tracker with alerts, built into the EasySplits app.

## 1. Overview

**IndexPulse** is an admin-only tab inside the authenticated EasySplits app that lists
Indian **index mutual funds** and **ETFs** with live price / NAV, and lets the admin
configure **price alerts** (fires when price goes *above* or *below* a threshold).
Alerts are delivered via **in-app toast**, **Web Push**, and/or **email**.

- **Where it lives:** `/app/indexpulse` (inside the authenticated `(authed)` route group).
- **Why admin-only for now:** it's an internal/experimental tool. It's gated by the
  existing `adminProcedure`, which checks the caller's Supabase user id against the
  `ADMIN_USER_IDS` env allow-list. Non-admins never see the tab and the tRPC calls 403.
- **What it reuses:** Supabase auth, `adminProcedure` gating, the existing Web Push
  pipeline (VAPID keys + `push_subscriptions` table + service worker), and the existing
  cron pattern (routes protected by `CRON_SECRET`). Nothing new in the auth/push stack.

The only genuinely new pieces are: one Drizzle table, one tRPC router, the UI route,
one cron route, and an optional Resend email integration.

## 2. Architecture

```
                        ┌───────────────────────────────────────────┐
   Data catalog         │  src/lib/indexpulse/                       │
   ──────────────       │   ├─ amfi.ts    (parse NAVAll.txt → MFs)   │
   AMFI NAVAll.txt ───▶ │   ├─ yahoo.ts   (quote API → ETFs, cached) │
   Yahoo quote API  ───▶│   └─ catalog.ts (merge + normalize rows)   │
                        └────────────────────┬──────────────────────┘
                                             │
                        ┌────────────────────▼──────────────────────┐
                        │  src/server/routers/indexpulse.ts          │
                        │  (adminProcedure on every proc)            │
                        │   • list()          → catalog rows + price │
                        │   • listAlerts()    → this admin's alerts  │
                        │   • upsertAlert()   → create/update alert  │
                        │   • deleteAlert()                          │
                        └───────┬───────────────────────┬───────────┘
                                │                        │
                    ┌───────────▼─────────┐   writes/reads
                    │  UI (App Router)    │   ┌───────────▼───────────┐
                    │  indexpulse/        │   │  index_fund_alerts     │
                    │   ├─ page.tsx (tbl) │   │  (Drizzle / Postgres)  │
                    │   └─ AlertModal.tsx │   └───────────┬───────────┘
                    └─────────────────────┘               │
                                                           │ read active alerts
                        ┌──────────────────────────────────▼──────────┐
   Scheduler ─────────▶│  src/app/api/cron/indexpulse-alerts/route.ts │
   (Vercel Cron /      │   1. fetch fresh prices (catalog)            │
    GitHub Actions)    │   2. evaluate each alert vs threshold        │
   Bearer CRON_SECRET  │   3. on match → Web Push + email + mark sent │
                        └──────────────────────┬───────────────────────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          ▼                    ▼                     ▼
                    Web Push             Resend email          in-app toast
                 (push_subscriptions)  (REST, if key set)   (client polls list)
```

### Key files

| Path | Purpose |
|------|---------|
| `src/lib/indexpulse/amfi.ts` | Fetch + parse AMFI `NAVAll.txt` into index-MF rows |
| `src/lib/indexpulse/yahoo.ts` | Fetch ETF quotes from Yahoo (`.NS`), with in-memory/edge cache |
| `src/lib/indexpulse/catalog.ts` | Merge AMFI + Yahoo into a single normalized instrument list |
| `src/server/routers/indexpulse.ts` | tRPC router — all procs wrapped in `adminProcedure` |
| `src/app/app/(authed)/indexpulse/page.tsx` | The table UI (prices, staleness, alert buttons) |
| `src/app/app/(authed)/indexpulse/AlertModal.tsx` | Create/edit alert (instrument, above/below, threshold, channels) |
| `src/app/api/cron/indexpulse-alerts/route.ts` | Cron endpoint that evaluates + dispatches alerts |
| `index_fund_alerts` (Drizzle schema) | Alert rows keyed by admin user id |

### `index_fund_alerts` (shape)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid / serial | PK |
| `user_id` | uuid | Supabase user id (must be an admin) |
| `instrument_id` | text | AMFI scheme code or Yahoo symbol |
| `instrument_type` | text | `mf` \| `etf` |
| `condition` | text | `above` \| `below` |
| `threshold` | numeric | price/NAV to compare against |
| `channels` | jsonb / text[] | any of `toast`, `push`, `email` |
| `active` | boolean | disabled after firing (or user toggles) |
| `last_triggered_at` | timestamptz | null until first fire; used to de-dupe |
| `created_at` / `updated_at` | timestamptz | |

## 3. Data sources

Both sources are **free** and **unofficial / best-effort** — treat them as unreliable
and always degrade gracefully to a **"stale"** badge in the UI rather than erroring out.

| Source | Endpoint | Covers | Cadence | Notes |
|--------|----------|--------|---------|-------|
| **AMFI** | `https://www.amfiindia.com/spages/NAVAll.txt` | Index mutual funds (NAV) | Daily (~11pm IST) | Plain-text, `;`-delimited. One big file; parse + cache. Only updates once/day, so MF alerts need only a daily check. |
| **Yahoo Finance** | `https://query1.finance.yahoo.com/v7/finance/quote?symbols=...` | ETFs (intraday price) | Near real-time during market hours | Append `.NS` for NSE symbols (e.g. `NIFTYBEES.NS`). **Unofficial + rate-limited** → must cache and back off. |

Guidance for the catalog layer:

- Cache Yahoo responses (short TTL, e.g. 60–120s) and coalesce symbols into one request.
- If a fetch fails or returns nothing, keep the **last known price** and mark the row
  `stale: true` with a `lastUpdated` timestamp. The UI shows a muted "stale" pill.
- AMFI parse failures should likewise fall back to the previous snapshot, not crash.

## 4. Environment variables

| Variable | New? | Purpose |
|----------|------|---------|
| `ADMIN_USER_IDS` | reused | Comma-separated Supabase user UUIDs. Your UUID **must** be listed or IndexPulse 403s. |
| `DATABASE_URL` | reused | Postgres/Supabase connection for Drizzle (incl. `index_fund_alerts`). |
| `VAPID_PUBLIC_KEY` | reused | Web Push (server) VAPID public key. |
| `VAPID_PRIVATE_KEY` | reused | Web Push (server) VAPID private key. |
| `VAPID_SUBJECT` | reused | Web Push contact (e.g. `mailto:admin@easysplits.in`). |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | reused | Public VAPID key exposed to the client for `pushManager.subscribe()`. |
| `CRON_SECRET` | reused | Bearer secret protecting `/api/cron/*`. Cron caller sends `Authorization: Bearer $CRON_SECRET`. |
| `RESEND_API_KEY` | **NEW** | Resend free-tier API key for email alerts. **Optional** — if unset, email delivery is a silent no-op (push + toast still work). |

## 5. Cron / scheduling

The cron route lives at `/api/cron/indexpulse-alerts` and requires
`Authorization: Bearer $CRON_SECRET`.

### Vercel Cron (`vercel.json`)

Vercel Cron is the baseline scheduler. On the **Hobby tier** cron frequency is limited
(roughly **once per day**), which is fine for **AMFI index-MF alerts** (NAV only refreshes
once daily around 11pm IST) but **too coarse for intraday ETF alerts**.

```json
{
  "crons": [
    {
      "path": "/api/cron/indexpulse-alerts",
      "schedule": "30 18 * * *"
    }
  ]
}
```

> `30 18 * * *` UTC ≈ 00:00 IST — a daily post-market sweep that covers MF NAV alerts.
> (Vercel Cron always sends the `Authorization: Bearer $CRON_SECRET` header automatically.)

### GitHub Actions (recommended for near-real-time ETF alerts)

The Indian market trades **09:15–15:30 IST, Mon–Fri**. For ETF alerts that need to fire
during the session, add a **free** GitHub Actions workflow that curls the cron route every
~15 minutes during market hours. IST is **UTC+5:30**, so `09:15–15:30 IST` ≈ `03:45–10:00 UTC`
— use `9-16 UTC` loosely, or tighten as below.

Create `.github/workflows/indexpulse-alerts.yml`:

```yaml
name: IndexPulse ETF alerts
on:
  schedule:
    # Every 15 min, 04:00–10:00 UTC (≈ 09:30–15:30 IST), Mon–Fri.
    - cron: "*/15 4-10 * * 1-5"
  workflow_dispatch: {}   # allow manual runs

jobs:
  poke-cron:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger IndexPulse cron
        run: |
          curl -fsS -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://easysplits.in/api/cron/indexpulse-alerts
```

Add `CRON_SECRET` under **GitHub repo → Settings → Secrets and variables → Actions**,
matching the value in Vercel.

> Notes: GitHub Actions cron is best-effort and can be delayed a few minutes under load —
> acceptable for alerts. The cron handler de-dupes via `last_triggered_at` so overlapping
> Vercel + GitHub triggers won't double-send. AMFI/MF alerts stay on the once-daily
> Vercel schedule; the 15-min GitHub run mainly serves ETF alerts.

## 6. Setup checklist

1. **Add your admin id.** Put your Supabase user UUID into `ADMIN_USER_IDS`
   (comma-separated) in Vercel env + local `.env`. Without this the tab 403s.
2. **Run the migration.** Generate/apply the `index_fund_alerts` table:
   ```bash
   pnpm db:push
   ```
3. **(Optional) Enable email.** Create a free API key at [resend.com](https://resend.com)
   and set `RESEND_API_KEY`. Skip this and email alerts simply no-op.
4. **Confirm push env exists.** Ensure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT`, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` are set (already used by the app).
5. **Add the cron.**
   - Add the `crons` entry to `vercel.json` (daily MF sweep).
   - Add the GitHub Actions workflow + `CRON_SECRET` repo secret for intraday ETF checks.
6. **Deploy.** Push to Vercel. Open `/app/indexpulse`, verify prices load, create a test
   alert, and confirm it fires (toast/push/email) on the next cron run.

## 7. Free-tier notes

Every dependency runs on a free tier — IndexPulse adds **zero** recurring cost.

| Service | Tier | Notes |
|---------|------|-------|
| **AMFI NAVAll.txt** | Free | Public daily NAV text file, no auth. |
| **Yahoo Finance quote API** | Free | Unofficial, rate-limited → cached; may break, handled as "stale". |
| **Vercel Hobby** | Free | Hosts app + daily cron (frequency-limited on Hobby). |
| **Supabase** | Free | Auth + Postgres (`index_fund_alerts`, `push_subscriptions`). |
| **Resend** | Free (~3,000 emails/mo) | Called via plain REST fetch — no SDK dependency. Optional. |
| **Web Push (VAPID)** | Free | Browser push standard; no third-party cost. |
| **GitHub Actions** | Free | Scheduled workflow to curl the cron route during market hours. |
