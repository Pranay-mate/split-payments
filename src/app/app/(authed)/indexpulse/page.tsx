import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdmin } from "@/server/admin-auth";
import { IndexPulseDashboard } from "./_components/indexpulse-dashboard";

export const metadata = {
  title: "IndexPulse",
  robots: { index: false, follow: false },
};

/**
 * IndexPulse — admin-only. Lists Indian index funds + ETFs with live
 * price/NAV and lets the admin set price alerts.
 *
 * Two-layer gate (same pattern as /app/admin):
 *   1. Parent (authed) layout requires a signed-in Supabase user.
 *   2. This page additionally requires the user's id in ADMIN_USER_IDS.
 * Non-admins are bounced to their normal landing surface (no URL leak).
 */
export default async function IndexPulsePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.id)) redirect("/app/groups");
  return <IndexPulseDashboard />;
}
