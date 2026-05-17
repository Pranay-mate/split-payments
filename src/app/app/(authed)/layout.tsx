import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/user-menu";
import { GroupSwitcher } from "@/components/group-switcher";
import { TopNavTabs } from "@/components/top-nav-tabs";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

/**
 * Auth gate for everything under /app/(authed)/. Redirects to /app/login
 * with a `next` param so users come back where they were after signing in.
 */
export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-slate-800/80 dark:bg-slate-950/80 dark:supports-[backdrop-filter]:bg-slate-950/70">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <GroupSwitcher />
          {/* Desktop-only — mobile uses <MobileBottomNav /> below */}
          <div className="hidden sm:block">
            <TopNavTabs />
          </div>
          <UserMenu />
        </div>
      </header>
      {/* pb-20 on mobile leaves room for the fixed bottom tab bar so the
          last bit of page content isn't covered. */}
      <div className="pb-20 sm:pb-0">{children}</div>
      <MobileBottomNav />
    </>
  );
}
