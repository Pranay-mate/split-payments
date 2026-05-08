# PLANNING.md — EasySplits

> Phased roadmap with **per-task status**. Updated as we ship. PLANNING.html mirrors this — keep them in sync.

**Last updated:** 2026-05-07
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
| Delete account | ⬜ |

### Phase 1.B — Groups

| Task | Status |
|---|---|
| Create group (name, primary currency picker) | ✅ |
| Join group via shareable 32-byte link | ✅ (`/app/join/[token]`) |
| Group settings (rename, change currency) | ⬜ |
| Leave group / kick members | ⬜ |
| Members list | ✅ |

### Phase 1.C — Expenses

| Task | Status |
|---|---|
| Add expense (payer, amount, currency, date, who-shares) | ✅ |
| FX conversion at entry time (free FX API) | ✅ (open.er-api.com, server-side validated, 6h cache) |
| Split modes: equal · exact · share · percent | 🟡 (equal + exact done; share + percent reserved in enum) |
| Edit expense | ✅ (Pencil icon → form prefills → Save changes) |
| Delete expense | ✅ |
| Comments per expense | ⬜ |
| Activity feed | ⬜ |

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
| Offline test (airplane mode → add expense → reconnect → sync) | 🟡 (works in calculator; full app sync pending) |
| Offline event queue for app mutations | ⬜ (Phase 1.E proper, after Supabase) |
| Background Sync API on reconnect | ⬜ |
| Conflict resolution (last-write-wins by timestamp+userId) | ⬜ |

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

| Task | Status |
|---|---|
| Receipt photo upload (Supabase Storage) | ⏸ |
| Categories (Food, Travel, Stay, Misc, custom) | ⏸ |
| **Charts & visualisations** (Recharts; UX principles below) | ⏸ |
| ↳ Per-member contribution bar at top of group page | ⏸ |
| ↳ Balance bars (green = gets · red = owes) replacing text rows | ⏸ |
| ↳ Settlement progress ring ("65% settled") | ⏸ |
| ↳ Spend-by-category donut (depends on Categories) | ⏸ |
| ↳ Daily-spend sparkline (depends on Trip mode) | ⏸ |
| Recurring expenses (rent, subs) | ⏸ |
| Bulk-split: one bill across multiple line items | ⏸ |
| Export group to CSV / PDF | ⏸ |
| Trip mode: daily summary, per-day spend | ⏸ |
| Historical FX rates (lock per-expense at entry) | ✅ done in 1.C |
| View balances in any currency (not just primary) | ⏸ |

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

## Phase 3 — Power features

| Task | Status |
|---|---|
| OCR receipt scanning (Google Cloud Vision) | ⏸ |
| AI categorization (Claude Haiku) | ⏸ |
| WhatsApp bot (Meta Cloud API, DM only) | ⏸ |
| Voice input | ⏸ |
| Reminder nudges (configurable) | ⏸ |
| SMS UPI debit parsing | ⏸ |

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
