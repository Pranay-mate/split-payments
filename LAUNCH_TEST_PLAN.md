# Pre-launch manual test plan — EasySplits

Run through this on your **Samsung S21 FE (Chrome)** as the primary device. Anything marked **[2-device]** needs a second account on a laptop or your friend's phone. Estimated: 60–90 min for a full pass.

If a step fails → screenshot, paste the URL, note the device, ping it back.

---

## 0. Setup (one-time)

- [ ] Hard-reload the app on the test device once. Address bar → tap reload → "Hard reload" (Chrome will fetch the new shell + SW). Confirm the SwUpdateBanner does NOT appear after that, meaning you're on v1.1.
- [ ] Open DevTools or Chrome Lighthouse if you can — useful when you spot something weird.
- [ ] Have a second Gmail/Apple account ready for the 2-device flows (or borrow a friend for 5 min).

---

## 1. Auth

- [ ] **Sign out → sign in via magic link.** Confirm: lands on `/app/groups` after click, not localhost, not the supabase domain. (We fixed both earlier; verify they stick.)
- [ ] **Sign in via Google.** Confirm OAuth screen shows "EasySplits" + logo, not "supabase.co". Lands on `/app/groups` after consent.
- [ ] **Refresh while signed in.** No flash of login redirect; you stay on the page you were on.

---

## 2. Groups list (`/app/groups`)

- [ ] Page header reads "Your groups" — no long subtitle paragraph.
- [ ] **5 active groups** count chip matches the list below.
- [ ] Each group card shows balance label ("All settled" / "You're owed ₹X" / "You owe ₹X") in the right tone (slate / emerald / rose).
- [ ] Tap a group card → lands on group detail (NOT the AddExpense form). Tap should feel like one tap, no extra scroll needed.
- [ ] **FAB at bottom-right** has "Add expense" label visible on phone (not just `+`).
- [ ] Tap FAB:
  - With 1 active group → straight to that group's AddExpense modal opening.
  - With 2+ active groups → bottom-sheet picker. Each row shows balance ("You owe ₹500" etc.). Tap a row → AddExpense modal opens in that group.
- [ ] **New group**: tap "+ New group" → form appears. Create one with a template ("Trip"), confirm it appears at the top of the active list.
- [ ] **Archive a group** from Settings (header gear in the group detail), then come back → group moves to "Archived · N" section, expand to see it.
- [ ] **Window focus refetch**: switch to another tab/Slack for 30s, switch back → balances should be fresh (no stale data).

---

## 3. Group detail (`/app/groups/[id]`)

### Balances section

- [ ] If no settlements logged yet: settlement ring is **hidden**, headline reads "Balances · ₹X to settle across the group". No "0%".
- [ ] Per-person bars show correct +X/-X amounts and emerald/rose color.
- [ ] **Fractional rendering**: add an expense like ₹399 ÷ 2 — confirm balances show ₹199.50 / ₹199.50, NOT ₹200 / ₹200.

### Suggested payments

- [ ] Section is **collapsed by default** with "N transfers to settle the group" subtitle.
- [ ] Tap any part of the collapsed card (header padding, title, chevron) → expands.
- [ ] Inside: Simplified / Pairwise toggle works. Tap a "Log payment" button → settlement gets recorded, suggested-payments list updates, settlement ring appears with progress %.
- [ ] Chevron-up in expanded header collapses back.

### Past settlements

- [ ] Section is collapsed showing "Past settlements · N".
- [ ] Tap anywhere on the header row → expands list.
- [ ] Trash icon on each row → confirms, then removes settlement, and Suggested payments re-opens for that pair.

### Expenses section

- [ ] Header shows `🧾 Expenses · [Payment]` on phone — NO wrapped "Add expense" pill in the header.
- [ ] FAB at bottom-right is the only Add Expense entry on phone.
- [ ] Recent / By day toggle works.
- [ ] Search filter on expense list works.
- [ ] Tap pencil on an expense row → AddExpense modal opens **pre-filled** with that expense's data. Edit, save → confirm row updates inline.
- [ ] Tap trash → confirm dialog → row removed, balances update.

### AddExpense modal (the load-bearing form)

Open via FAB. Cover every split mode:

