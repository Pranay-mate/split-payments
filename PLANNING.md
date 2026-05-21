# PLANNING.md — EasySplits

> Phased roadmap with **per-task status**. Updated as we ship. PLANNING.html mirrors this — keep them in sync.

**Last updated:** 2026-05-21 (Domain `easysplits.in` live as Vercel primary · Resend domain verified · magic links delivering · 14 native confirms replaced with branded ConfirmDialog · GSC sitemap submitted · `?from=` invite attribution tile in admin)
**Live:** https://easysplits.in · **GitHub:** https://github.com/Pranay-mate/split-payments

**Status legend:** ✅ done · 🟡 in progress · ⬜ not started · ⏸ blocked (waiting on something)

---

## 0. Decisions (all locked)

| # | Decision | Locked value |
|---|---|---|
| 1 | API style | tRPC + Next.js API routes hybrid ✅ |
| 2 | Currency | INR default per group, multi-currency from day 1 ✅ |
| 3 | Auth | Google OAuth + email magic-link ✅ |
| 4 | Monetization | Free + ads (Pro tier in Phase 4) ✅ |
| 5 | Brand vibe | Indigo→violet→emerald gradient · light/dark · mobile-first ✅ |
| 6 | Phase 1 scope | Confirmed ✅ |

---

## Phase 1 — Core MVP

### Phase 1.A — Auth + profile

| Task | Status |
|---|---|
| Google OAuth (one-click, Supabase Auth) | ✅ |
| Email magic-link (fallback) | ✅ |
| User profile (display name, avatar) | ✅ |
| Sign-out | ✅ |
| Delete account | ✅ |

### Phase 1.B — Groups

