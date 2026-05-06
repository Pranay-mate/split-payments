# PLANNING.md — EasySplits

> Phased roadmap. Update this and `PLANNING.html` together after every progress milestone.

**Last updated:** 2026-05-06
**Status:** All 6 decisions locked. Scaffolded + live at https://split-payments-sigma.vercel.app

**Live:** https://split-payments-sigma.vercel.app · **GitHub:** https://github.com/Pranay-mate/split-payments

---

## 0. Decisions

| # | Decision | Locked value | Rationale |
|---|---|---|---|
| 1 | API style | **tRPC + Next.js API routes hybrid** | tRPC for app-internal calls (typed everything, fast iteration). Plain API routes for: file uploads, AdSense webhooks, WhatsApp bot endpoint (Phase 3), public REST. ✅ |
| 2 | Currency | **Default INR, group creator picks currency at group creation. Multi-currency live from day 1.** | INR-first defaults but globally usable. Each group has one *primary* currency; expenses can be entered in any currency and convert to primary at spot rate at entry time. Settle-ups in primary. ✅ |
| 3 | Auth | **Google OAuth (primary) + email magic-link (fallback).** Supabase Auth handles both. | Google is one-click. Magic-link covers users without Google. No phone OTP for v1 (cost + complexity). ✅ |
| 4 | Monetization | **Free + ads.** No freemium tier in Phase 1. | User chose ads-only model. AdSense banner on dashboard + native cards in feed. **Never on add-expense screen** (trust). ✅ |
| 5 | Brand vibe | **TBD — pick whatever optimizes UI/UX + SEO.** Working assumption: light/clean + green-blue accent, mobile-first. | Final brand exploration during scaffold; will A/B color palette during landing-page build. ✅ deferred decision |
| 6 | Phase 1 scope | **Bullet list below confirmed.** ✅ User confirmed 2026-05-06. | Scaffolding starts now. |

---

## 1. Goal

Free Splitwise alternative monetised by ads, with three real wedges:

1. **Offline-first** — add expenses on a trek, sync later
2. **Mobile speed** — optimistic UI, no spinners on common actions
3. **Best-in-class SEO** — landing/features/use-case pages SSG with full JSON-LD, target #1 ranks for "expense splitting app india", "split rent calculator", "trip expense split", etc.

**Stack (locked):**
Next.js 16 App Router + TypeScript strict · tRPC + selective API routes · Supabase Postgres + Auth · Drizzle ORM · Tailwind v4 + shadcn/ui · Dexie + Service Worker for offline · Vercel hosting · Vitest tests.

---

## 2. Phase 1 — Core MVP

Target: 5–7 weeks of focused work. Multi-currency adds ~1 week to the original estimate.

### A. Auth + profile
- [ ] Google OAuth (one-click)
- [ ] Email magic-link (fallback)
- [ ] User profile (display name, avatar from Google)
- [ ] Sign-out + delete-account

### B. Groups
- [ ] Create group: name, description, **primary currency picker** (INR default, all major currencies in dropdown)
- [ ] Join group via shareable 32-byte link
- [ ] Group settings (rename, change currency, leave, kick members)
- [ ] Members list

### C. Expenses
- [ ] Add expense: payer, amount, **currency** (defaults to group primary), description, date, who-shares, split type
- [ ] Currency conversion: if expense currency ≠ group primary, fetch spot rate (free FX API) and store both `originalAmount` and `convertedAmount`
- [ ] Split types: equal · exact amounts · shares · percentages
- [ ] Edit / delete expense
- [ ] Comments per expense
- [ ] Activity feed

### D. Balances
- [ ] Per-person balance in group (in primary currency)
- [ ] Group summary (total spent, your share, you owe / are owed)
- [ ] **Simplify Payments toggle** — greedy debt-minimization algorithm
- [ ] Settle up — record payment in primary currency, marks debt closed

