import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/user-menu";

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
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/app/groups"
            className="flex items-center gap-2"
            aria-label="EasySplits"
          >
            <span
              className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 text-xs font-bold text-white shadow-sm"
              aria-hidden
            >
              ES
            </span>
            <span className="text-base font-semibold tracking-tight">
              EasySplits
            </span>
          </Link>
          <UserMenu />
        </div>
      </header>
      {children}
    </>
  );
}