| Task | Status |
|---|---|
| Create group (name, primary currency picker) | ✅ |
| Join group via shareable 32-byte link | ✅ (`/app/join/[token]`) |
| Group settings (rename, change currency) | ✅ |
| Leave group / kick members | ✅ |
| Members list | ✅ |
| Guest members (no-signup) + single-use claim links | 🟡 needs manual verify (shipped — needs end-to-end test with two real Google accounts) |
| Creator-only permissions for remove/delete/claim | 🟡 needs manual verify (shipped — verify a non-creator member's UI hides the gated buttons) |

### Phase 1.C — Expenses

| Task | Status |
|---|---|
| Add expense (payer, amount, currency, date, who-shares) | ✅ |
| FX conversion at entry time (free FX API) | ✅ (open.er-api.com, server-side validated, 6h cache) |
| Split modes: equal · exact · share · percent | 🟡 (equal + exact done; share + percent reserved in enum) |
| Itemized bill split (one expense, many line items) | 🟡 needs manual verify (shipped) |
| Categories (7 predefined: Food/Travel/Stay/Groceries/Bills/Entertainment/Other) | ✅ |
| Edit expense | ✅ (Pencil icon → form prefills → Save changes) |
| Delete expense | ✅ |
| Comments per expense | ✅ |
| Per-expense history (events.listByExpense) | ✅ |
| Activity feed (group-level, mobile-redesigned) | ✅ |

### Phase 1.D — Balances + Simplify Payments

| Task | Status |
|---|---|
| Per-person balance calculation | ✅ (`calculateBalances`, reused as-is in app) |
| Group summary (you owe / are owed) | ✅ (in Trip Splitter + group detail) |
| Simplify Payments greedy algorithm | ✅ (`simplifyPayments`) |
| Apply recorded settlements before suggesting | ✅ (`applySettlements` + extended `summariseTrip`) |
| Settle-up flow (record a payment) | ✅ ("Mark as paid" → settlements row + auto-shrink suggestions) |
| Settlement history with undo | ✅ |
| Property tests | ✅ (39 tests) |

### Phase 1.E — Offline / PWA

> **Honest scope note:** the queue handles offline mutations once you're
> *already inside* the group page when network drops. True "trekking
> mode" — re-opening the app while fully offline and being able to view
> + add — needs two more pieces: persistent React Query cache + tolerant
> auth check on `/app` routes. Tracked below.

| Task | Status |
|---|---|
| Web App Manifest (`/manifest.webmanifest`) | ✅ |
| App icons (gradient ES, 64×64 + 180×180 iOS) | ✅ |
| Service worker (network-first nav, cache-first assets) | ✅ |
| SW registration in production only | ✅ |
| iOS PWA meta tags (`appleWebApp`) | ✅ |
| `localStorage` persistence for Trip Splitter | ✅ |
| Offline test (airplane mode → add expense → reconnect → sync) | ✅ |
| Offline event queue for app mutations | ✅ (Dexie/IndexedDB; clientEventId as canonical row id) |
| Background Sync API on reconnect | ✅ (Chrome/Edge; iOS Safari falls back to in-tab online event) |
| Conflict resolution (last-write-wins by clientUpdatedAt vs server.updated_at) | ✅ |
| Parallel-by-entity drain on reconnect | ✅ (groups items by entity ID, runs groups concurrently) |

### Phase 1.F — Marketing + SEO

| Task | Status |
|---|---|
| Home page (`/`) — hero + 6 feature pillars + footer | ✅ |
| `/features` — 8 features + comparison table | ✅ |
| `/about` — why + principles + contact | ✅ |
| `/privacy` (12 sections, plain English) | ✅ |
| `/terms` (12 sections, India law, ₹100 liability cap) | ✅ |
| Standalone Bill Splitter (`/calculators/split-bill`) | ✅ |
| Standalone Trip Splitter (`/calculators/trip`) | ✅ |
| `sitemap.xml` (auto-generated, 7 URLs) | ✅ |
| `robots.txt` (allow `/`, disallow `/app/` + `/api/`) | ✅ |
| Open Graph + Twitter card metadata on every page | ✅ |
| JSON-LD on every page (Organization / SoftwareApplication / Breadcrumb / FAQPage) | ✅ |
| `/use-cases/split-rent` long-tail SEO page | ⬜ |
| `/use-cases/trip-expenses` long-tail SEO page | ⬜ |
| `/use-cases/roommate-utilities` long-tail SEO page | ⬜ |
| `/use-cases/group-dinner` long-tail SEO page | ⬜ |
| Lighthouse 95+ on mobile (verify) | 🟡 |

### Phase 1.G — Ads (free-tier monetization)

| Task | Status |
|---|---|
| AdSense application | ⬜ (waiting 2 weeks + custom domain first) |
| Banner ad on dashboard (lazy-loaded after balances) | ⬜ |
| Native cards in activity feed | ⬜ |
| Hard rule: zero ads on add-expense / settle-up / login | ✅ (locked in PLANNING + privacy policy) |

### Phase 1.H — Polish

| Task | Status |
|---|---|
| Mobile-first responsive (375 → 1280px) | ✅ |
| Dark mode (`prefers-color-scheme`) | ✅ |
| Empty states for People + Expenses sections | ✅ |
| Toasts / confirmations (basic `confirm()` for reset) | 🟡 (use proper toast component when shadcn arrives) |
| Tabular-nums + en-IN INR formatting everywhere | ✅ |
| Optimistic UI on add/edit/delete (no spinners) | ✅ (Trip Splitter) |
| Edit-mode visual cue (highlighted row) | ✅ |
| Native share / clipboard for settlements | ✅ |
| Custom install prompt UI | ⬜ |
| Update notification when SW activates new version | ⬜ |
| Top-nav header with logo + Features + About | ⬜ |

### Phase 1.I — Launch checks

| Task | Status |
|---|---|
| Lighthouse 95+ on mobile (marketing pages) | 🟡 |
| PWA install works on Android Chrome | ✅ verified |
| PWA install works on iOS Safari | ✅ verified |
| Offline test: airplane mode → add expense → reconnect | ✅ verified end-to-end |
| Custom domain (e.g., easysplits.in) | ⬜ |
| GSC verification + sitemap submission | ⬜ |
| Vercel Analytics + Speed Insights | ✅ |

---

## Phase 2 — UX wins

> **Status note (2026-05-09):** several items below are marked ✅ because the
> code shipped + CI passed, but the user hasn't yet manually verified them in
> production. Items needing real-device / multi-account verification are
> tagged `🟡 needs manual verify` so they don't get forgotten.

| Task | Status |
|---|---|
| Categories (7 predefined buckets) | ✅ (Phase 1.C) |
| Auto-detect category from description (local keywords, ~150 rules) | ✅ |
| **Charts & visualisations** (Recharts; UX principles below) | 🟡 needs manual verify |
| ↳ Per-member contribution bar at top of group page | ✅ |
| ↳ Balance bars (green = gets · red = owes) replacing text rows | ✅ |
| ↳ Settlement progress ring ("65% settled") | ✅ |
| ↳ Spend-by-category donut | 🟡 needs manual verify |
| ↳ Daily-spend area chart with peak callout | 🟡 needs manual verify |
| ↳ Hero KPI band (total · expenses · days · daily avg) | 🟡 needs manual verify |
| ↳ Hero KPI band on group landing | ✅ (shipped via Charts redesign) |
| Bulk-split: one bill across multiple line items (itemized) | 🟡 needs manual verify (shipped, awaiting end-to-end test on real group) |
| Export group to CSV / PDF | 🟡 needs manual verify |
| Trip mode: daily summary, per-day spend | ✅ |
| Historical FX rates (lock per-expense at entry) | ✅ done in 1.C |

### Future scope (Phase 2 deferred / Phase 3 candidates)

> Explicitly carried over from Phase 2 by user decision. Not on the
> active roadmap — captured here so they aren't lost.

| Task | Note |
|---|---|
| Receipt photo upload (Supabase Storage) | Future scope. Storage bucket + thumbnail in expense row. Likely ~2h. |
| Recurring expenses (rent, subs) | Future scope (deferred per user). Needs cron-triggered materialization OR on-open generation; template UI for editing rules; handles membership changes. ~3–4h. |
| Bank statement CSV import | Future scope. Parse HDFC/SBI/ICICI/Axis CSV exports; preview detected transactions; bulk-import. Reuses existing auto-detect category. ~3h. |
| 80C / 80D / 80CCD(1B) tax tracker | Future scope. Indian-specific, sticky annual feature — show progress bars on each section limit, surface missed savings. Belongs to Phase 2.5 PFT. ~2–3h. |

### Out of scope (decided no)

> Explicit "no" decisions. Captured so we don't re-propose these in future
> planning sessions.

| Task | Why no |
|---|---|
| View balances in any currency (not just primary) | Decided not needed (2026-05-09). Group's primary currency is sufficient — international-member case is too rare to justify the FX-display complexity, settle-up two-currency UX, and "yesterday it said $50.10, today $50.40" drift confusion. |

---

## Phase 2.5 — Personal Finance Tracker — ✅ v1 → v4 shipped

> A second product inside EasySplits: track *your own* monthly income +
> expenses + investments, separately from the group splitting. Insights
> about spending patterns + wealth creation. Reuses existing categories,
> charts, and offline-queue infrastructure.
>
> **Status (2026-05-09):** v1.0 → v4.0 all shipped in production. Manual
> verification still pending on the user side. v4.1+ items below are
> queued for the next push.

### Locked decisions

| # | Decision | Locked value (2026-05-09) |
|---|---|---|
| 1 | **Encryption** | **Option B — application-layer AES-256-GCM** with key in `PFT_ENCRYPTION_KEY` env. Sensitive columns (amount + description on `personal_entries`; all amount columns on `financial_profiles`) stored as base64 ciphertext. Server holds the key, decrypts when needed for scoring/analytics/exports. **Swapped from the originally-locked pgcrypto approach** for simpler Drizzle integration + no Postgres-extension dependency; security guarantees identical. Industry-standard for fintechs. Not E2EE — server can read. |
| 2 | **Honest copy** | Dashboard subtitle: *"🔐 Your salary is your secret. We encrypt every amount before storing — our database only ever sees scrambled text, not your numbers."* Wizard step caption: *"🔐 We encrypt every amount before storing — our database only ever sees scrambled text."* Every word verifiable under Option B. **Never** claim "even we can't read it" (that's E2EE territory). |
| 3 | **Privacy isolation** | Each user sees only their own entries (server filters by `ctx.user.id` in every query). No sharing, no cross-user views. |
| 4 | **Score ↔ score logic** | Lives server-side (depends on decrypted values). Future move to E2EE would require rewriting score logic to run client-side; we're not doing that. |

### Data model — shipped ✅

| Table | Status |
|---|---|
| `personal_entries` (id, user_id, type, amount [encrypted], currency, category, description [encrypted], occurred_at, soft-delete) | ✅ shipped (v1.1) |
| `financial_profiles` (id, user_id UNIQUE, age, retirement_age, isFreelancer, hasDependents, hasCcCarryover, monthly_income/expenses/savings/term/health/emi/investment_balance/monthly_investment [all encrypted], completed_at) | ✅ shipped (v3 + v3.6) |
| `score_snapshots` (id, user_id, total, band, pillar_scores JSON, snapshotted_at) — append-only history | ✅ shipped (v4.0) |
| `financial_goals` (id, user_id, goal_kind=pillar\|total, pillar_key, label, target_score, target_date, current_value, completed_at, archived_at) — pillar 0..20 / total 0..100 targets, no encryption | ✅ shipped (v4.2) |
| `personal_recurrences` (auto-fill salary/rent/SIP on schedule) | ⬜ deferred |
| `personal_holdings` (MF/FD/stock positions) | ⬜ Phase 3 |

### Routes — shipped ✅

| Route | Status |
|---|---|
| `/app/personal` — dashboard (hero KPI + scorecard + anomaly banner + top categories + add form + transactions list + charts toggle) | ✅ shipped (v1.0 → v4.0) |
| `/app/personal/onboard` — single-page financial health scorecard wizard | ✅ shipped (v3.0, redesigned single-page in v3.6) |
| `/app/personal/transactions` — separate full-ledger view | ⬜ deferred (current dashboard list already paginates well at 5/page + Show all) |
| `/app/personal/insights` — auto-narratives | ⬜ deferred (current insights inline on dashboard) |
| `/app/personal/wealth` — net-worth tracker | ⬜ Phase 3 candidate |

### v1.0 → v4.0 shipped checklist

| Sub-version | What | Status |
|---|---|---|
| **v1.0** | personal_entries schema · tRPC CRUD · monthly summary card · add/edit form · top categories · pagination | ✅ |
| **v1.1** | AES-256-GCM field-level encryption · honest disclosure copy | ✅ |
| **v2** | Charts panel (donut, monthly trend, in/out/invest bars) | ✅ |
| **v3.0** | 5-pillar scorecard · onboarding wizard · India-specific rules of thumb · disclaimers | ✅ |
| **v3.5** | Anomaly alerts (banner + push, ≥50% category deviation) | ✅ |
| **v3.6** | Age-based investing target + retirement-age glide · single-page wizard rebuild | ✅ |
| **v4.0** | Score history snapshots · trajectory area chart · delta indicator · streak badge · gap-first pillars (max-pillars collapse) | ✅ |
| **v4.1** | Achievement badges (Safety Net · Well Insured · Debt Free · Power Saver · Compounder · Green Band · +10 Improvement · Consistent Green) · per-pillar mini-sparklines (inline SVG, no recharts) | ✅ |
| **v4.2** | Goals system — pillar/total score targets with optional target date · progress bar refreshed on profile re-submit · 6 quick-pick templates + custom date · auto-flips `completed_at` on first crossing | ✅ |
| **v4.3** | Indian peer benchmarks — NCAER/RBI/IRDAI/NSO/AMFI baseline numbers cited under each pillar message + sources expander in scorecard footer | ✅ |
| **v4.4** | "Send test notification" button in Reminders settings — bypasses 7-day throttle + qualifying-data check, prunes 410-Gone subscriptions inline | ✅ shipped (commit `e70d717`) |
| **v5.0** | `personal_recurrences` — monthly auto-fire of salary/rent/SIP via daily cron. 13 unit tests on the date math. Pause/resume/edit UI on dashboard. | ✅ |
| **v5.1** | `personal_holdings` + `/app/personal/wealth` — net-worth tracker with MF/FD/stock/gold/bond/other holdings. Encrypted units/avg-cost/current-value. Type-breakdown bars + per-holding edit. Snapshots write on every change. | ✅ |
| **v5.2** | `personal_debts` — track home / car / personal / education / credit-card loans. Reducing-balance amortisation library (`src/lib/amortise.ts`, 24 unit tests). Net worth = liquid + holdings − active debts. Trajectory chart projects forward including debt decay. Encrypted principal + EMI. Inline form has live "debt-free in Xy Xm" preview. | ✅ |
| **v5.3 — Bank-statement CSV import** | `/app/personal/import` — client-side CSV parsing for HDFC + SBI + ICICI online-banking exports. Three-step flow: Upload → Preview (per-row select / edit / category-override, self-transfer auto-flag) → Result. Deterministic UUIDv5 dedup via `clientEventId` — re-uploading the same statement = no duplicates. Parses inline (file never reaches our servers). 31 unit tests. | ✅ |

### Active queue (next push)

| Order | Title | Why it matters | Status |
| --- | --- | --- | --- |
| 1 | **GSC indexing — remaining 5 URLs** | 5 of 10 priority URLs indexed (`/`, `/financial-health-india`, `/calculators/trip`, `/calculators/split-bill`, `/features`). Remaining: `/use-cases/split-rent`, `/use-cases/trip-expenses`, `/use-cases/roommate-utilities`, `/use-cases/group-dinner`, `/about`. Daily-quota gated. | ⬜ resume daily as GSC quota allows |
| 2 | **Manual verifies still pending** | Items marked `🟡 needs manual verify` across Phase 1/2 — guests + claim flow with two Google accounts, creator-only UI gating from a non-creator account, donut/area/KPI charts at 375px, itemized-split end-to-end on a real group, CSV/PDF export, etc. | ⬜ |
| 3 | **Bank-statement import — real-data verify** | v1 ships against typical HDFC / SBI / ICICI online-banking CSV exports per public documentation. Real exports may have slightly different header signatures (HDFC sometimes ships `Description` not `Narration`; SBI mobile-app exports differ from NetBanking). Test with real statements + add alternative signatures if auto-detect fails. | ⬜ ~30 min per format that drifts |
| 4 | **EMI/Debts — real-data verify** | v5.2 amortisation library is mathematically correct (24 tests, ±₹1 on textbook reference); real-world verify with an actual home/car loan to confirm UX feels right + the "debt-free in Xy Xm" projection matches the bank's amortisation schedule. | ⬜ |
| 5 | **Multi-device login** | User reports logging in on browser logs them out on mobile (and vice versa). Likely a Supabase Auth → Sessions setting (single-session-per-user or strict refresh-token-reuse detection). Action lives in Supabase Dashboard, not code. | ⬜ ~5 min once panel opened |
| 6 | **Stale-while-revalidate SW for `_next/static/*`** | Current SW caches assets cache-first, so a new deploy requires a SW version bump for users to see fresh code. SWR strategy would background-update on every visit. ~10 lines in `public/sw.js`. Quality-of-life for future deploys. | ⬜ ~15 min · optional |

### Onboarding & invite polish — 2026-05-13 batch (sequential ship) — ✅ all shipped

Three small, complementary improvements. Pushing one commit each so they're easy to review / rollback.

| Order | Title | Why it matters | Estimate |
| --- | --- | --- | --- |
| 1 | **Group invite QR code** | Mobile-to-mobile group joining: scan instead of copy-link. `qrcode.react` (~7 KB, MIT, free, client-only) renders the existing `/app/join/<token>` URL. No new routes or backend. | ~1h |
| 2 | **Onboarding empty states with action prompts** | Every "empty" screen gets a contextual CTA + 1-tap path to the next action. /app/groups → "Create your first group" (+ Trip / Roommates / Solo templates), /app/personal → "Log your first expense", /app/personal/wealth → "Add your first holding", scorecard → "Complete in 60 seconds" with a progress bar. Targets the most fragile moment in the funnel. | ~2h |
| 3 | **Goal-progress projections** | Goals show "31/80 (38%)". Add "At your current pace → Aug 2026" computed from the slope between the user's score snapshots. Falls back to a gentle "Take another snapshot to see projections" line until ≥2 data points exist. Makes goals feel like a real trajectory, not a static target. | ~2h |

### Large-group UX hardening — 2026-05-14 audit — ✅ all shipped

The group UI was originally designed for 3-6 person trips. Audit at 10-15 / 50 members surfaced these surfaces that degrade as size grows. All shipped 2026-05-14.

| Priority | Surface | Fix | Status |
| --- | --- | --- | --- |
| 1 | **Add-expense split picker** | Search box + "Everyone / Just me / Except me" presets above the chip list (gated to ≥8 members). | ✅ shipped |
| 1 | **Payer combobox** | Replace `<select>` with searchable button popover; show "you" badge; defaults to current user. | ✅ shipped |
| 2 | **Pairwise balances filter** | Auto-hide zero-balance pairs + "Just my balances" toggle on the pairwise tab; auto-enabled at ≥12 members. | ✅ shipped |
| 2 | **Contribution bar cap** | Top 6 contributors + neutral "Others (N)" segment — beyond 8 distinct colors the stripe becomes visual mush. | ✅ shipped |
| 3 | **Member list search + sort** | Search input + sort dropdown (Joined / Name A→Z / Guests first) above the member list in group settings; gated to ≥8 members. | ✅ shipped |
| 3 | **Activity feed filter chips** | Filter chips by event family (All / Expenses / Settlements / Members / Comments); gated to ≥8 feed items. | ✅ shipped |
| 3 | **Soft warning at 30+ members** | One-line amber banner: "For trip-specific spending, smaller sub-groups keep balances easier to read." Dismissable for 7 days per (user × group). | ✅ shipped |

What we explicitly DECIDED NOT to build (per UX audit):
- Pagination of the member list (search is enough below ~100; pagination adds complexity).
- Virtualized lists (premature; only matters at 200+).
- Hard member cap (frustrates legitimate use; better to give tools than limits).

### Effort spent

~2-week effort estimate became **1 day of focused build** (today). v1 → v4 shipped same-day. Counts as a meaningful win.

### v3 — Financial Health Scorecard — ✅ shipped (left in place for context)

> The differentiator. India has no good free tool for "am I doing well
> with my money?" — this fills the gap. Builds on top of the v1 tracker
> data so we don't ask users to type "current monthly expenses" by hand
> (they'd guess wrong; the tracker has the real number).

**5-pillar score (each 0–20, total 100):**

| Pillar | Scored on | Indian rule of thumb |
|---|---|---|
| **Emergency fund** | months of expenses in liquid savings | 6 months for stable jobs, 9–12 for freelancers |
| **Insurance** | term cover ÷ (10× annual income) + health cover adequacy | 10–15× annual income if dependents · ₹5L individual + ₹15L super top-up · 0 term needed if no dependents (push back on the standard advice) |
| **Debt** | EMI ÷ income ratio · credit-card carry-over · debt mix | EMI < 40% of income · no rolling CC balance · prefer secured over unsecured |
| **Savings rate** | (income − expenses) ÷ income | 20%+ is good · 30%+ is excellent |
| **Investing** | net worth growth · equity allocation vs age · retirement on track (NPS/PPF/EPF/MFs) | Age-glide: equity % ≈ 100 − age · retirement target ~25× annual expenses |

**Onboarding wizard (5 questions for the rough score):**
1. Monthly income (auto-pulled from PFT income entries; user can override)
2. Current liquid savings (savings + FD)
3. Term life cover (sum assured)
4. Health insurance cover (sum assured, family floater? employer-provided?)
5. Total monthly EMIs

Drill-down per pillar adds detail (NPS, PPF, gold, mutual funds, etc.) for users who want a more accurate score.

**Disclaimers (locked, must appear):**
- "Rules of thumb, not financial advice. We are not a SEBI-registered investment advisor."
- "Educational tool. Decisions about investments, insurance, and debt should be made with a qualified RIA."
- Every metric has a "why" tooltip linking to a short explainer.

**Out of scope for v3:**
- Peer comparison (cross-user data — adds privacy review burden; wait until product proven)
- Insurance / investment product recommendations + affiliate links (regulatory + trust risk)
- Auto-pull from EPFO / NPS / banks (no clean APIs)

**Effort:** ~8–12h for v3 (onboarding wizard + 5-pillar scoring + drill-down per pillar). Score history + goals come in v4 (~4h).

### v3.5 — Anomaly alerts (planned)

> Pairs with the Phase 2.6 Reminder-nudges infrastructure (Web Push +
> service worker + Vercel Cron daily). Same plumbing, different message.

**What it does:** detects when a category's monthly spend genuinely
deviates from the rolling 6-month average (>50% delta on a category that
typically has ≥3 entries/month) and surfaces a gentle, one-tap-dismissible
notification: *"Food up 60% this month — anything off?"*

**UX rules (locked, mobile-first):**
- Amber not red — this is "hey, look", not an emergency.
- Cap at 2 alerts/user/month so it doesn't become noise.
- Push and in-app banner both — push for habit-forming, banner so it's
  visible in-app without push permission granted.
- Tap → drill into that category's transactions for the month. Don't
  just toast a vague hint; take the user somewhere actionable.
- "Mute this category for 30 days" link on every alert.

**Why it pairs with reminder-nudges:**
- Same `push_subscriptions` table.
- Same Vercel Cron daily endpoint — anomaly detection runs as a second
  pass after the unsettled-balance check.
- Same opt-in toggle in settings; user picks "balance reminders" and/or
  "spending anomalies" independently.

**Effort:** ~3h on top of Reminder nudges (the infrastructure does most
of the heavy lifting; the new bits are the per-category rolling-average
query and the alert message templates).

---

### Charts UX principles (when Phase 2 charts ship)

| Principle | Why |
|---|---|
| Mobile-first; render correctly at 375px | 90% of usage is phone |
| Always show underlying numbers next to charts | Chart is supplementary, not source-of-truth |
| Colour-blind safe palette (≥ 4 distinct hues) | 8% of men can't distinguish red/green |
| Hide chart entirely when data is too small (1 expense, 1 person) | Avoid noise |
| No reveal animation > 250ms | Don't make people wait |
| Tap segments to drill in | Touch UX |

Skipped: heatmap calendars, expense-by-member pie (redundant with balance bars), time-series line for ongoing rent groups (noise).

## Phase 2.7 — Group balances polish (planned)

> Suggested Payments today only ships the Simplified view (greedy
> debt-minimisation). Some users prefer paying back the person they
> actually transacted with — Pairwise gives them that option. The
> "Why?" expander explains how a Simplified row was derived for users
> who want to verify or trust the math.

| Sub-version | What | Effort |
|---|---|---|
| **v1.0** | Simplified ⇄ Pairwise toggle. Segmented control at the top of the Suggested Payments section. Pairwise = net debt per `(debtor, creditor)` pair, applies recorded settlements, drops zeros, nets reverses. New `pairwiseDebts` helper in `trip-split.ts` + unit tests. Default stays Simplified — the value-add of the algo. | ~1h |
| **v1.1** | "Why?" chain expander on each Simplified row. Shows the underlying graph traversal: *"A→C ₹500 = A owes B ₹500 (dinner) · B owes C ₹500 (Uber)"*. Closes the trust gap that drives the request for raw mode in the first place. | ~1.5h |

**Skipped:** per-expense view (already covered by the expense list which shows splits per row).

---

## Phase 2.8 — Admin panel (planned)

> Solo-dev observability surface at `/app/admin`. Built for the founder
> only — not a multi-tenant admin product. **Aggregate-only metrics, no
> per-user financial drill-down** so the encryption privacy promise
> stays intact.

### Locked decisions (2026-05-17)

| # | Decision | Locked value |
|---|---|---|
| 1 | **Auth model** | No separate password. Gate by `ctx.user.id ∈ ADMIN_USER_IDS` env var (comma-separated UUIDs). A second password is more attack surface, not less — Google MFA on the existing account is stronger. tRPC middleware `adminOnly()` throws FORBIDDEN; `/app/admin/page.tsx` server-redirects on miss. v2 may add an optional TOTP step before admin routes hydrate. |
| 2 | **Privacy constraint** | The app promises *"our database only ever sees scrambled text, not your numbers."* The admin panel **must respect this**: aggregate counts/distributions/percentiles only. Amounts surface as buckets (`₹<100` · `₹100-500` · `₹500-2k` · `₹2k+`) — never exact. User-level support troubleshooting uses metadata (`user_id`, `created_at`, `last_active`, group/expense count) — never amounts. Decrypting an individual user's salary into the admin UI = breaking the promise. |
| 3 | **Bundle isolation** | Admin route ships its own lazy chunk. Recharts + heavy formatters import inside `/app/admin/*` only — they never enter the main app bundle. Hot-path remains lean. |

### Data points (v1)

**Pulse — KPI tiles with sparklines + 7-day delta:**
- Total users · DAU · WAU · MAU
- DAU/MAU stickiness (target 20%+)
- Today: signups · groups created · expenses added
- Push subscribers (active count, sent count last 7d)
- Offline queue items globally (sum across users, count not contents)

**Growth — line/area charts:**
- New signups per day, last 90d (with 7-day rolling avg overlay)
- WAU / MAU trends, last 90d
- Cohort retention: signups by week × % returning at W+1, W+2, W+4, W+8
- Source: top referrers split by `?from=` invites · direct · organic

**Activation funnel — horizontal bars, percentages:**
- Signed up → first group joined/created
- Joined group → first expense added
- Signed up → first personal entry logged
- Started scorecard wizard → completed it
- Completed scorecard → returned within 7 days

**Engagement distributions — histograms:**
- Members per group (2 / 3-5 / 6-10 / 11-20 / 20+)
- Expenses per group (0 / 1-5 / 6-20 / 21-100 / 100+)
- Personal entries per active user, last 30d
- Score distribution by band (red · amber · emerald · green bars)
- Average score trend (line, monthly)
- Goals: count active vs completed vs archived

**Feature adoption — donuts/bars:**
- PWA installed vs web-only (via `display-mode: standalone` detection)
- Push notifications opted-in rate
- Voice input used at least once (% of users)
- Offline-queue actually triggered (% of mutations)
- Device split (iOS · Android · Desktop) via Vercel Analytics
- Browser split

**Geographic — table or India map:**
- Top cities/states (India-first)
- Country split (diaspora signal)

**Operational health — progress bars + ticks:**
- DB size used / 500MB free-tier cap
- Vercel function executions today vs 100k/mo cap
- Last cron run (`/api/cron/daily`) + success/fail
- 410-Gone push subscriptions pruned this week
- Failed offline-queue drains (CONFLICT vs network split)
- Server errors last 24h, by status code

**Activity feed — anonymised, last 50 events:**
- *"User #a8f3 joined group with 5 members"*
- *"Scorecard completed · 82/100 · age 32"*
- *"Goal hit: Emergency fund at 6 months"*
- *"Settlement recorded · ₹500-2k range"*
- Amounts as buckets only. No emails. User IDs truncated to 4-char prefix.

### Explicitly skipped on v1

- Individual user search / financial drill-down (privacy + premature)
- Email exports / scheduled reports (no users to report to)
- A/B test framework (one product, premature)
- Real-time WebSocket dashboard (over-engineering at sub-2% utilisation)
- Anomaly alerts on the admin metrics themselves (manual check is fine)

### Layout (single page)

```
┌─────────────────────────────────────────────────────────┐
│ 8 KPI tiles in 4-col grid (sparklines + delta)          │
├─────────────────────────────────────────────────────────┤
│ Signups 90d (line, 2/3 width) │ Source breakdown (1/3) │
├─────────────────────────────────────────────────────────┤
│ Activation funnel (horizontal bars, full width)         │
├─────────────────────────────────────────────────────────┤
│ Cohort retention table (full width)                     │
├─────────────────────────────────────────────────────────┤
│ 4 small charts in 2×2: scores · groups · entries · feat │
├─────────────────────────────────────────────────────────┤
│ Activity feed (left, 2/3) │ Operational health (1/3)   │
└─────────────────────────────────────────────────────────┘
```

### Phased ship plan

| Phase | Threshold | Scope | Effort |
|---|---|---|---|
| **v1** | Anytime | Auth gate + Pulse KPIs + 90d signups + activation funnel + activity feed | ~1 day |
| **v2** | 50+ users | Cohort retention + distributions + feature adoption | ~0.5 day |
| **v3** | 200+ users | Geographic, source attribution, operational health, log explorer | ~1 day |

Earlier phases would be sparse histograms — the data needs population first.

### Stack

- `protectedProcedure.use(adminOnly())` middleware in `src/server/middleware/admin.ts`.
- New `admin.*` tRPC router (`adminRouter.ts`), surface: `pulse`, `signupsByDay`, `funnel`, `cohort`, `feed`, `health`.
- Route: `src/app/app/admin/page.tsx` — server-side redirect if not admin.
- Existing recharts + score band colors for visual consistency.
- KPI tiles use existing `<InfoTip />` for "what does DAU/MAU mean" affordances.

---

## Phase 2.6 — Free Phase 3 picks (active)

> User decision (2026-05-09): cherry-pick the Phase 3 features that have a
> fully-free implementation path (browser API or built-in cron) and ship
> them now. The rest stay Future scope.

| Task | Status | Free path |
|---|---|---|
| Voice input (mic button → SpeechRecognition fills description + amount) | 🟡 building | Browser Web Speech API (Chrome/Safari built-in, en-IN locale) |
| Reminder nudges (push notification for unsettled balances >7 days) | 🟡 building | Web Push API + service worker + Vercel Cron daily; VAPID keys are free |

## Phase 3 — Power features (Future scope)

> Promoted Voice input + Reminder nudges to Phase 2.6 (above). These four
> remain Future scope — each has a free path on-deck if we ever need them,
> noted in the third column.

| Task | Status | Free path on-deck |
|---|---|---|
| OCR receipt scanning | ⏸ Future scope | Tesseract.js — runs entirely in-browser, no API key, no quota. Quality decent on printed receipts. |
| AI categorization (Claude Haiku) | ⏸ Future scope | Already covered by local keyword detection in `category-detect.ts` (~150 rules, India-skewed). Don't add LLM unless real-world miss rate is high. |
| WhatsApp bot (Meta Cloud API, DM only) | ⏸ Future scope | Meta has a 1k free conversations/month tier but business-account verification is a hassle. Defer until demand justifies it. |
| SMS UPI debit parsing | ⏸ Future scope | True auto-read needs a native Android app. Free fallback: paste-to-parse — user pastes the SMS into a textarea, regex extracts amount + vendor + date. |

## Phase 4 — Optional Pro tier

| Task | Status |
|---|---|
| Revisit freemium if AdSense rejected / CPMs low | ⬜ |
| Pro tier ₹99/yr — no ads, OCR, recurring, WhatsApp | ⬜ |
| Razorpay/Stripe integration | ⬜ |

---

## Where data is stored (current snapshot)

| Data | Location | Persistence | Notes |
|---|---|---|---|
| Trip Splitter trip state | Browser `localStorage` (`easysplits-trip-v2`) | Per-device | Resets on cache clear; never leaves device |
| Bill Splitter inputs | React state only | Component lifetime | Nothing persisted |
| Static assets / pages | Vercel CDN | Edge cached | Hashed bundles, immutable |
| Service worker cache | Browser cache (`easysplits-runtime-v1`) | Per-device | Cleared on SW version bump |
| **Future** app data (groups/expenses) | Supabase Postgres (Mumbai region) | Cross-device | Not yet provisioned |
| **Future** offline mutation queue | IndexedDB via Dexie | Per-device until synced | Not yet built |

**No server-side database is active right now.** The standalone calculators are 100% client-side. The full app (auth + groups + persistent expenses) needs a Supabase project; not started until user provisions one.

---

## Risks / mitigations

| Risk | Mitigation |
|---|---|
| AdSense rejection (fintech-adjacent) | Apply only after custom domain + 2 weeks of activity. Backup: affiliate cards + freemium |
| Multi-currency complexity in Phase 1 | Free FX API (open.er-api.com); store rate at entry time |
| Offline conflict edge cases | Event sourcing + tombstones; targeted tests |
| Supabase free tier limits | Monitor; bump to $25/mo Pro at first warning |
| iOS PWA background-sync flakiness | Detect iOS, fall back to "sync on app open" |
| Simplify-payments correctness | Property tests already in place (sum to zero, ≤ N−1 transfers) |
| SEO competition (Splitwise et al.) | Lean into India-first + offline + standalone calculators |

---

## Milestone log

| Date | Milestone |
|---|---|
| 2026-05-06 | Project initialised. Decisions 1-5 locked. Phase 1 scope #6 confirmed. |
| 2026-05-06 | Scaffolded Next.js 16 + Tailwind v4 + TS. Pushed to github.com/Pranay-mate/split-payments. |
| 2026-05-06 | Branded landing live (indigo→violet→emerald, 6 feature pillars, dark mode). |
| 2026-05-06 | SEO infrastructure (seo.ts, jsonld.ts, sitemap.ts, robots.ts) + Split Bill Calculator. |
| 2026-05-06 | UX: simplified Bill Splitter — optional ₹ tip, no service charge field, whole-rupee rounding. |
| 2026-05-06 | PWA scaffold: manifest, dynamic icons, hand-rolled service worker (production-only registration). |
| 2026-05-06 | Vitest set up. 16 tests for Bill Splitter. Privacy + Terms pages. |
| 2026-05-06 | Trip Expense Splitter live with simplify-payments algorithm. 32 total tests. |
| 2026-05-06 | `/features` + `/about` pages live. AdSense prerequisites complete except custom domain. |
| 2026-05-07 | Trip Splitter edit + exact-amount split mode. 35 tests. Data model rewrite (sharerIds → splits). |
| 2026-05-07 | Polish bundle: top nav header, sonner toasts, row entrance animation, custom PWA install prompt. |
| 2026-05-07 | Drizzle schema (7 tables) + Supabase clients (browser/server/middleware) + tRPC v11 + middleware committed as foundation. |
| 2026-05-07 | Schema applied to Supabase (Sydney region). Google OAuth wired. db:push + dotenv-cli scripts. |
| 2026-05-07 | Auth UI: /app/login + /auth/callback. Google sign-in + magic-link working. |
| 2026-05-07 | /app/groups list + create form. Group detail at /app/groups/[id] with expenses + balances + simplify-payments — reuses existing Trip Splitter algorithms. 35 tests. |
| 2026-05-07 | Settlements router + UI: "Mark as paid" auto-shrinks suggestions, settlement history with undo. /app/join/[token] one-tap invite landing. summariseTrip extended to fold recorded settlements. 39 tests. |
| 2026-05-07 | Edit expense (Pencil → prefilled form → Save changes). Refactored expenses.listByGroup to use Drizzle inArray instead of raw SQL ANY. |
| 2026-05-07 | **Multi-currency expenses**: currency picker + live FX preview + server-side rate fetch. 12 currencies via open.er-api.com (free, no key). Splits auto-converted to primary, balances stay coherent. Editing shows original amount + back-converts exact splits. |
| 2026-05-08 | Server-render groups list (saves a round-trip on /app/groups). |
| 2026-05-08 | **6 quick-wins**: group settings, members kick/leave, group switcher, delete-account, comments, activity feed. New `expense_comments` table. Event log writes on every mutation. |
| 2026-05-08 | 4 use-case SEO pages: split-rent, trip-expenses, roommate-utilities, group-dinner. |
| 2026-05-08 | **Phase 1.E offline event queue** (MVP): IndexedDB queue via Dexie, online/offline detection, replay-on-reconnect, UI indicator. Wired into expense add/edit. |
| 2026-05-08 | **Phase 1.E full**: optimistic UI on every mutation, Background Sync API on Chrome/Edge, last-write-wins via clientUpdatedAt, parallel-by-entity drain, conflict toast surfacing. clientEventId becomes canonical row ID — fixes offline-create-then-edit. |
| 2026-05-08 | **Multi-currency offline**: livePreview FX, server validates rate range, splits stored in primary, original amount preserved for edit form back-conversion. |
| 2026-05-08 | UX polish: View-all toggles for expenses (default 10) + activity (default 5); per-expense History button (events.listByExpense); group card redesign (gradient strip + stats row + scroll-to-form on edit). |
| 2026-05-08 | Mobile redesign of activity feed: type-coded icons, wraps freely, time below content. |
| 2026-05-09 | `events.expense_id` column for per-expense history queries; logEvent helper accepts optional expenseId. |
| 2026-05-09 | Group header card: drop redundant name (lives in top-nav GroupSwitcher); sr-only h1 + avatar + currency/members tagline. |
| 2026-05-09 | **Guest members + claim flow**: shadow profiles via `groups.addGuest`, single-use claim tokens, transactional `claim.consume` migrates all FKs (expense_splits, payer_id, settlements, comments, events, group_members) from shadow → auth user. Edge cases: same-expense merge, already-in-group merge. |
| 2026-05-09 | **Creator-only permissions**: removeMember (auth users), createClaimToken, group delete now gate on `groups.createdBy === ctx.user.id`. Guest removal still open to any member. UI hides gated buttons for non-creators. |
| 2026-05-09 | **Categories**: 7 predefined buckets (Food/Travel/Stay/Groceries/Bills/Entertainment/Other) on every expense. Stored as text (no enum migration to add new ones). Picker chips in add-expense; colored chip on each list row. |
| 2026-05-09 | **Trip-mode "By day" toggle**: interleaves day headers with daily totals into the expense list. No schema change; pure interleaved DisplayItem stream. |
| 2026-05-09 | **Charts panel** (recharts, lazy-loaded): pie of categories, bar of daily spend, paid-by horizontal bars. Default-collapsed. |
| 2026-05-09 | **Charts redesign for hierarchy + delight**: hero KPI band (total + 3 frosted tiles), donut with center emoji + percentage, gradient area chart with peak callout, custom HTML "Who's paying" list with per-payer gradient bars + Top badge. |
| 2026-05-09 | Bug fix: `expenses.update` was rejecting any expense that included an ex-member in its splits or payer with a misleading FORBIDDEN. Now grandfathers existing split userIds + the original payer through. |
| 2026-05-09 | **Itemized bill split**: new `expense_items` table (with `sharer_ids uuid[]` so a single table covers it). `splitsFromItems` helper (server + client mirrored) computes per-user totals with paisa-residual adjustment. AddExpense gains an "Itemized" mode alongside Equal / Exact ₹. |
| 2026-05-09 | Expense list: progressive 5-at-a-time pagination — default 5 visible, "Show 5 more" / "Show all N", "Show recent 5" reset link. Recent-mode only; By-day mode unchanged. |
| 2026-05-09 | **Group export**: CSV (multi-section, no deps) + PDF (jspdf, lazy-loaded). Buttons in their own section card. |
| 2026-05-09 | **Group page UX trio**: contribution bar (stacked horizontal, who paid what %), balance bars replacing text rows (green/red gradient widths), and settlement progress ring inside BalancesView (% settled). |
| 2026-05-09 | **Auto-detect category** from description: ~150 keyword rules in `category-detect.ts` covering Indian brands (Swiggy, Zomato, Blinkit, Ola, IRCTC, BookMyShow…). User's manual chip click locks in their pick. |
| 2026-05-09 | Planning: added **Phase 2.5 — Personal Finance Tracker** section. Separate product within EasySplits for individual income/expense tracking + wealth-creation insights. Carried Receipt photos, Recurring expenses, "View balances in any currency" into a dedicated Future scope block. |
| 2026-05-09 | **Voice input** shipped: mic button via browser Web Speech API in both group + personal AddExpense. Parser handles digits + word-numbers + Indian-English ("two lakh"). 24 unit tests; hidden on Firefox. |
| 2026-05-09 | **Reminder nudges** shipped: Web Push + Vercel Cron daily (19:30 IST). `push_subscriptions` table; opt-in toggle in Group Settings; 7-day per-subscription throttle. |
| 2026-05-09 | **Subscription audit** shipped: detects recurring expense patterns (≥2 months) and surfaces them as a panel on the group page. |
| 2026-05-09 | **Polish + tests pass**: extracted `splitsFromItems` to a shared lib, added 84 unit tests across voice/category/itemized-splits, caught + fixed 4 real bugs (rs-prefix regex, residual-on-empty-sharers, generic 'subscription' keyword collision, missing 'vegetables' plural). |
| 2026-05-09 | **PFT v1.0 → v4.0 — Personal Finance Tracker shipped end-to-end** (a single day of build): |
| 2026-05-09 | ↳ v1.0 — `personal_entries` schema · tRPC CRUD · `/app/personal` dashboard · monthly summary card · top categories · transaction list · pagination |
| 2026-05-09 | ↳ v1.1 — Field-level encryption: AES-256-GCM at the application layer (swapped from the originally-locked pgcrypto for simpler Drizzle integration; same security guarantees). All amount + description columns ciphertext at rest. Honest disclosure copy. |
| 2026-05-09 | ↳ v2 — Charts panel: donut by category · 6-month monthly trend bars · in/out/invest summary. Lazy-loaded recharts. |
| 2026-05-09 | ↳ v3.0 — 5-pillar Financial Health Scorecard: Emergency · Insurance · Debt · Savings rate · Investing. India-specific rules. Onboarding wizard with locked disclaimers. |
| 2026-05-09 | ↳ v3.5 — Anomaly alerts: amber banner on /app/personal + push notification when category spend deviates >50% from rolling 6-month average. Pure-function detector with 9 unit tests. |
| 2026-05-09 | ↳ v3.6 — Age-based investing target with `retirement_age` field: glide path 0.5× at age 25 → 8× at retirement_age. Steeper for FIRE, flatter for late-career. Plus single-page wizard rebuild (replaced 4-step wizard) per UI/UX-priority feedback. |
| 2026-05-09 | ↳ v4.0 — Score trajectory + streak: `score_snapshots` table written on every Compute submit. Hero band shows delta + streak badge ("🔥 N-month green streak"). Gap-first pillars (under-15 expanded, maxed pillars collapse to chip strip). Smooth gradient area chart with green-band reference line. |
| 2026-05-09 | Microcopy alignment: encryption tagline rewritten to "🔐 Your salary is your secret. We encrypt every amount before storing — our database only ever sees scrambled text, not your numbers." consistent across dashboard + wizard. |
| 2026-05-09 | Bug fix: wizard blank fields now correctly default to 0 for has-none answers (EMI, term cover, health cover, investments, SIP, savings); income/expenses still required. Score no longer mis-reads "blank" as "haven't told us yet" when user means "I have none". |
| 2026-05-09 | **Activity feed live-update fix**: every event-writing mutation now invalidates `events.listByGroup` (and `events.listByExpense` where applicable), so the feed refreshes immediately after add/edit/delete/comment/settle without a manual F5. Five files patched. |
| 2026-05-09 | **PFT v4.4 — "Send test" notification button** shipped: bypasses the 7-day throttle + qualifying-data check so users can verify the push pipeline post-setup with one tap. Prunes 410-Gone subscriptions inline. |
| 2026-05-09 | Planning: added **Phase 2.7 — Group balances polish** for the Simplified ⇄ Pairwise toggle (default Simplified) + a "Why?" chain expander follow-up that explains the algorithm's chain. |
| 2026-05-09 | **Phase 1.I launch checks** — three real-device verifications complete: PWA install on Android Chrome ✅, PWA install on iOS Safari ✅, offline test (airplane → add expense → reconnect → sync) ✅ end-to-end. |
| 2026-05-09 | **Voice input** shipped: mic button in AddExpense via browser Web Speech API (en-IN), parser splits transcripts like "pizza six hundred" / "uber 350" into description + amount, auto-prefills the form. No API costs, hidden on Firefox. |
| 2026-05-09 | Planning: locked **Option B** (server-side field-level encryption via `pgcrypto`) for PFT sensitive columns. Added **5-pillar Financial Health Scorecard** sub-plan (Emergency / Insurance / Debt / Savings rate / Investing), India-specific rule set, onboarding wizard scope, locked disclaimers. Added **v3.5 Anomaly alerts** that piggyback on Phase 2.6 reminder-nudges infrastructure. |
| 2026-05-10 | **Goal celebration confetti** — when a financial goal flips from in-progress to completed, the dashboard fires `canvas-confetti` (lazy-loaded) once + offers a privacy-safe OG share card. |
| 2026-05-10 | **Net-worth trajectory chart** in `/app/personal/wealth` — monthly snapshots, lazy-loaded recharts area; falls back to "Take another snapshot" line until ≥2 data points. |
| 2026-05-10 | **Live demo scorecard** on the landing page — interactive 5-pillar widget with sample data, no login required. Drops bounce-from-landing. |
| 2026-05-10 | **User timezone applied everywhere** — every date formatter pulls from `profiles.timezone` (set in EditProfile) instead of browser-local. Closes a long-stored-but-unused field. |
| 2026-05-10 | **Monthly Review modal** (Spotify-Wrapped style) — animated 5-slide deck on /app/personal once per month: spend totals, top category, savings rate, score delta, biggest win. Tap → OG share card via ImageResponse. |
| 2026-05-10 | **Branded PWA icons v2.6** — gradient sweep donut with ₹ wordmark. 192 + 512 + maskable variants. Shipped via three split files (`icon.tsx`, `icon0.tsx`, `icon1.tsx`, `icon2.tsx`) after Next.js coerced numeric IDs in `generateImageMetadata`. |
| 2026-05-10 | **`<BrandMark />` component** — replaces every hand-rolled "ES" gradient badge across the app (top nav, login, empty states, footer) so the visual identity stays in sync. |
| 2026-05-10 | **Lighthouse audit on `/app/groups`**: 93 mobile perf — accepted as ship-it baseline. |
| 2026-05-10 | **Mumbai migration**: spun up new Supabase project `rnrwjocisbasoupjxeqo` in `ap-south-1` + new Vercel project `easy-split-payments` pinned to `bom1`. Converted `db/schema.sql` → `supabase/migrations/0001_init.sql` for GitHub-auto-deploy. Added `0002_disable_rls.sql` (RLS off — service-role connection). Refactored `financial_profiles` upsert to atomic `INSERT … ON CONFLICT DO UPDATE` because the 2-query Drizzle pattern failed through the transaction pooler. Production now ~10× perceived speed. |
| 2026-05-10 | **tRPC errors now logged in production** (`onError` no longer gated on `NODE_ENV !== "production"`) — surfaced the ENOTFOUND on the wrong pooler host during the Mumbai cutover. |
| 2026-05-11 | **PWA update banner** + silent-on-idle apply — service worker bumped to `v4`. New version triggers an in-app banner (`A new version is ready · Reload`) on visibility change, and applies silently after 3min of idle if the user doesn't engage. |
| 2026-05-11 | **Install-app menu item** in the user menu (permanent fallback) — surfaces Chromium's `beforeinstallprompt` when captured, falls back to a custom iOS "Add to Home Screen" sheet on Safari. Banner-dismissal nag now gated on `firstActionDone` so it never shows before user has logged a first expense / scorecard. |
| 2026-05-11 | **Group invite QR code** modal — renders the existing `/app/join/[token]` URL with `qrcode.react` (~7 KB). Mobile-to-mobile join in one scan. |
| 2026-05-11 | **Push-to-creator on join** — when a non-creator member accepts an invite token, the group creator gets a real-time Web Push ("`<name>` joined `<group>`"). |
| 2026-05-12 | **Onboarding empty states** — every "no data yet" surface gets a contextual CTA + 1-tap path: `/app/groups` → Create your first group (Trip / Roommates / Solo templates); `/app/personal` → Log your first expense; `/app/personal/wealth` → Add your first holding; scorecard → Complete in 60 seconds (with progress bar). |
| 2026-05-12 | **Goal-progress projections** — goal cards now show "At your current pace → Aug 2026" derived from the slope between snapshots. Falls back to gentle "Take another snapshot" until ≥2 data points. |
| 2026-05-12 | **Year-over-year trend card** on `/app/personal` — same-month-last-year vs this month, ±delta with badge colour. Hidden when no prior year of data. |
| 2026-05-12 | **Edit history with diffs** on every expense (and personal entry) — `<ItemHistoryModal />` renders before-after diff rows (amount, description, category, splits) per `events.expense_id` change. |
| 2026-05-12 | **Download-all-data** modal in user menu — bundles profile + groups + expenses + settlements + personal entries + score snapshots into a single JSON; runs server-side so encrypted columns decrypt before serialising. |
| 2026-05-12 | **Security: CVE-2026-44574** — bumped Next.js 16.2.4 → 16.2.6 across split-payments + portfolio + finance-site. |
| 2026-05-13 | **`<InfoTip />`** — accessible info-circle tooltip with viewport-clamped fixed positioning. Closes on outside click / Escape / scroll. Surgical placement on opaque terms across the app. Width clamps to `min(256px, calc(100vw - 24px))`. |
| 2026-05-13 | **Large-group UX hardening (7 features)** — searchable payer combobox + split picker with "Everyone / Just me / Except me" presets (≥8 members), pairwise balances filter + auto-hide zero pairs (≥12), contribution-bar cap + "Others (N)" segment (≥8 distinct), member-list search + sort (≥8), activity-feed filter chips (≥8 items), soft amber banner at 30+ members. Explicitly skipped: pagination, virtualisation, hard cap. |
| 2026-05-13 | **Search & filter across personal entries + group expenses** — debounced text search + type / category chips, persists in `?q=` / `?type=` for back-button stability. |
| 2026-05-13 | **GSC site-verification meta tag** + first 5 priority URLs indexed (`/`, `/financial-health-india`, `/calculators/trip`, `/calculators/split-bill`, `/features`). Sitemap auto-generated from `src/app/sitemap.ts`. |
| 2026-05-13 | **Auto-roll the /app/personal month picker** at midnight on month-end — `visibilitychange` listener snaps the dropdown to the new "current" if the user was viewing the previous month at the moment it became "last". 6 months history visible; year selector added when more than 12 months exist. |
| 2026-05-13 | **`/about` page restored** + footer link no longer 404s. Branded dynamic favicon (R wordmark) replaces the create-next-app default. Yandex-only Host directive stripped from `robots.txt`. |
| 2026-05-13 | **Share with friends** — personalized invite URL `?from=<firstName>` with sanitiser (latin + Devanagari + Hebrew + apostrophes/hyphens, 24-char cap). Top-of-home gradient banner + dynamic OG card (Satori-rendered, CSS-only, every div `display:flex` to satisfy ImageResponse). Web Share API → clipboard fallback. |
| 2026-05-14 | **Honest-claim audit**: `?from=` invite copy says "works offline". Group mutations honour that; personal `create/update/delete` currently bypass the queue. User chose **Option 2 — extend the queue** (over softening the copy). Started: `QueuedPath` + `ALLOWED_PATHS` + `entityKey()` extended for `personal.*` paths. Pending: wrap mutations + ship. |
| 2026-05-17 | Planning: locked **Phase 2.8 Admin panel** — single-page founder-only `/app/admin` surface gated by `ADMIN_USER_IDS` env var (no separate password — extra password = more attack surface than Google MFA). **Privacy constraint LOCKED**: aggregate-only metrics, amounts surface as buckets (`₹<100` / `₹100-500` / `₹500-2k` / `₹2k+`), no per-user financial drill-down — preserves the *"our database only ever sees scrambled text"* promise. v1 ships Pulse KPIs + 90d signups + activation funnel + activity feed; v2/v3 layered as user count grows. |
| 2026-05-17 | **Phase 2.8 Admin panel v1 shipped** — `/app/admin` route gated by `ADMIN_USER_IDS` env var. Pulse KPI tiles with inline-SVG sparklines, 90-day signups chart (lazy recharts), 6-stage activation funnel, anonymised activity feed (4-char user-id prefix, bucketed amounts). Surfaces query errors as a rose banner instead of perpetual loading. Admin link added to user menu via `profiles.me.isAdmin`. |
| 2026-05-17 | **Admin pulse perf fix**: original implementation fired 14 parallel queries against a `max:10` postgres-js pool, hitting Vercel Pro's 300s timeout. Rewrote as sequential queries each wrapped in a `safe(label, fn, fallback)` helper — single connection at a time, per-query labels in Vercel logs, partial-failure tolerant. Sub-second on current data. |
| 2026-05-17 | **Resend custom SMTP** configured for Supabase Auth — escapes the free-tier 2 emails/hour cap on the built-in SMTP. Custom magic-link + signup-confirmation email templates with EasySplits brand band. Resend free tier: 100/day, 3000/mo. Domain still pending — currently using sandbox sender (only delivers to the registered email). |
| 2026-05-17 | **Mobile bottom tab bar** for Groups / Personal finance — replaces icon-only top-header tabs that were thumb-unfriendly + ambiguous at 375px. Indigo / emerald pillar tinting on active tab, iOS safe-area-inset-bottom honored, hidden on sm+. FAB position bumped to `calc(env(safe-area-inset-bottom) + 5rem)` so the Add-expense button clears the new bar on iOS notch devices. |
| 2026-05-17 | **SW v5 cache bump** — old `_next/static/chunks/*` were sticking around in cache-first runtime cache across deploys, occasionally serving stale admin code. Version bump invalidates the v4 cache on activation, served via the existing in-page update banner + 3-min idle auto-apply. Documented stale-while-revalidate as a follow-up so future deploys don't need a manual SW dance. |
| 2026-05-17 | **Group: standalone "Record payment" CTA** + Mark-as-paid → "Log payment" rename. Server already supported arbitrary member-to-member settlements via `settlements.create`; the only UI path was the suggested-payment row, hiding pre-trip cash advances + out-of-band UPI from users. New top-of-Expenses-section button opens a portal-mounted modal: from / to / amount / backdated date / note. Closes the "the app doesn't do mid-trip transfers" mental block flagged by user testing. |
| 2026-05-17 | **Goals: interactive editing of target score + target date** — `personal.goals.update` mutation existed since v4.2 but the UI never exposed it. Pencil-icon expand panel on each in-progress goal row; inputs for target score (1–20 pillar / 1–100 total) + optional target date + clear-date affordance. Server auto-flips `completed_at` when the new target ≤ current value. |
| 2026-05-17 | **Homepage hero: dual-pillar CTA** — replaces the single "Open the app" button (which pointed only to /app/groups) with two co-equal gradient buttons: indigo "Split bills with friends" → /app/groups + emerald "Track money + scorecard" → /app/personal. Personal-finance pillar now reaches first-paint visibility instead of below-the-fold. UserMenu "Personal" → "Personal finance" for the same consistency reason. |
| 2026-05-17 | **PFT v5.3 — Bank-statement CSV import** shipped. `/app/personal/import` 3-step flow (Upload → Preview → Result) for HDFC + SBI + ICICI online-banking exports. Parsing entirely client-side; file never reaches our servers. Deterministic UUIDv5 dedup via `clientEventId` makes re-uploading the same statement a no-op. Auto-categorise via existing `category-detect.ts` + heuristic for income / expense / investment / self-transfer. Pure-TS minimal CSV parser (no `papaparse`). 31 new tests. |
| 2026-05-17 | **PFT v5.2 — EMI/Debts + amortisation** shipped end-to-end. New `personal_debts` table (migration `0003_personal_debts.sql`). Reducing-balance amortisation library (`src/lib/amortise.ts`, 24 tests) computes outstanding balance + months-to-freedom on the fly — no cron, no stored decrementing balance. tRPC `personal.debts.{list,trajectory,create,update,archive,delete}` with encrypted principal + EMI, plain rate / dates. Net worth math (`holdings.netWorth` + `recordNetWorthSnapshot`) now subtracts `totalOutstandingAt(loans, today)`. UI: new Debts card on `/wealth` with hero-tile integration, inline add/edit form with live "debt-free in Xy Xm" preview, underwater-EMI warning, per-row archive/delete. Test count: 260 → 315. |
| 2026-05-20 | Three small UX fixes spotted on mobile: (1) `disambiguateMembers()` helper suffixes `(you)` / `(guest)` / `(#abcd)` on members with colliding display names — applied at the central `rawMembers → members` boundary so split-picker / payer dropdown / balances / record-payment / member list all inherit; (2) Scorecard wizard now reads `personal.debts.list` + `personal.holdings.list` and auto-fills + locks the EMI total + investment balance fields with a 🔒 "Auto-totalled from /wealth · Edit there" hint — kills the double-entry drift between wizard and `/wealth`; (3) Mobile bottom-bar FAB overlap fixed: FAB bumped to `calc(env(safe-area-inset-bottom)+5rem)`, itemized split delete button overflow fixed (min-w-0 + shrink-0), wizard sticky CTA pushed above the new bottom nav. |
| 2026-05-20 | **14 native `confirm()` dialogs → branded `useConfirm()` hook**. Native `window.confirm()` was showing the "easy-split-payments.vercel.app says…" prefix on desktop — reads as untrusted for a finance product. New `<ConfirmProvider />` in root layout, portal-mounted modal with destructive-action variant (rose CTA + warning triangle), title + description + custom labels per call, Esc/click-outside/Enter handling. Replaced across group-detail, group-settings (3), balances-view, personal-dashboard, wealth-view (3), recurrences-card, edit-profile-modal, wealth-share-block (2). |
| 2026-05-20 | **Portfolio refresh**: dropped 2020 WordPress / WooCommerce demo project + the Coursera WordPress certificate. Added EasySplits as lead project (Next.js 16 / tRPC v11 / Drizzle / Supabase / Tailwind v4 / PWA), Rupeeful demoted to #2. |
| 2026-05-20 | **Domain `easysplits.in` purchased** (GoDaddy, ₹99 first year). DNS managed via Cloudflare (NS swap from `domaincontrol.com` → Cloudflare). Defensive auto-added records (`*._domainkey` empty, `easysplits.in` `v=spf1 -all`, strict-aligned `_dmarc p=reject`) cleaned up; replaced with proper SPF + relaxed DMARC `p=none` for warm-up. |
| 2026-05-20 | **Resend custom-domain SMTP live**. SPF + DKIM + DMARC records for `easysplits.in` verified in Resend. Magic-link UI restored via revert of `23a4d8c` (commit `e2dc549`). Supabase Sender = `noreply@easysplits.in`. |
| 2026-05-21 | **Domain migration to `easysplits.in` complete.** Vercel custom domain added; `easysplits.in` set as Primary. `easy-split-payments.vercel.app/*` now `HTTP 301` → `easysplits.in/*` for every path. `SITE.url` + all hardcoded fallbacks (OG cards footer, embed iframe template, share-blocks SSR fallbacks, attribution links) migrated in code. |
| 2026-05-21 | **GSC**: added `easysplits.in` as Domain Property, verified via DNS TXT, sitemap submitted with 12 URLs discovered. 9/10 priority URLs indexed manually via URL Inspection; `/use-cases/group-dinner` awaiting natural crawl from sitemap (was daily-quota'd). |
| 2026-05-21 | **`?from=` invite attribution** wired into admin panel. New `profiles.referred_from` column (migration `0004_profiles_referred_from.sql`), `<ReferralCapture />` on homepage writes `?from=<name>` to localStorage, `<ReferralAttacher />` in `(authed)` layout fires `profiles.attachReferrer` mutation once after sign-in. Server enforces write-once (first invite wins) + applies same sanitiser as the homepage banner. Admin panel gains a Top Referrers tile aggregating signups by referrer with cold/organic count for context. |
| 2026-05-21 | **Add-expense disabled state polished**: stronger visual on disabled (cursor-not-allowed + reduced opacity) + helper text explaining exactly why ("Add at least one line item with an amount above ₹0", "Each item needs an amount and at least one sharer", "Pick at least one person to split with"). Users no longer tap a dead button and wonder. |
| 2026-05-21 | **Force-update tier shipped** (`APP_VERSION = "1.0"` baseline). Two-tier SW release model: minor bumps (`1.0` → `1.1`) keep the existing dismissible "A new version is ready · Reload" banner; major bumps (`1.x` → `2.0`) trigger a new blocking `<ForceUpdateModal />` — rose-red full-screen, no dismiss/escape, with a 30-second auto-reload countdown for idle users. Detection: new SW reports its version via `GET_VERSION` postMessage on a `MessageChannel`; `useSwUpdate()` compares the major against the running bundle's `APP_VERSION` and routes to `updateAvailable` (banner) or `forceUpdate` (modal). First-time installs (no controller) never trigger force — would be hostile to fresh users. |
| 2026-05-21 | **SW responsiveness: SWR + visibility-triggered checks**. Replaced cache-first static-asset strategy with stale-while-revalidate (serve cached + background refetch) — removes the need to bump `CACHE_VERSION` per minor SW change. Added `visibilitychange` + `focus` listeners that call `registration.update()` (throttled to 5s) so foregrounding the PWA picks up new builds within seconds instead of waiting out the 30-min poll. |
| 2026-05-21 | **Hotfix: missing `referred_from` column in production**. `?from=` attribution work in `f600e6d` added migration `0004_profiles_referred_from.sql` but Supabase ↔ GitHub auto-deploy didn't pick it up — `profiles.me` started failing with "column does not exist" once the new server code shipped, surfacing as a broken Edit-Profile modal in the PWA (modal rendered an empty spinner backdrop). Migration applied manually via Supabase SQL Editor. **Follow-up**: investigate why GitHub auto-apply silently skipped this migration (last automatic apply was `0003` on 2026-05-17). |
| 2026-05-22 | **`?from=` attribution extended to group invite links**. Group QR/share modal now appends `?from=<firstName>` to the `/app/join/<token>` URL (sourced from `profiles.me`), and the Web-Share `text` now reads "*Pranay invited you to "Goa Trip"…*" instead of generic "*You're invited…*". `/app/join/<token>` server route preserves `?from=` through the not-signed-in → /app/login → callback redirect chain (the param was previously dropped when bouncing). `<ReferralAttacher />` extended to fall back to URL `?from=` when localStorage is empty (homepage capture still wins if present — first-write semantics preserved on server). Mounted inline in `JoinClient` because `/app/join/<token>` lives outside the `(authed)` layout where the existing attacher lives. WhatsApp-pasted invite URLs from existing users now auto-attribute their invitees in the admin Top Referrers tile. |
| 2026-05-22 | **Force-update detection fix + version reset to 1.0**. After four failed test attempts where major bumps (2.0 → 3.0 → 4.0) only fired the banner instead of the force modal on Android Chrome PWA, root cause traced to the comparison logic: detection was comparing the JS bundle's imported `APP_VERSION` against the waiting SW's version. But on Android Chrome PWA, every kill+reopen reloads the latest HTML+JS via network-first navigation — so the bundle's `APP_VERSION` always equals the waiting SW's version → comparison says "same major" → banner. Force modal was structurally unreachable for users who close and reopen the PWA between deploys. **Fix** (`3f86eb9`): query BOTH `navigator.serviceWorker.controller` (active SW, which lags one deploy until SKIP_WAITING fires) and `registration.waiting` (the new SW). Compare active's major vs waiting's major — that's the honest "what did the user previously accept" baseline. Pre-1.0 SWs without a `GET_VERSION` handler time out and are treated as major 0 so any 1.0+ waiting SW correctly counts as a force. Modal confirmed firing post-fix. Version space reset 5.0 → 1.0 to start clean. |
