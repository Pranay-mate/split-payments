"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { UploadStep } from "./upload-step";
import { PreviewStep } from "./preview-step";
import { ResultStep } from "./result-step";
import type { ParseResult } from "@/lib/bank-parsers/types";

export type ImportPhase =
  | { kind: "upload" }
  | { kind: "preview"; parsed: ParseResult; filename: string }
  | { kind: "result"; imported: number; skipped: number; failed: number };

export function ImportFlow() {
  const [phase, setPhase] = useState<ImportPhase>({ kind: "upload" });

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <header className="space-y-1">
        <Link
          href="/app/personal"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to Personal
          finance
        </Link>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Import from bank
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Upload your HDFC / SBI / ICICI CSV statement — we&apos;ll parse it
          on your device and let you pick which transactions to import.
        </p>
      </header>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
        <Lock
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400"
          aria-hidden
        />
        <p className="text-[11.5px] leading-relaxed text-amber-900 dark:text-amber-200">
          <strong>Privacy:</strong> the file is parsed in your browser and
          never uploaded. Only the transactions you confirm get saved to
          your encrypted entries — same as if you typed them in manually.
        </p>
      </div>

      {phase.kind === "upload" && (
        <UploadStep
          onParsed={(parsed, filename) =>
            setPhase({ kind: "preview", parsed, filename })
          }
        />
      )}
      {phase.kind === "preview" && (
        <PreviewStep
          parsed={phase.parsed}
          filename={phase.filename}
          onCancel={() => setPhase({ kind: "upload" })}
          onComplete={(imported, skipped, failed) =>
            setPhase({ kind: "result", imported, skipped, failed })
          }
        />
      )}
      {phase.kind === "result" && (
        <ResultStep
          imported={phase.imported}
          skipped={phase.skipped}
          failed={phase.failed}
          onAnother={() => setPhase({ kind: "upload" })}
        />
      )}
    </main>
  );
}
