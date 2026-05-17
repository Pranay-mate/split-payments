import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdmin } from "@/server/admin-auth";
import { AdminDashboard } from "./_components/admin-dashboard";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * Founder-only observability surface. Auth gate is two-layered:
 *   1. Parent (authed) layout requires a signed-in Supabase user.
 *   2. This page additionally requires the user's id to be in the
 *      ADMIN_USER_IDS env var allow-list.
 *
 * Non-admins are bounced to /app/groups (no 403, no admin URL surface
 * leak — they just see their normal landing surface).
 */
export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.id)) redirect("/app/groups");
  return <AdminDashboard />;
}
