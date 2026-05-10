import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";

/**
 * 404 for invalid / revoked / expired wealth-share tokens. Replaces
 * Next's default minimal 404 (which can look like a blank page in
 * production builds — confused some early users).
 */
export default function WealthShareNotFound() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <Lock className="h-10 w-10 text-slate-300 dark:text-slate-700" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        This share link doesn&apos;t exist
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Either the link was rotated, sharing was disabled, or the URL was
        copied incorrectly. Ask the owner for a fresh link.
      </p>
      <Link
        href="/use-cases/financial-health-india"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        Get your own free score on EasySplits
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </main>
  );
}
