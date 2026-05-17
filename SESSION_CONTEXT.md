# SESSION_CONTEXT.md — EasySplits

> Working-state notes that survive Claude Code context compaction.
> Read this **first** at the start of a new session before picking up work.
> Update as you go. Delete sections that become stale.
>
> Canonical roadmap stays in `PLANNING.md` / `PLANNING.html`. This file only
> captures *in-flight* state and decisions that aren't yet in those.

**Last updated:** 2026-05-17
**Branch:** `main` (no working branches — push directly)
**Live:** https://easy-split-payments.vercel.app

---

## In-flight work

_Nothing in flight._ The 2026-05-17 session shipped Phase 2.8 (Admin panel),
Resend custom SMTP, mobile bottom nav, friend's batch (Record-payment +
Goal editing + Homepage dual-CTA + Bank-statement CSV import v5.3 +
EMI/Debts v5.2). See PLANNING.md → Milestone log for the full list.

---

## Pending tasks

### 1. GSC indexing — 5 URLs left
First 5 priority URLs indexed (`/`, `/financial-health-india`,
`/calculators/trip`, `/calculators/split-bill`, `/features`). Remaining:
- `/use-cases/split-rent`
- `/use-cases/trip-expenses`
- `/use-cases/roommate-utilities`
- `/use-cases/group-dinner`
- `/about`

GSC daily-quota gated. Manual user action via Inspect URL → Request
indexing. No code change.

### 2. Resend SMTP — verify a real domain
Currently using Resend's `onboarding@resend.dev` sandbox sender, which
**only delivers to the email you signed up with**. Magic links to any
other user are silently dropped at the Resend API layer.

Fix:
1. Buy a cheap domain (Cloudflare Registrar / Namecheap, ~₹500–₹1500/yr)
2. Resend Dashboard → Domains → Add Domain → paste in registrar's DNS
   (SPF + DKIM + DMARC, 3 records)
3. Supabase Dashboard → Auth → SMTP Settings → change Sender email to
   `noreply@<your-domain>.com`
4. **Restore the magic-link UI** — login form was simplified to
   Google-only on 2026-05-17 (commit `23a4d8c`) because the sandbox
   sender made the email path silently fail. Run:

   ```sh
   git revert 23a4d8c
   ```

   That puts the email input + "Send magic link" button + email-sent
   confirmation state back exactly as they were. Build, push, done.

Without this you're production-blocked for anyone other than yourself.

### 3. Multi-device login — Supabase Sessions setting
User reports logging in on browser logs them out on mobile + vice versa.
Cause is one of:
- Supabase Dashboard → Authentication → Sessions → "single session per
  user" or strict refresh-token-reuse detection set too aggressively
- Cookie-domain mismatch (different domains tested)

Action in Supabase Dashboard, not code.

### 4. Bank-statement CSV import — real-data verify
v1 (commit `5653b50` + `02071cb`) shipped against typical HDFC / SBI /
ICICI online-banking CSV exports per public documentation. Real exports
may have slightly different header signatures:
- HDFC sometimes ships `Description` not `Narration`
- SBI mobile-app exports differ from NetBanking exports
- ICICI iMobile exports use Excel — user has to "save as CSV" first

If auto-detect fails on real statements, paste the header row (first
line of the CSV) and add the alternative signature in a follow-up.

### 5. EMI/Debts v5.2 — real-data verify
Amortisation library is mathematically correct (24 tests, ±₹1 on the
textbook reference loan). Real-world verify with an actual home/car
loan — confirm the "debt-free in Xy Xm" projection matches the bank's
amortisation schedule + the UX feels right.

### 6. Manual verifies still pending
Items marked `🟡 needs manual verify` across Phase 1/2 (PLANNING.md):
- Guests + claim flow with two real Google accounts
- Creator-only UI gating from a non-creator account
- Donut / area / KPI charts at 375px
- Itemized split end-to-end on a real group
- CSV / PDF group export download

### 7. Stale-while-revalidate SW (optional, ~15 min)
Current SW caches `_next/static/*` cache-first, so every deploy that
matters requires a manual CACHE_VERSION bump in `public/sw.js`. SWR
strategy would background-update on every visit. ~10 lines change.
Nice-to-have for future deploys; not blocking.

---

## Infrastructure snapshot

| What | Value |
|---|---|
| Region | **Mumbai (`bom1`)** — both Vercel + Supabase |
| Supabase project | `rnrwjocisbasoupjxeqo` (`https://rnrwjocisbasoupjxeqo.supabase.co`) |
| Vercel project | `easy-split-payments` (`pranaymates-projects/split-payments-sxn4`) |
| Vercel plan | **Pro** (300s function timeout) |
| Live URL | https://easy-split-payments.vercel.app |
| DB connection | Pooler `aws-0-ap-south-1.pooler.supabase.com:6543` (transaction mode), **not** direct host |
| RLS | Disabled on all `public.*` tables — service-role connection |
| Migrations | Auto-deployed via Supabase ↔ GitHub integration on push to `main`. Latest: `0003_personal_debts.sql` (applied 2026-05-17) |
| Service worker | `v5` (skipWaiting-on-message + visibilitychange-based banner + 3min idle auto-apply) |
| Cron | Vercel cron, pinned to `bom1`, daily 19:30 IST for reminder nudges + anomaly detection |
| Encryption | AES-256-GCM, key in `PFT_ENCRYPTION_KEY` env (server-side only) |
| Email SMTP | **Resend** (sandbox sender `onboarding@resend.dev` — needs a verified domain for production) |
| Node | use nvm v20.20.2 — system Node is v9 and breaks all toolchains |
| Tests | **315 passing** (260 at start of 2026-05-17 session, +55 new across amortise / bank-parsers / queue tests) |

---

## Recent locked decisions

- **Phase 2.8 Admin panel privacy constraint (2026-05-17)** — aggregate-only
  metrics. Amounts surface as buckets (`₹<100` / `₹100-500` / `₹500-2k` /
  `₹2k+`), never exact. User IDs in feed truncated to 4-char prefix.
  Personal-entry payloads stay encrypted — admin panel never decrypts.
- **PFT v5.2 — reducing-balance amortisation only** — flat-rate users
  enter their actual EMI; we project forward correctly. One mental model.
- **PFT v5.2 — compute on the fly, no cron** — no decrementing balance
  stored. `outstandingAt(loan, date)` derives from `(principal, EMI, rate,
  start_date)` snapshot. Simpler.
- **Bank-statement import — 100% client-side parsing** — file never reaches
  our servers. Matches "your data stays yours" brand promise.
- **Bank-statement dedup — deterministic UUIDv5** of
  `(date | amount-paisa | description | type)` as `clientEventId`. Server's
  existing idempotent fast-path makes re-uploads zero-duplicate.
- **Admin auth — no separate password** — env-var `ADMIN_USER_IDS`
  allow-list + existing Google MFA on user account. A second password is
  more attack surface, not less.

---

## Files most likely to need touching next

- `src/lib/bank-parsers/parsers.ts` — if real CSV exports drift from
  the header signatures we coded against, add alternates here.
- `src/server/routers/admin.ts` — add cohort retention + distributions
  for v2 once 50+ users.
- `public/sw.js` — if you want the stale-while-revalidate improvement,
  this is the only file touched.
