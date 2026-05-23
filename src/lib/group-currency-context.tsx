"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Group-scoped currency context. Provides the active group's
 * `primaryCurrency` (ISO code) to all descendants so they don't have to
 * prop-drill it through every child component when rendering amounts.
 *
 * Pre-context, the whole group view rendered ₹ even on USD/EUR groups
 * because `formatINR` was hardcoded. The migration to currency-aware
 * formatting touches 8+ components — context is much cleaner than
 * threading a `primaryCurrency` prop into BalancesView, GroupCharts,
 * ContributionBar, ItemHistoryModal, SubscriptionAudit, etc.
 *
 * Outside a Provider, defaults to "INR" so callers don't need to handle
 * undefined. That keeps personal-finance views (which don't wrap with
 * this provider) safe — they're always rupees by design.
 */
const GroupCurrencyContext = createContext<string>("INR");

export function GroupCurrencyProvider({
  currency,
  children,
}: {
  currency: string;
  children: ReactNode;
}) {
  return (
    <GroupCurrencyContext.Provider value={currency || "INR"}>
      {children}
    </GroupCurrencyContext.Provider>
  );
}

export function useGroupCurrency(): string {
  return useContext(GroupCurrencyContext);
}
