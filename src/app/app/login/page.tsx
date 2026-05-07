import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildMetadata } from "@/lib/seo";
import { LoginForm } from "./_components/login-form";

export const metadata: Metadata = buildMetadata({
  title: "Sign in",
  description: "Sign in to EasySplits — track shared expenses with friends.",
  path: "/app/login",
  noIndex: true,
});

type SearchParams = Promise<{ error?: string; next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already signed in → skip the page
  if (user) redirect("/app/groups");

  const { error, next } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <span
            className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 text-base font-bold text-white shadow-md"
            aria-hidden
          >
            ES
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            Sign in to EasySplits
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            One tap with Google, or get a magic link by email.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <LoginForm initialError={error} next={next} />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          By signing in you agree to our{" "}
          <a href="/terms" className="underline hover:text-slate-700 dark:hover:text-slate-200">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline hover:text-slate-700 dark:hover:text-slate-200">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </main>
  );
}
