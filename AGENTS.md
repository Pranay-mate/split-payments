# AGENTS.md — EasySplits (split-payments)

> Locked rules for this project. Read this **before** writing any code.
> Update only if a rule has been explicitly re-discussed and changed.

## What this project is

**EasySplits** — a free expense-splitting webapp (Splitwise alternative). Users add shared expenses, the app splits them, and shows balances. Optimised for mobile, India-first, with **offline mode** as a core differentiator.

- Folder: `/Users/pranay/hudle-clones/learning/split-payments/`
- Brand: EasySplits
- Live URL: TBD (Vercel after first deploy)
- Status: **Planning phase — no code yet.** Decisions tracked in `PLANNING.md`.

## Stack (recommended; final lock pending)

| Layer | Tech | Why |
|---|---|---|
| Frontend + API | Next.js 16 (App Router) + TypeScript strict | One repo, edge-deployable, matches Rupeeful conventions |
| API style | tRPC | End-to-end type safety, zero contract drift |
| Database | Supabase (Postgres) | Free 500MB, transactions for financial data |
| Auth | Supabase Auth | Magic-link + Google OAuth out of the box |
| ORM | Drizzle | Lightweight, edge-compatible, type-safe |
| Offline storage | IndexedDB via Dexie.js | Battle-tested, structured |
| Sync | Service Worker + Background Sync API + event sourcing | Trekking/no-network use case must work |
| Tests | Vitest + Testing Library | Same as Rupeeful |
| Styling | Tailwind v4 + shadcn/ui | Same as Rupeeful |
| Hosting | Vercel | Free tier, no cold starts |

**Cost projection:** ₹0/month at <5k users. Past that, Supabase Pro is $25/mo at 8GB.

## Hard rules

1. **TypeScript strict mode**, no `any` without explicit `// eslint-disable-next-line` + reason.
2. **Mobile-first**: every screen designed for 375px width first; desktop is a wider variant.
3. **Optimistic UI**: no loading spinners on add/edit/delete in core flows. Mutations apply locally first, sync in background.
4. **Offline must work end-to-end** in Phase 1 — not bolted on later. Adding an expense in airplane mode must succeed.
5. **No financial calculation drift**: balance math runs client-side AND server-side; results must match to the rupee.
6. **Tests for split logic + simplify-payments algorithm are mandatory**; UI tests are nice-to-have.
7. **No analytics on financial inputs**. Only page views + button clicks. Never log expense amounts or descriptions.
8. **No third-party JS that touches DOM during transactions**. AdSense (if used) must be lazy-loaded after balance views, never on the add-expense screen.

## Folder structure (proposed)

```
src/
  app/                    Next.js App Router pages
    (marketing)/          Landing, pricing, about
    (app)/                Authenticated app
      groups/[id]/        Group detail
      expenses/           Expense CRUD
      settle/             Settle-up flow
    api/trpc/[...trpc]/   tRPC entry
  components/
    ui/                   shadcn primitives
    expense/              Expense-related components
    group/                Group-related components
  lib/
    split/                Split algorithms (equal/exact/share/percent)
    simplify/             Debt-minimization algorithm
    sync/                 Offline event queue + sync engine
    db/                   Drizzle schema + queries
    trpc/                 tRPC routers
  hooks/                  React hooks
  workers/                Service worker source
PLANNING.md               Phase tracker + decisions
PLANNING.html             Visual version (must stay in sync)
AGENTS.md                 This file
```

## Sync rule (AUTO — always do without asking)

`PLANNING.md` and `PLANNING.html` must be kept in sync after **any** progress update. The HTML version is what the user reads — it has status badges and progress bars. Same convention as Rupeeful's PLANNING + the Hudle insurance docs.

## Privacy commitments (these must hold)

- No selling user data, ever.
- No third-party trackers beyond Vercel Analytics (no GA, no Mixpanel, no Hotjar).
- Server logs purge expense descriptions/amounts within 30 days.
- Group invite links are unguessable (32-byte random) and can be revoked.

## Things explicitly **not** in scope

- Cryptocurrency expenses
- Bank account linking / Plaid-style aggregation (regulatory mess in India)
- Tax filing or financial advice
- Direct UPI payments through the app (just record-keeping)