- [ ] **Modal opens as bottom sheet** on phone. Form visible WITHOUT scrolling. X button + backdrop tap + ESC all close.
- [ ] Description + amount input visible. Below: a single "Paid by you · Equal split · 🍽️ Food · 3/3" summary chip.
- [ ] Type description → category auto-detects (e.g. "pizza" → Food).
- [ ] **Equal split**: leave defaults, enter amount, save → expense appears, balance bars update.
- [ ] **Exact split**: tap summary chip → expand → switch to Exact. With 4 sharers selected:
  - [ ] Type ₹200 for sharer A. Tap **Auto-balance** → A stays at 200, others get ~₹133.33 each. Total = your amount.
  - [ ] Now bump A to ₹250 → "delta +50 off" shows. Tap Auto-balance → A stays at 250, others get less. Verify total matches amount.
  - [ ] Save → expense saves; balances are correct (the person who paid is owed exactly the others' shares).
- [ ] **Itemized**: switch to Itemized mode. Add 2 line items with different sharer sets. Total below shows sum. Save → confirm splits are correct.
- [ ] **Voice input**: tap mic, say "uber 350" → description and amount populate. (Web Speech requires permission first time.)
- [ ] **Currency**: change currency dropdown to USD. With amount > 0, FX preview shows "≈ ₹X (1 USD = ₹Y)". Save → expense stores in USD, balance display still uses group's primary currency.

### Charts

- [ ] Charts section collapsed by default. Tap header → expands. Donut + Biggest expenses + Who's paying all render.
- [ ] **Long-press any chart** — no white box / image preview / copy-share toolbar appears. (The bug we fixed yesterday.)

### Who paid

- [ ] Collapsed by default. Tap header → stacked bar appears with per-payer breakdown.

### Activity

- [ ] Collapsed by default. Tap header → activity feed renders. Filter chips (Expenses / Settlements / Members / Comments) work. "View all N" button toggles full list.

### Members

- [ ] Collapsed by default with member count. Tap header → chips appear.
- [ ] **"Manage members"** button at the bottom of the expanded card → opens Settings sheet directly. No need to scroll back to the gear icon.

### Group Settings (header gear)

- [ ] Settings sheet opens. **Keyboard does NOT auto-pop** for the Group name field. Tap the field → keyboard appears.
- [ ] Member management: add a guest (e.g. "Roomie"), confirm shows up with amber "guest" badge. Generate a claim link for them.
- [ ] Rename the group → confirm header updates.

### Record Payment modal

- [ ] Open from "Payment" button in Expenses header. Modal opens.
- [ ] Default state: From = you, To = first other member, Date and Note collapsed behind a "Today · No note" summary chip.
- [ ] Submit a payment between two members → confirm appears in Suggested payments + Past settlements (or rather, reduces a debt).

---

## 4. Personal finance (`/app/personal`)

- [ ] Header is compact: "Personal finance" + small 🔐 Encrypted chip. No 4-line paragraph.
- [ ] Month picker on the right; on narrow widths drops to its own row, h1 doesn't wrap.
- [ ] **Net worth tile** is visually prominent (gradient icon swatch + headline + chevron). Tap → `/app/personal/wealth`.
- [ ] **Import CSV** is a small utility chip next to Net worth. Tap → import page.
- [ ] **Hero KPI** ("Net this month") sub-stats are flat (no tinted-pill backgrounds suggesting tap-ability).

### AddPersonalEntry modal

- [ ] Open via FAB. Bottom sheet on phone.
- [ ] Type toggle (Income / Expense / Investment) visible.
- [ ] Description + amount visible. Category + date collapsed behind a "💸 Other · Today" summary chip.
- [ ] Tap chip → expand category chips + date picker + "Make recurring" toggle.
- [ ] Add an entry → appears in the list below, hero KPI updates.
- [ ] Edit an existing entry (pencil) → modal opens **pre-filled**.
- [ ] Delete an entry → confirm dialog → row removed, KPI updates.

### Month picker

- [ ] Drop-down shows **12 months including future-empty ones**. Pick a month with no data → page renders with "No entries" state.

### Scorecard, Goals, Top categories, Yearly trend, Recurrences

- [ ] All sections render without console errors.
- [ ] **Long-press any chart** in any of these sections — no white box / image preview.

---

## 5. Wealth (`/app/personal/wealth`)

- [ ] Net-worth headline + trajectory chart render.
- [ ] **Add Holding**: opens an inline form (not modal). Name + Type + Current value visible. "Add units, avg cost, notes" expand chip works.
- [ ] **Add Debt**: opens inline form. Punch in real home/car loan numbers — verify months-to-freedom math reads sane.
- [ ] **Small Savings Schemes** panel renders.
- [ ] Trajectory chart: long-press → no white box.

---

## 6. Mobile-specific behaviors

- [ ] Bottom tab bar (Groups / Personal finance) sticky on every page, highlights current tab.
- [ ] **No section's last item is hidden under the FAB.** Scroll to the bottom of group detail / personal — Members chevron etc. should be clearly tappable.
- [ ] Service worker update: bump APP_VERSION manually (skip; just confirm the SwUpdateBanner appeared once when you hard-reloaded after the v1.1 bump).
- [ ] **Offline**: turn airplane mode on. Add an expense — should queue + show optimistic. Toggle back → queued mutation replays, no duplicates.

---

## 7. 2-device flows

These need a second account.

- [ ] **[2-device]** Invite a friend to a group via the QR/link. They sign in, accept invite → appear in members. Both devices see them in real-ish time (refresh if needed).
- [ ] **[2-device]** Friend adds an expense. Both devices see the new expense + updated balances after window-focus refetch (~30s stale time, or hard refresh).
- [ ] **[2-device]** Friend logs a settlement to you. Push notification arrives on your device. Balance updates.
- [ ] **[2-device]** **Creator-only UI**: as a non-creator, confirm "Remove member" / "Delete group" / "Claim" buttons are hidden in Settings. As creator, confirm they're visible.

---

## 8. Bank CSV import (#132)

- [ ] Open `/app/personal/import`.
- [ ] Upload a real HDFC / SBI / ICICI CSV.
- [ ] Preview step shows correctly-parsed rows (description, amount, type detection income/expense).
- [ ] Confirm → entries appear in the month.
- [ ] Edge: malformed row → error visible, doesn't crash. Multi-month CSV → all months get rows.

---

## 9. EMI / Debts (#133)

- [ ] Add a real home loan. Months-to-freedom math should match an online amortisation calculator within rounding.
- [ ] Bump principal — months-left updates live in the preview.
- [ ] Save → debt appears on /wealth; net-worth picks up the new liability.

---

## 10. Cross-browser sanity (best-effort)

- [ ] Open the live URL in Safari iOS (if you have an iPhone nearby). Same checks as #2 + #3 (don't repeat the full plan).
- [ ] Open in desktop Chrome at 375px width → confirm group-detail layout doesn't break.

---

## Sign-off checklist

- [ ] All boxes above ticked OR the unchecked items have a documented decision ("known issue, post-launch")
- [ ] `/app/admin` Launch-pulse tile renders without errors
- [ ] One real expense and one real settlement logged in a real group end-to-end without surprises
- [ ] No console errors during the pass (or any errors are pre-known)

When this is done you're ready for **Tue 2026-06-02 12:31 PM IST**.
