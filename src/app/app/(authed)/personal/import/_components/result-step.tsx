"use client";

import Link from "next/link";
import { CheckCircle2, Upload } from "lucide-react";

export function ResultStep({
  imported,
  skipped,
  failed,
  onAnother,
}: {
  imported: number;
  skipped: number;
  failed: number;
  onAnother: () => void;
}) {
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
        <CheckCircle2 className="h-7 w-7" aria-hidden />
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">
        Imported {imported.toLocaleString("en-IN")} transactions
      </h2>
      <p className="mt-1 text-[12.5px] text-slate-600 dark:text-slate-300">
        {skipped > 0 && (
          <span>
            {skipped} skipped (you unticked them or they looked like
            self-transfers).{" "}
          </span>
        )}
        {failed > 0 && (
          <span className="text-rose-600 dark:text-rose-400">
            {failed} failed to save — retry import or check Vercel logs.{" "}
          </span>
        )}
        Encrypted at rest, same as anything you type in.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/app/personal"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
        >
          Back to Personal finance
        </Link>
        <button
          type="button"
          onClick={onAnother}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden /> Import another
        </button>
      </div>
    </section>
  );
}
