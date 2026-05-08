/**
 * Group export helpers — CSV (synchronous, no deps) and PDF (lazy-loaded
 * via dynamic import so jspdf doesn't ship with the initial bundle).
 *
 * The shape of the input mirrors what the group page already has cached;
 * pass it straight in instead of refetching.
 */

import { CATEGORIES, toCategoryKey } from "./categories";

export type ExportExpense = {
  description: string;
  amount: number;
  currency: string;
  convertedAmount: number;
  payerId: string;
  category?: string | null;
  occurredAt: Date | string;
  splits: { userId: string; amount: number }[];
};

export type ExportSettlement = {
  fromUserId: string;
  toUserId: string;
  amount: number;
  note?: string | null;
  occurredAt: Date | string;
};

export type ExportBalance = {
  userId: string;
  /** Positive = owed by group · negative = owes group. */
  net: number;
};

export type ExportInput = {
  groupName: string;
  primaryCurrency: string;
  members: { id: string; name: string }[];
  expenses: ExportExpense[];
  settlements: ExportSettlement[];
  balances: ExportBalance[];
};

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isoDate(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

function fileSafeName(s: string): string {
  return s.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "group";
}

/** Browser-only; throws if called server-side. */
function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined") {
    throw new Error("downloadBlob is browser-only");
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on next tick — Safari needs the URL to still be live when click() fires.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Build a multi-section CSV with three blocks (Expenses, Settlements,
 * Balances). Spreadsheet apps will treat the `# Section` rows as data
 * but most users paste into Sheets and ignore them — pragmatic.
 */
export function buildCsv(input: ExportInput): string {
  const memberById = new Map<string, string>();
  for (const m of input.members) memberById.set(m.id, m.name);

  const lines: string[] = [];

  lines.push(`# EasySplits export — ${input.groupName}`);
  lines.push(`# Generated: ${isoDate(new Date())}`);
  lines.push(`# Primary currency: ${input.primaryCurrency}`);
  lines.push("");

  // Expenses
  lines.push(`# Expenses (${input.expenses.length})`);
  const memberHeaders = input.members.map((m) => `${m.name} share`);
  lines.push(
    [
      "Date",
      "Description",
      "Category",
      "Payer",
      "Amount",
      "Currency",
      `Amount (${input.primaryCurrency})`,
      ...memberHeaders,
    ]
      .map(csvEscape)
      .join(","),
  );
  for (const e of input.expenses) {
    const splitByMember = new Map<string, number>();
    for (const s of e.splits) splitByMember.set(s.userId, s.amount);
    const cat = CATEGORIES[toCategoryKey(e.category ?? null)];
    const row = [
      isoDate(e.occurredAt),
      e.description || "Expense",
      cat.label,
      memberById.get(e.payerId) ?? "?",
      e.amount.toFixed(2),
      e.currency,
      e.convertedAmount.toFixed(2),
      ...input.members.map((m) => {
        const v = splitByMember.get(m.id);
        return v === undefined ? "" : v.toFixed(2);
      }),
    ];
    lines.push(row.map(csvEscape).join(","));
  }

  lines.push("");
  lines.push(`# Settlements (${input.settlements.length})`);
  lines.push(
    ["Date", "From", "To", `Amount (${input.primaryCurrency})`, "Note"]
      .map(csvEscape)
      .join(","),
  );
  for (const s of input.settlements) {
    lines.push(
      [
        isoDate(s.occurredAt),
        memberById.get(s.fromUserId) ?? "?",
        memberById.get(s.toUserId) ?? "?",
        s.amount.toFixed(2),
        s.note ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  lines.push("");
  lines.push(`# Balances (${input.balances.length}, in ${input.primaryCurrency})`);
  lines.push(["Member", "Net"].map(csvEscape).join(","));
  for (const b of input.balances) {
    lines.push(
      [
        memberById.get(b.userId) ?? "?",
        (b.net >= 0 ? "+" : "") + b.net.toFixed(2),
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  return lines.join("\n");
}

export function downloadCsv(input: ExportInput): void {
  const csv = buildCsv(input);
  const filename = `${fileSafeName(input.groupName)}-${isoDate(new Date())}.csv`;
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

/**
 * PDF export. jspdf is ~60kb — lazy-imported so it only loads on use.
 */
export async function downloadPdf(input: ExportInput): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (autoTableModule.default ??
    autoTableModule) as unknown as (
    doc: InstanceType<typeof jsPDF>,
    opts: Record<string, unknown>,
  ) => void;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const memberById = new Map<string, string>();
  for (const m of input.members) memberById.set(m.id, m.name);

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(input.groupName, 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `EasySplits export · ${isoDate(new Date())} · Currency: ${input.primaryCurrency} · ${input.members.length} ${input.members.length === 1 ? "member" : "members"}`,
    40,
    66,
  );
  doc.setTextColor(0);

  let y = 90;

  // Balances first — most actionable
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Balances", 40, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [["Member", `Net (${input.primaryCurrency})`]],
    body: input.balances.map((b) => [
      memberById.get(b.userId) ?? "?",
      (b.net >= 0 ? "+" : "") + b.net.toFixed(2),
    ]),
    theme: "striped",
    headStyles: { fillColor: [99, 102, 241] }, // indigo
    styles: { fontSize: 9 },
    margin: { left: 40, right: 40 },
  });
  y =
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y) + 24;

  // Expenses
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Expenses (${input.expenses.length})`, 40, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [
      [
        "Date",
        "Description",
        "Category",
        "Payer",
        `Amount (${input.primaryCurrency})`,
      ],
    ],
    body: input.expenses.map((e) => [
      isoDate(e.occurredAt),
      e.description || "Expense",
      CATEGORIES[toCategoryKey(e.category ?? null)].label,
      memberById.get(e.payerId) ?? "?",
      (e.currency !== input.primaryCurrency
        ? `${e.amount.toFixed(2)} ${e.currency} → `
        : "") + e.convertedAmount.toFixed(2),
    ]),
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129] }, // emerald
    styles: { fontSize: 9 },
    margin: { left: 40, right: 40 },
  });
  y =
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y) + 24;

  // Settlements
  if (input.settlements.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Settlements (${input.settlements.length})`, 40, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [["Date", "From", "To", `Amount (${input.primaryCurrency})`, "Note"]],
      body: input.settlements.map((s) => [
        isoDate(s.occurredAt),
        memberById.get(s.fromUserId) ?? "?",
        memberById.get(s.toUserId) ?? "?",
        s.amount.toFixed(2),
        s.note ?? "",
      ]),
      theme: "striped",
      headStyles: { fillColor: [139, 92, 246] }, // violet
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });
  }

  doc.save(`${fileSafeName(input.groupName)}-${isoDate(new Date())}.pdf`);
}