### E. Offline (the wedge)
- [ ] PWA manifest + install prompt
- [ ] Service Worker caches app shell
- [ ] IndexedDB via Dexie stores groups + expenses + balances
- [ ] Event queue for offline mutations
- [ ] Background Sync API replays events on reconnect
- [ ] Conflict resolution: last-write-wins by `(timestamp, userId)`

### F. Marketing site + SEO
- [ ] Landing page (`/`) with hero + feature highlights + CTA
- [ ] `/features` — detailed features
- [ ] `/use-cases` hub with use-case sub-pages: split rent, trip expenses, roommate utilities, group dinner, family budget
- [ ] `/about`, `/privacy`, `/terms`
- [ ] **All marketing pages SSG with full JSON-LD** — Organization, SoftwareApplication, BreadcrumbList, FAQPage where relevant
- [ ] `/sitemap.xml` auto-generated from registry of public routes
- [ ] `/robots.txt`
- [ ] OG cards per page
- [ ] Lighthouse 95+ on marketing pages
- [ ] Vercel Analytics + Speed Insights

### G. Ads (free-tier monetization)
- [ ] AdSense account application (apply early — fintech-adjacent rejections happen)
- [ ] Banner placement on group dashboard (lazy-loaded after balances render)
- [ ] Native cards in activity feed (every Nth row)
- [ ] **Hard rule: zero ads on add-expense / settle-up / login pages** (trust + flow)
- [ ] Ad-blocker detection optional (don't nag, just measure)

### H. Polish
- [ ] Mobile-first responsive (375px → 1280px+)
- [ ] Dark mode (auto + manual toggle)
- [ ] Empty states + error states
- [ ] Toasts for confirmations
- [ ] Skeleton loaders only where unavoidable
- [ ] OG cards + favicon + manifest

### I. Launch checks
- [ ] Lighthouse 95+ on mobile (marketing pages)
- [ ] PWA install works on Android + iOS
- [ ] Offline test: airplane mode → add expense → reconnect → sync
- [ ] Privacy policy + terms drafted
- [ ] Vercel deploy + custom domain (TBD)
- [ ] Google Search Console verification + sitemap submission

---

## 3. Phase 2 — UX wins

- [ ] Receipt photo upload (Supabase Storage; not OCR yet)
- [ ] Categories (Food, Travel, Stay, Misc, custom)
- [ ] Recurring expenses (rent, subs)
- [ ] Bulk-split: one bill across multiple line items with different splits
- [ ] Export group to CSV / PDF
- [ ] Trip mode: daily summary, per-day spend
- [ ] Historical FX rates (lock per-expense rate at entry time, not group setting)
- [ ] View balances in any currency (not just primary)

## 4. Phase 3 — Power features

- [ ] OCR receipt scanning (Google Cloud Vision free tier — 1000/mo)
- [ ] AI expense categorization (Claude Haiku — cheap)
- [ ] **WhatsApp bot integration** (Meta Cloud API — DM only, LLM parses freeform)
- [ ] Voice input
- [ ] Reminder nudges (configurable, never naggy)
- [ ] SMS UPI debit parsing

## 5. Phase 4 — Optional Pro tier (revisit)

- [ ] If ad CPMs are too low or rejected, revisit freemium
- [ ] Pro tier ₹99/yr — no ads, OCR, recurring, exports, WhatsApp bot
- [ ] Razorpay/Stripe integration for India

---

## 6. SEO strategy (locked, day-1 priority)

| Page | Type | JSON-LD | Notes |
|---|---|---|---|
| `/` | SSG | Organization + SoftwareApplication | Hero copy targets "expense splitting app india", "split bills with friends" |
| `/features` | SSG | SoftwareApplication | Long-form feature copy |
| `/use-cases/split-rent` | SSG | FAQPage + Article | Targets "how to split rent with roommates" |
| `/use-cases/trip-expenses` | SSG | FAQPage + Article | Targets "split travel expenses calculator" |
| `/use-cases/roommate-utilities` | SSG | FAQPage + Article | High-volume long-tail |
| `/use-cases/group-dinner` | SSG | FAQPage + Article | "split bill calculator india" |
| `/use-cases/family-budget` | SSG | FAQPage | Low-volume but evergreen |
| `/calculators/split-bill` | SSG | SoftwareApplication | Standalone calculator (no auth needed) — recreates Splitwise's most-searched feature as a public tool |
| `/about`, `/privacy`, `/terms` | SSG | Organization | Trust signals |
| `/app/...` | CSR + auth gate | None needed | Indexing blocked via robots.txt |

**Standalone calculators** as SEO bait:
- Split Bill Calculator (no auth — instantly usable)
- Trip Expense Splitter (drag-and-drop UI)
- Rent Split Calculator (bedroom-by-bedroom)

These give Google something to rank without forcing signup.

---

## 7. Risks / open technical questions

| Risk | Mitigation |
|---|---|
| AdSense rejection for fintech | Apply early. If rejected: switch to direct affiliate (Cred / Niyo / Jupiter cards) or revisit freemium |
| Multi-currency adds Phase 1 complexity | Use a free FX API (open.er-api.com or exchangerate.host); store rate at entry time only |
| Offline conflict edge cases | Event sourcing + tombstones; tests for known races |
| Supabase free tier limits at scale | Monitor; $25/mo Pro at first warning |
| iOS PWA background-sync flakiness | Detect iOS, fall back to "sync on app open" with clear UX |
| Simplify-payments correctness | Property-based tests (balances sum to zero pre + post) |
| SEO competition (Splitwise, Tricount, Splid) | Lean into India-first defaults + offline + multi-currency UX wins. Can't beat their domain authority on "expense split" but can win "expense split app india" |

---

## 8. Day-1 setup checklist (after #6 locks)

- [ ] `pnpm create next-app@latest split-payments` (TS + Tailwind + App Router)
- [ ] Set up Supabase project + connection string in `.env.local`
- [ ] Drizzle schema: users, groups, group_members, expenses, splits, settlements, events, currencies
- [ ] tRPC routers: auth, groups, expenses, settlements, sync
- [ ] Plain API routes: `/api/upload`, `/api/webhook/whatsapp` (Phase 3 scaffold), `/api/og/[slug]`
- [ ] shadcn/ui primitives: button, input, dialog, sheet, toast, avatar, select, tabs
- [ ] PWA manifest + service worker scaffold (Workbox)
- [ ] Vercel project link + first deploy of empty shell
- [ ] AGENTS.md + PLANNING.md + PLANNING.html in repo root
- [ ] First commit, push, verify deploy

---

## Milestone log

| Date | Milestone |
|---|---|
| 2026-05-06 | Project initialised. Decisions 1-5 locked: tRPC hybrid, multi-currency day 1, Google + magic-link, free + ads, brand TBD. Phase 1 scope (#6) pending confirmation. |
| 2026-05-06 | Phase 1 scope confirmed. All 6 decisions locked. |
| 2026-05-06 | Scaffolded Next.js 16 + Tailwind v4 + TS. Pushed to github.com/Pranay-mate/split-payments. |
| 2026-05-06 | Branded landing placeholder live (indigo→violet→emerald gradient hero, 6 feature pillars, dark mode). Vercel Analytics + Speed Insights wired. Live at https://split-payments-sigma.vercel.app |
| 2026-05-06 | SEO infrastructure shipped: seo.ts + jsonld.ts helpers, sitemap.ts, robots.ts. Standalone Split Bill Calculator at /calculators/split-bill (works offline, no auth) with 4 JSON-LD blocks. Home CTA points to it. |
| 2026-05-06 | UX refinement: simplified Split Bill Calculator — tip is now optional ₹ amount (not %), removed extra service charge field, removed rounding-mode toggle (always rounds up to whole rupees). |
| 2026-05-06 | PWA scaffold: manifest.ts (Next.js native), dynamic gradient ES icons (64×64 + 180×180 for iOS), hand-rolled service worker (network-first navigations, cache-first assets), client-side SW registration in production only. Site is now installable + works offline after first visit. |
