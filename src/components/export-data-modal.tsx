"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  Lock,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

/**
 * "Download all my data" modal. Two formats:
 *   - JSON — complete dump, machine-readable, includes every column
 *   - CSV bundle — separate files for expenses + personal entries,
 *     glued into a single CSV that opens cleanly in Excel/Sheets
 *
 * UX choices that matter:
 *   - Preview counts (X expenses, Y personal entries…) so the user
 *     knows what's about to be exported before they click
 *   - Explicit privacy line: "decrypted" highlighted, with a "store
 *     securely" reminder — important because we field-encrypt at rest
 *     but the export is plaintext by necessity
 *   - File names include the user's display-name initial + date so
 *     multiple exports don't collide in Downloads
 *   - Success state with file size + "Download again" affordance
 */

type ExportPayload = {
  meta: { exportedAt: string };
  groups: Array<{ id: string; name: string }>;
  expenses: Array<{
    groupId: string;
    occurredAt: Date | string;
    description: string;
    amount: number;
    currency: string;
    convertedAmount: number;
    payerId: string;
    splitMode: string;
    category: string;
  }>;
  settlements: Array<{ id: string }>;
  personal: {
    entries: Array<{
      occurredAt: Date | string;
      type: string;
      amount: number;
      currency: string;
      category: string;
      description: string;
    }>;
    holdings: Array<{
      name: string;
      type: string;
      units: number;
      avgCost: number;
      currentValue: number;
      asOf: Date | string;
    }>;
    goals: Array<unknown>;
    scoreSnapshots: Array<unknown>;
  };
};

function bytesLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function safeFilename(s: string): string {
  return s
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsvBundle(data: ExportPayload): string {
  const lines: string[] = [];
  const groupNameById = new Map(data.groups.map((g) => [g.id, g.name]));

  lines.push("# EasySplits export — CSV bundle");
  lines.push(`# Generated ${data.meta.exportedAt}`);
  lines.push("");

  // Group expenses
  lines.push("## Group expenses");
  lines.push(
    [
      "group",
      "date",
      "description",
      "amount",
      "currency",
      "converted_amount",
      "payer_id",
      "split_mode",
      "category",
    ].join(","),
  );
  for (const e of data.expenses) {
    lines.push(
      [
        csvCell(groupNameById.get(e.groupId) ?? e.groupId),
        csvCell(new Date(e.occurredAt).toISOString().slice(0, 10)),
        csvCell(e.description),
        csvCell(e.amount),
        csvCell(e.currency),
        csvCell(e.convertedAmount),
        csvCell(e.payerId),
        csvCell(e.splitMode),
        csvCell(e.category),
      ].join(","),
    );
  }
  lines.push("");

  // Personal entries
  lines.push("## Personal entries");
  lines.push(
    ["date", "type", "amount", "currency", "category", "description"].join(","),
  );
  for (const e of data.personal.entries) {
    lines.push(
      [
        csvCell(new Date(e.occurredAt).toISOString().slice(0, 10)),
        csvCell(e.type),
        csvCell(e.amount),
        csvCell(e.currency),
        csvCell(e.category),
        csvCell(e.description),
      ].join(","),
    );
  }
  lines.push("");

  // Holdings
  if (data.personal.holdings.length > 0) {
    lines.push("## Holdings");
    lines.push(
      ["name", "type", "units", "avg_cost", "current_value", "as_of"].join(","),
    );
    for (const h of data.personal.holdings) {
      lines.push(
        [
          csvCell(h.name),
          csvCell(h.type),
          csvCell(h.units),
          csvCell(h.avgCost),
          csvCell(h.currentValue),
          csvCell(new Date(h.asOf).toISOString().slice(0, 10)),
        ].join(","),
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function ExportDataModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const meQuery = trpc.profiles.me.useQuery(undefined, { staleTime: 60_000 });
  const exportQuery = trpc.profiles.exportAll.useQuery(undefined, {
    enabled: open,
    staleTime: 0,
  });
  const [downloadedAs, setDownloadedAs] = useState<null | "json" | "csv">(null);
  const [lastSize, setLastSize] = useState(0);

  const data = (exportQuery.data as ExportPayload | undefined) ?? null;

  const counts = useMemo(() => {
    if (!data) return null;
    return {
      groups: data.groups.length,
      expenses: data.expenses.length,
      settlements: data.settlements.length,
      personalEntries: data.personal.entries.length,
      holdings: data.personal.holdings.length,
      goals: data.personal.goals.length,
      snapshots: data.personal.scoreSnapshots.length,
    };
  }, [data]);

  if (!open) return null;

  const filenameStub = (() => {
    const name = meQuery.data?.displayName ?? "you";
    const date = new Date().toISOString().slice(0, 10);
    return `easysplits-${safeFilename(name)}-${date}`;
  })();

  const downloadBlob = (
    contents: string,
    mime: string,
    filename: string,
    kind: "json" | "csv",
  ) => {
    const blob = new Blob([contents], { type: mime });
    setLastSize(blob.size);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadedAs(kind);
    toast.success(`Saved ${filename}`);
  };

  const downloadJson = () => {
    if (!data) return;
    downloadBlob(
      JSON.stringify(data, null, 2),
      "application/json;charset=utf-8",
      `${filenameStub}.json`,
      "json",
    );
  };
  const downloadCsv = () => {
    if (!data) return;
    downloadBlob(
      buildCsvBundle(data),
      "text/csv;charset=utf-8",
      `${filenameStub}.csv`,
      "csv",
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Download your data"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        {/* Hero */}
        <div className="bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 px-5 py-6 text-white sm:px-6">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-white/85">
            <Download className="h-3.5 w-3.5" aria-hidden /> Your data
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
            Download everything
          </h2>
          <p className="mt-1.5 text-[12px] text-white/95">
            Every group, every expense, every personal entry, decrypted into
            one file. Yours to keep — no lock-in.
          </p>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          {/* Privacy reassurance line */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <Lock
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400"
              aria-hidden
            />
            <p className="text-[11.5px] leading-relaxed text-amber-900 dark:text-amber-200">
              The file contains your <strong>decrypted</strong> amounts and
              descriptions. Store it somewhere safe — anyone with the file
              can read your numbers.
            </p>
          </div>

          {/* Preview counts */}
          {exportQuery.isLoading ? (
            <p className="flex items-center gap-1.5 py-4 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Gathering your data…
            </p>
          ) : counts ? (
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                What&apos;s in your export
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                <CountRow label="Groups" value={counts.groups} />
                <CountRow label="Group expenses" value={counts.expenses} />
                <CountRow label="Settlements" value={counts.settlements} />
                <CountRow
                  label="Personal entries"
                  value={counts.personalEntries}
                />
                <CountRow label="Holdings" value={counts.holdings} />
                <CountRow label="Goals" value={counts.goals} />
                <CountRow label="Score history" value={counts.snapshots} />
              </dl>
            </div>
          ) : (
            <p className="text-xs text-rose-600">
              Couldn&apos;t load your data. Try again in a moment.
            </p>
          )}

          {/* Format chooser */}
          <div className="grid gap-2">
            <FormatButton
              format="json"
              title="Complete (JSON)"
              hint="Machine-readable — every field, every relation. Best for archival or moving to another app."
              icon={<FileJson className="h-4 w-4" aria-hidden />}
              disabled={!data}
              onClick={downloadJson}
            />
            <FormatButton
              format="csv"
              title="Spreadsheet bundle (CSV)"
              hint="Opens in Excel / Google Sheets. Includes group expenses, personal entries, and holdings."
              icon={<FileSpreadsheet className="h-4 w-4" aria-hidden />}
              disabled={!data}
              onClick={downloadCsv}
            />
          </div>

          {/* Success state */}
          {downloadedAs && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400"
                aria-hidden
              />
              <div className="text-[11.5px] text-emerald-900 dark:text-emerald-200">
                <p className="font-semibold">
                  Downloaded {downloadedAs.toUpperCase()} ({bytesLabel(lastSize)})
                </p>
                <p className="mt-0.5 text-emerald-800/80 dark:text-emerald-200/80">
                  Check your Downloads folder for{" "}
                  <code className="rounded bg-emerald-100 px-1 dark:bg-emerald-900/40">
                    {filenameStub}.{downloadedAs}
                  </code>
                </p>
              </div>
            </div>
          )}

          {/* Trust footer */}
          <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-[10.5px] text-slate-400 dark:text-slate-500">
            <ShieldCheck className="h-3 w-3" aria-hidden /> Generated locally
            in your browser — never re-uploaded.
          </p>
        </div>
      </div>
    </div>
  );
}

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-100 py-1 dark:border-slate-800">
      <dt className="text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {value.toLocaleString("en-IN")}
      </dd>
    </div>
  );
}

function FormatButton({
  format,
  title,
  hint,
  icon,
  disabled,
  onClick,
}: {
  format: "json" | "csv";
  title: string;
  hint: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/20"
    >
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 text-white shadow-sm"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold tracking-tight">
          {title}
        </span>
        <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      </span>
      <Download
        className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-y-0.5 group-hover:text-indigo-500"
        aria-hidden
      />
      <span className="sr-only">{format}</span>
    </button>
  );
}
