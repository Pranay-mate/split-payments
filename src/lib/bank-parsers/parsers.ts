/**
 * Per-bank CSV format parsers. Each one:
 *   1. Validates the header row's signature (used for auto-detect)
 *   2. Maps that bank's column layout to ParsedTransaction[]
 *   3. Classifies each row as income / expense / investment
 *   4. Flags suspected self-transfers (won't be auto-checked in preview)
 *
 * Date parsing tolerates a couple of common Indian formats per bank,
 * because the same bank ships slightly different layouts via web vs
 * mobile app exports.
 */

import { detectCategory } from "@/lib/category-detect";
import { deterministicId, parseAmount } from "./csv";
import type {
  BankFormat,
  EntryType,
  ParseError,
  ParseResult,
  ParsedTransaction,
} from "./types";

/** ----- shared helpers ----- */

const INVESTMENT_KEYWORDS = [
  "sip", "mutual fund", "mf", "elss", "nps",
  "ppf", "sukanya", "kvp", "nsc",
  "groww", "zerodha", "kuvera", "indmoney", "et money", "paytm money",
  "lic", "icici prudential", "hdfc amc", "sbi mf", "axis mf", "nippon",
  "stock", "equity", "bse", "nse", "demat", "dp ",
  "fd ", "rd ", "fixed deposit", "recurring deposit",
];

const SELF_TRANSFER_HINTS = [
  "self", "own account", "to self", "own a/c",
  "neft self", "imps self", "rtgs self",
];

function classify(desc: string, hasDebit: boolean): EntryType {
  const lower = desc.toLowerCase();
  if (INVESTMENT_KEYWORDS.some((kw) => lower.includes(kw))) return "investment";
  return hasDebit ? "expense" : "income";
}

function isLikelySelfTransfer(desc: string): boolean {
  const lower = desc.toLowerCase();
  return SELF_TRANSFER_HINTS.some((kw) => lower.includes(kw));
}

function cleanDescription(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^["']+|["']+$/g, "")
    .trim()
    .slice(0, 200);
}

/** Parse `DD/MM/YY` or `DD/MM/YYYY` (HDFC, ICICI). */
function parseSlashDate(raw: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]) - 1;
  let yy = Number(m[3]);
  if (yy < 100) yy += yy < 50 ? 2000 : 1900;
  const d = new Date(Date.UTC(yy, mm, dd));
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTH_LOOKUP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/** Parse `DD MMM YYYY` / `DD-MMM-YYYY` (SBI). */
function parseMonthNameDate(raw: string): Date | null {
  const m = /^(\d{1,2})[\s\-]+([A-Za-z]{3,4})[\s\-]+(\d{2,4})$/.exec(raw.trim());
  if (!m) return null;
  const dd = Number(m[1]);
  const mon = MONTH_LOOKUP[m[2].toLowerCase()];
  if (mon === undefined) return null;
  let yy = Number(m[3]);
  if (yy < 100) yy += yy < 50 ? 2000 : 1900;
  const d = new Date(Date.UTC(yy, mon, dd));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Lowercase + collapse whitespace + strip non-alphanum — used for
 *  comparing header rows against expected column names. */
function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function buildTransaction(
  sourceRow: number,
  date: Date,
  description: string,
  amount: number,
  hasDebit: boolean,
): Promise<ParsedTransaction> {
  const desc = cleanDescription(description);
  const type = classify(desc, hasDebit);
  // Amount is always positive; sign-of-flow is `type`.
  const absAmount = Math.abs(amount);
  const clientEventId = await deterministicId([
    date.toISOString().slice(0, 10),
    Math.round(absAmount * 100), // paisa precision
    desc.toLowerCase().slice(0, 80),
    type,
  ]);
  const detected = detectCategory(desc);
  return {
    clientEventId,
    sourceRow,
    occurredAt: date,
    amount: absAmount,
    type,
    description: desc,
    category: detected ?? (type === "income" ? "income" : type === "investment" ? "investment" : "other"),
    isLikelySelfTransfer: isLikelySelfTransfer(desc),
  };
}

/** ----- HDFC ----- */

// Typical headers (online banking export):
//   Date, Narration, Value Dat, Debit Amount, Credit Amount, Chq/Ref Number, Closing Balance
const HDFC_REQUIRED = ["date", "narration", "debitamount", "creditamount"];

function isHdfcHeader(headers: string[]): boolean {
  const normalised = headers.map(normalizeHeader);
  return HDFC_REQUIRED.every((req) => normalised.includes(req));
}

async function parseHdfc(rows: string[][]): Promise<ParseResult> {
  const headers = rows[0].map(normalizeHeader);
  const idx = {
    date: headers.indexOf("date"),
    narration: headers.indexOf("narration"),
    debit: headers.indexOf("debitamount"),
    credit: headers.indexOf("creditamount"),
  };
  const transactions: ParsedTransaction[] = [];
  const skipped: ParseResult["skipped"] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rawDate = r[idx.date] ?? "";
    const date = parseSlashDate(rawDate);
    if (!date) {
      skipped.push({ sourceRow: i + 1, reason: `Unrecognised date: "${rawDate}"` });
      continue;
    }
    const debit = parseAmount(r[idx.debit]);
    const credit = parseAmount(r[idx.credit]);
    if (debit === 0 && credit === 0) {
      skipped.push({ sourceRow: i + 1, reason: "Zero-amount row" });
      continue;
    }
    const amount = debit > 0 ? debit : credit;
    transactions.push(
      await buildTransaction(
        i + 1,
        date,
        r[idx.narration] ?? "",
        amount,
        debit > 0,
      ),
    );
  }
  return { format: "hdfc", transactions, skipped };
}

