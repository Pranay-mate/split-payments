# PLANNING.md — EasySplits

> Phased roadmap with **per-task status**. Updated as we ship. PLANNING.html mirrors this — keep them in sync.

**Last updated:** 2026-05-09 (latest push)
**Live:** https://split-payments-sigma.vercel.app · **GitHub:** https://github.com/Pranay-mate/split-payments

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
| PWA install works on Android Chrome | 🟡 (needs manual verify) |
| PWA install works on iOS Safari | 🟡 (needs manual verify) |
| Offline test: airplane mode → add expense → reconnect | 🟡 (works for calculator) |
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

### Out of scope (decided no)

> Explicit "no" decisions. Captured so we don't re-propose these in future
> planning sessions.

| Task | Why no |
|---|---|
| View balances in any currency (not just primary) | Decided not needed (2026-05-09). Group's primary currency is sufficient — international-member case is too rare to justify the FX-display complexity, settle-up two-currency UX, and "yesterday it said $50.10, today $50.40" drift confusion. |

---

## Phase 2.5 — Personal Finance Tracker (planned)

> A second product inside EasySplits: track *your own* monthly income +
> expenses + investments, separately from the group splitting. Insights
> about spending patterns + wealth creation. Reuses existing categories,
> charts, and offline-queue infrastructure.

### Locked decisions

| # | Decision | Locked value (2026-05-09) |
|---|---|---|
| 1 | **Encryption** | **Option B — server-side field-level via `pgcrypto.PGP_SYM_ENCRYPT/DECRYPT`** with key in `SUPABASE_SECRET_KEY`. Sensitive columns (income, savings, insurance, debt, term cover, etc.) stored as ciphertext; server holds the key and decrypts when needed for scoring/analytics/exports. Trade-off: protects against DB breaches + Supabase staff + SQL injection exfiltration, but **the developer can read all user data** for product features. Industry-standard for fintechs. Not E2EE. |
| 2 | **Honest copy** | Onboarding text says: *"Encrypted at the field level. Our database hosting provider can't read your data. We use it to compute your score and show you analytics. We never sell or share it with anyone."* — every word verifiable. **Never** claim "even we can't read it" (that's option C / E2EE territory). |
| 3 | **Privacy isolation** | Each user sees only their own entries (server filters by `ctx.user.id` in every query). No sharing, no cross-user views, no leak via groupId. |
| 4 | **Score ↔ score logic** | Lives server-side (depends on decrypted values). Cannot move to E2EE without rewriting score logic to run client-side, which would also kill peer comparison forever. |

### Data model (proposed)

| Table | Purpose | Status |
|---|---|---|
| `personal_entries` | user_id · type (income/expense/investment) · amount · currency · category · occurred_at · note · recurring_id? | ⬜ |
| `personal_recurrences` | user_id · kind (salary/rent/sip/etc.) · schedule · next_due · amount · category | ⬜ |
| `personal_holdings` (optional) | mutual fund / FD / stock positions: symbol/AMC · units · NAV-as-of | ⬜ Phase 3 candidate |
| Reuse existing `profiles` + `categories` (extend with Income, Investment, Tax) | | ⬜ |

### Routes + UI (proposed)

| Route | Purpose | Status |
|---|---|---|
| `/app/personal` | Dashboard: this month's spend vs income, savings rate, top categories | ⬜ |
| `/app/personal/transactions` | Full ledger, monthly grouping, filters by category/type | ⬜ |
| `/app/personal/insights` | Auto-generated narratives ("food up 35% MoM", "savings rate 22%"), goal tracking | ⬜ |
| `/app/personal/wealth` | Net-worth tracker, investment positions, growth chart | ⬜ Phase 3 candidate |

### Insights to surface (planned)

- Monthly summary card — income · expenses · savings · savings %
- Category drift — "Food spending +35% vs 6-month avg"
- Recurring-vs-discretionary split (rent + bills + subs vs everything else)
- Wealth trajectory — net-worth chart, savings goal progress *(Phase 3 candidate)*
- Smart nudges — "You'd hit your goal 4mo earlier if you cut Entertainment by 20%" *(LLM-driven, Phase 3)*

### Reused infra (free wins)

- Categories (extend with Income / Investment / Tax) — already shipped
- Recharts panel (donut · area · bars) — already shipped
- CSV / PDF export — already shipped
- Offline queue + clientEventId idempotency — already shipped
- Auto-detect category (~150 keyword rules) — already shipped

**Effort:** ~2 weeks for v1 (transactions + dashboard + monthly insights). Wealth tracking is a separate Phase 3 push.

### v3 — Financial Health Scorecard (planned)

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
| 2026-05-09 | **Voice input** shipped: mic button in AddExpense via browser Web Speech API (en-IN), parser splits transcripts like "pizza six hundred" / "uber 350" into description + amount, auto-prefills the form. No API costs, hidden on Firefox. |
| 2026-05-09 | Planning: locked **Option B** (server-side field-level encryption via `pgcrypto`) for PFT sensitive columns. Added **5-pillar Financial Health Scorecard** sub-plan (Emergency / Insurance / Debt / Savings rate / Investing), India-specific rule set, onboarding wizard scope, locked disclaimers. Added **v3.5 Anomaly alerts** that piggyback on Phase 2.6 reminder-nudges infrastructure. |
