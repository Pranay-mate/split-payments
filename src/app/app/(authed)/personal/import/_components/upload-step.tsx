"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { parseCsv } from "@/lib/bank-parsers/csv";
import { parseAuto, parseByFormat } from "@/lib/bank-parsers/parsers";
import type { BankFormat, ParseResult } from "@/lib/bank-parsers/types";

type FormatChoice = "auto" | BankFormat;

export function UploadStep({
  onParsed,
}: {
  onParsed: (parsed: ParseResult, filename: string) => void;
}) {
  const [format, setFormat] = useState<FormatChoice>("auto");
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Only CSV files are supported in this version.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (5MB limit). Trim to one month if needed.");
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const result =
        format === "auto"
          ? await parseAuto(rows)
          : await parseByFormat(rows, format);

      if ("kind" in result) {
        toast.error(result.message);
        setBusy(false);
        return;
      }
      onParsed(result, file.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read file.");
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div>
        <label
          htmlFor="bank-format"
          className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400"
        >
          Bank format
        </label>
        <select
          id="bank-format"
          value={format}
          onChange={(e) => setFormat(e.target.value as FormatChoice)}
          disabled={busy}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 sm:max-w-xs"
        >
          <option value="auto">Auto-detect (try this first)</option>
          <option value="hdfc">HDFC Bank</option>
          <option value="sbi">SBI</option>
          <option value="icici">ICICI Bank</option>
        </select>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          Pick a specific bank if auto-detect fails (e.g., mobile-app exports
          sometimes use a different layout).
        </p>
      </div>

      <label
        htmlFor="csv-file"
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
          busy
            ? "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950"
            : "border-indigo-300 bg-indigo-50/40 hover:bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40"
        }`}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden />
        ) : (
          <Upload className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden />
        )}
        <span className="text-sm font-medium">
          {busy ? "Parsing…" : "Choose CSV file"}
        </span>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          Max 5 MB · stays on your device
        </span>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            // Reset value so picking the same file again re-triggers
            e.target.value = "";
          }}
        />
      </label>

      <details className="rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2 text-[12px] dark:border-slate-700 dark:bg-slate-800/30">
        <summary className="cursor-pointer font-medium">
          How to download your statement
        </summary>
        <ul className="mt-2 space-y-1.5 text-slate-600 dark:text-slate-300">
          <li>
            <strong>HDFC:</strong> NetBanking → Accounts → Enquire → Account
            Statement → Download → Delimited (CSV).
          </li>
          <li>
            <strong>SBI:</strong> OnlineSBI → Account Statement → Choose
            account → Set date range → Download as CSV.
          </li>
          <li>
            <strong>ICICI:</strong> iMobile / NetBanking → Accounts →
            Transactions → Download → Excel (open in Sheets → File → Download
            → CSV).
          </li>
        </ul>
      </details>
    </section>
  );
}