/** ----- SBI ----- */

// Typical headers:
//   Txn Date, Value Date, Description, Ref No./Cheque No., Debit, Credit, Balance
const SBI_REQUIRED = ["txndate", "description", "debit", "credit"];

function isSbiHeader(headers: string[]): boolean {
  const normalised = headers.map(normalizeHeader);
  return SBI_REQUIRED.every((req) => normalised.includes(req));
}

async function parseSbi(rows: string[][]): Promise<ParseResult> {
  const headers = rows[0].map(normalizeHeader);
  const idx = {
    date: headers.indexOf("txndate"),
    description: headers.indexOf("description"),
    debit: headers.indexOf("debit"),
    credit: headers.indexOf("credit"),
  };
  const transactions: ParsedTransaction[] = [];
  const skipped: ParseResult["skipped"] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rawDate = r[idx.date] ?? "";
    const date =
      parseMonthNameDate(rawDate) ?? parseSlashDate(rawDate);
    if (!date) {
      skipped.push({ sourceRow: i + 1, reason: `Unrecognised date: "${rawDate}"` });
      continue;
    }
    const debit = parseAmount(r[idx.debit]);
    const credit = parseAmount(r[idx.credit]);
    if (debit === 0 && credit === 0) {
      skipped.push({ sourceRow: i + 1, reason: "Zero-amount row" });
      continue;
    }
    const amount = debit > 0 ? debit : credit;
    transactions.push(
      await buildTransaction(
        i + 1,
        date,
        r[idx.description] ?? "",
        amount,
        debit > 0,
      ),
    );
  }
  return { format: "sbi", transactions, skipped };
}

/** ----- ICICI ----- */

// Typical headers:
//   Sr No., Value Date, Transaction Date, Cheque Number, Transaction Remarks,
//   Debit Amount, Credit Amount, Balance
const ICICI_REQUIRED = ["transactiondate", "transactionremarks", "debitamount", "creditamount"];

function isIciciHeader(headers: string[]): boolean {
  const normalised = headers.map(normalizeHeader);
  return ICICI_REQUIRED.every((req) => normalised.includes(req));
}

async function parseIcici(rows: string[][]): Promise<ParseResult> {
  const headers = rows[0].map(normalizeHeader);
  const idx = {
    date: headers.indexOf("transactiondate"),
    description: headers.indexOf("transactionremarks"),
    debit: headers.indexOf("debitamount"),
    credit: headers.indexOf("creditamount"),
  };
  const transactions: ParsedTransaction[] = [];
  const skipped: ParseResult["skipped"] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rawDate = r[idx.date] ?? "";
    const date = parseSlashDate(rawDate);
    if (!date) {
      skipped.push({ sourceRow: i + 1, reason: `Unrecognised date: "${rawDate}"` });
      continue;
    }
    const debit = parseAmount(r[idx.debit]);
    const credit = parseAmount(r[idx.credit]);
    if (debit === 0 && credit === 0) {
      skipped.push({ sourceRow: i + 1, reason: "Zero-amount row" });
      continue;
    }
    const amount = debit > 0 ? debit : credit;
    transactions.push(
      await buildTransaction(
        i + 1,
        date,
        r[idx.description] ?? "",
        amount,
        debit > 0,
      ),
    );
  }
  return { format: "icici", transactions, skipped };
}

/** ----- public surface ----- */

export function detectFormat(rows: string[][]): BankFormat | null {
  if (rows.length === 0) return null;
  // Banks sometimes prepend a couple of metadata rows (account number,
  // statement period) before the actual header. Scan the first 6 rows
  // for one that matches any known format signature.
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    const candidate = rows[i];
    if (isHdfcHeader(candidate)) return "hdfc";
    if (isSbiHeader(candidate)) return "sbi";
    if (isIciciHeader(candidate)) return "icici";
  }
  return null;
}

/** Drop the prelude metadata rows (if any) and return the slice
 *  starting from the header row. Used after `detectFormat` since the
 *  per-bank parsers assume row[0] is the header. */
function sliceFromHeader(rows: string[][], format: BankFormat): string[][] {
  const test =
    format === "hdfc" ? isHdfcHeader :
    format === "sbi" ? isSbiHeader :
    isIciciHeader;
  for (let i = 0; i < rows.length; i++) {
    if (test(rows[i])) return rows.slice(i);
  }
  return rows;
}

export async function parseByFormat(
  rows: string[][],
  format: BankFormat,
): Promise<ParseResult | ParseError> {
  if (rows.length === 0) {
    return { kind: "empty", message: "The CSV was empty." };
  }
  const sliced = sliceFromHeader(rows, format);
  const headerOk =
    (format === "hdfc" && isHdfcHeader(sliced[0])) ||
    (format === "sbi" && isSbiHeader(sliced[0])) ||
    (format === "icici" && isIciciHeader(sliced[0]));
  if (!headerOk) {
    return {
      kind: "format-mismatch",
      message: `The file doesn't look like a ${format.toUpperCase()} export. Expected columns weren't found.`,
    };
  }
  switch (format) {
    case "hdfc":
      return parseHdfc(sliced);
    case "sbi":
      return parseSbi(sliced);
    case "icici":
      return parseIcici(sliced);
  }
}

export async function parseAuto(rows: string[][]): Promise<ParseResult | ParseError> {
  if (rows.length === 0) {
    return { kind: "empty", message: "The CSV was empty." };
  }
  const format = detectFormat(rows);
  if (!format) {
    return {
      kind: "format-unknown",
      message:
        "Couldn't auto-detect the bank. Pick HDFC, SBI, or ICICI from the dropdown.",
    };
  }
  return parseByFormat(rows, format);
}
