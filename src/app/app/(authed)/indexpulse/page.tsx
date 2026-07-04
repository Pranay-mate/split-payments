import { IndexPulseDashboard } from "./_components/indexpulse-dashboard";

export const metadata = {
  title: "IndexPulse",
  robots: { index: false, follow: false },
};

/**
 * IndexPulse — available to any signed-in user. Lists Indian index funds +
 * ETFs with live price/NAV and lets you set price alerts.
 *
 * Auth is handled by the parent (authed) layout, which redirects anonymous
 * visitors to /app/login. No admin gate — the tRPC router uses
 * protectedProcedure and scopes all alerts to the caller's user id.
 */
export default function IndexPulsePage() {
  return <IndexPulseDashboard />;
}
