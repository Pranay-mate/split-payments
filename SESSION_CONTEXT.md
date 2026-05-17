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

### 🟡 Phase 2.8 — Admin panel v1 (planned 2026-05-17)

**Why:** founder-only observability surface. User has zero metrics visibility
today; needs a single-page admin view to understand growth + activation.

**Locked decisions:**
- Auth gate by `ADMIN_USER_IDS` env var (comma-separated UUIDs), checked in a
  tRPC `adminOnly()` middleware + `/app/admin/page.tsx` server-redirect.
  Explicitly **no separate password** — extra password is more attack surface
  than the existing Google MFA.
- **Privacy constraint:** aggregate-only metrics. Amounts surface as buckets
  (`₹<100` / `₹100-500` / `₹500-2k` / `₹2k+`), never exact values. This
  preserves the app's *"our database only ever sees scrambled text, not your
  numbers"* promise. No per-user financial drill-down anywhere.
- Bundle isolation: admin route ships its own lazy chunk; recharts + heavy
  formatters imported only inside `/app/admin/*`.

**Scope (v1):**
- 8 KPI tiles with sparklines (DAU/WAU/MAU, stickiness, today's signups etc.)
- 90-day signups line chart with 7-day rolling avg overlay
- Activation funnel (horizontal bars, %)
- Anonymised activity feed (last 50 events)

**Deferred to v2 (50+ users):** cohort retention, distributions, feature
adoption donuts.
**Deferred to v3 (200+ users):** geographic, source attribution, operational
health, log explorer.

**Files to create:**
- `src/server/middleware/admin.ts` — `adminOnly()` tRPC middleware
- `src/server/routers/admin.ts` — `pulse`, `signupsByDay`, `funnel`, `feed`
- `src/app/app/admin/page.tsx` — admin route with server redirect
- `src/app/app/admin/_components/*.tsx` — KPI tile, charts, feed

**Reference:** PLANNING.md "Phase 2.8 — Admin panel" section + PLANNING.html.

### ⬜ Magic-link delivery — needs custom SMTP (diagnosed 2026-05-17)

**Symptom:** user reports magic-link emails not arriving. Google OAuth works.

**Diagnosis:** code is correct (`signInWithOtp` + `emailRedirectTo: <origin>/auth/callback` + `shouldCreateUser: true` in `src/app/app/login/_components/login-form.tsx:46-61`).

The bottleneck is Supabase free tier's built-in SMTP: **only 2 emails/hour
per project**. Past the cap, Supabase returns `status: 200` from the API
(so the app's toast says "Magic link sent"), but the email itself is silently
dropped at the SMTP layer.

**Fix (user action, ~15 min):**
1. Sign up at [resend.com](https://resend.com) — free tier 100/day, 3000/mo.
2. Verify sender domain (or use their `onboarding@resend.dev` for testing).
3. Supabase dashboard → Auth → SMTP Settings → enable custom SMTP, paste
   Resend SMTP credentials.
4. Verify the Site URL + Redirect URLs allowlist still include
   `https://easy-split-payments.vercel.app` and
   `https://easy-split-payments.vercel.app/auth/callback*` post-migration.

**Triage step before SMTP swap:** Supabase dashboard → Logs → Auth logs.
Recent `/auth/v1/otp` calls will show either `Too Many Requests` (confirms
rate-limit diagnosis) or another error (different root cause).

### ✅ Personal-side offline parity — SHIPPED 2026-05-14

**Why:** the `?from=<firstName>` share-with-friends banner promises *"a free,
India-first app for splitting bills + tracking your money. Encrypted, no ads,
**works offline**."* Group mutations honour that claim; personal entries
currently bypass the offline queue. User chose **Option 2 — extend the queue**
(over softening the marketing copy).

**Done:**
- `src/lib/offline/db.ts` — `QueuedPath` union extended with
  `personal.create | personal.update | personal.delete`.
- `src/lib/offline/queue.ts` — those three paths added to `ALLOWED_PATHS`.
- `src/lib/offline/queue.ts` — `entityKey()` returns
  `personal-entry:<id>` so per-entity sequencing keeps create→update in order
  while parallel entities still batch.

**Pending (in this order):**
1. Wrap `createMutation` in `src/app/app/(authed)/personal/_components/add-personal-entry.tsx:139`
   with `useMutationWithQueue("personal.create", createMutation, { onQueued: … })`.
   - Generate a `clientEventId` (UUID) before submit; pass it on the input.
   - `onQueued` callback should optimistically inject the new row into the
     `personal.list` query cache (use `utils.personal.list.setData` or
     `cancelQueries` + manual write — match the pattern used by the group
     expense create wrapper).
2. Same wrap for `updateMutation` in the same file (line 140).
   - Already passes `clientUpdatedAt: new Date()`; keep that.
3. Wrap `deleteMutation` in `src/app/app/(authed)/personal/_components/personal-dashboard.tsx:132`
   with `useMutationWithQueue("personal.delete", deleteMutation, { onQueued: optimistically remove from cache })`.
4. Verify server-side already supports both:
   - `src/server/routers/personal.ts:610` — `clientEventId: z.string().uuid().optional()` on `create` ✅
   - lines 614-624 — idempotent fast-path returning the existing row when `clientEventId` already exists ✅
   - line 657 — `clientUpdatedAt: z.date().optional()` on `update` ✅
   - lines 670-679 — rejects stale updates with `CONFLICT` ✅
5. Run `pnpm lint && pnpm test && pnpm build`.
   - System Node is v9 and won't work; use
     `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`.
6. Commit + push:
   - Suggested message: *"Personal-side mutations: offline-queue parity"*.

**Reference implementation:** look at how the group expense create flow uses
`useMutationWithQueue` — that's the proven pattern.

---

## Pending tasks

### GSC indexing — 5 URLs left
First 5 priority URLs indexed (`/`, `/financial-health-india`,
`/calculators/trip`, `/calculators/split-bill`, `/features`). Remaining:
- `/use-cases/split-rent`
- `/use-cases/trip-expenses`
- `/use-cases/roommate-utilities`
- `/use-cases/group-dinner`
- `/about`

Daily-quota gated in Google Search Console — request one per day from
the **Inspect URL → Request indexing** flow. No code change required.

### Manual verifies still pending
Items currently tagged `🟡 needs manual verify` in `PLANNING.md`:
- Guest members + claim flow (needs two real Google accounts in different sessions).
- Creator-only UI gating (verify a non-creator member's view hides the gated buttons).
- Donut / area / KPI charts render correctly at 375px.
- Itemized bill split end-to-end on a real group.
- CSV / PDF group export download.

---

## Infrastructure snapshot

| What | Value |
|---|---|
| Region | **Mumbai (`bom1`)** — both Vercel + Supabase |
| Supabase project | `rnrwjocisbasoupjxeqo` (`https://rnrwjocisbasoupjxeqo.supabase.co`) |
| Vercel project | `easy-split-payments` (`pranaymates-projects/split-payments-sxn4`) |
| Live URL | https://easy-split-payments.vercel.app |
| DB connection | Pooler `aws-0-ap-south-1.pooler.supabase.com:6543` (transaction mode), **not** direct host |
| RLS | Disabled on all `public.*` tables — service-role connection (`supabase/migrations/0002_disable_rls.sql`) |
| Migrations | Auto-deployed via Supabase ↔ GitHub integration on push to `main` |
| Service worker | `v4` (skipWaiting-on-message + visibilitychange-based banner + idle auto-apply) |
| Cron | Vercel cron, pinned to `bom1`, daily 19:30 IST for reminder nudges + anomaly detection |
| Encryption | AES-256-GCM, key in `PFT_ENCRYPTION_KEY` env (server-side only) |
| Node | use nvm v20.20.2 — system Node is v9 and breaks all toolchains |

---

## Recent decisions (since 2026-05-09)

- **Honest-copy audit (2026-05-14)** — chose Option 2 (make personal side
  offline) over Option 1 (soften the "works offline" claim in the share
  banner). Reason: the claim *should* be true; this is a feature gap, not a
  copy problem.
- **Mumbai migration (2026-05-10)** — moved off Sydney/iad1 mismatch. ~10×
  perceived speed improvement; new Supabase project; wiped old DB
  (user-approved); rebuilt schema via `supabase/migrations/0001_init.sql`.
- **Update-banner UX (2026-05-11)** — chose visibility-change-based banner +
  3-min idle auto-apply over forced reload. Decided NOT to show release notes
  inline; they live in Git history.
- **Large-group UX gating (2026-05-13)** — most large-group features
  activate at ≥8 members (search boxes, presets) and ≥12 (pairwise zero-hide).
  Skipped pagination, virtualisation, hard cap — explicit "we won't build" calls.

---

## Open questions / things to discuss

- Should `useMutationWithQueue` for `personal.delete` show an optimistic
  removal animation, or fall back to the cache invalidation pattern groups
  use? (Probably match groups for consistency.)
- After personal-offline ships: do we want a small Lighthouse / Web Vitals
  re-audit on `/app/personal`? It hasn't been measured since the Mumbai cutover.

---

## Files most likely to need touching next

- `src/app/app/(authed)/personal/_components/add-personal-entry.tsx` —
  wrap create + update mutations.
- `src/app/app/(authed)/personal/_components/personal-dashboard.tsx` —
  wrap delete mutation.
- `src/lib/use-mutation-with-queue.ts` (or wherever the existing helper
  lives — find it via `grep -r "useMutationWithQueue" src/`).
- `src/server/routers/personal.ts` — *already supports* idempotency + LWW.
  No changes expected; verify only.
