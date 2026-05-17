/**
 * Minimal RFC-4180 CSV parser. Handles quoted fields with embedded
 * commas, newlines, and double-quote escaping. Pure ASCII/UTF-8 input
 * assumed — bank exports don't have BOMs that need stripping in 2026.
 *
 * Why not papaparse? It's ~25KB. We only need two functions on one
 * route. Writing the spec-correct subset inline keeps the bundle lean.
 */

/** Split a CSV string into rows of fields. Handles `\r\n` and `\n` line
 *  endings, double-quote escaping (`""` inside quoted field = `"`), and
 *  quoted fields containing commas/newlines. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  // Strip UTF-8 BOM if present
  if (input.charCodeAt(0) === 0xfeff) i = 1;

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          // Escaped double-quote
          field += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // Eat the \n if it follows (Windows line ending)
      if (input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Tail row (no trailing newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop trailing empty rows that some banks pad on
  while (
    rows.length > 0 &&
    rows[rows.length - 1].every((c) => c.trim() === "")
  ) {
    rows.pop();
  }
  return rows;
}

/**
 * Deterministic UUID-shaped string for dedup. SHA-256(input) → take 32
 * hex chars → format with dashes. Not strictly UUID v5, but valid UUID
 * format and stable across imports. Same input always produces same id,
 * so re-uploading a statement hits the server's idempotent fast-path
 * and creates zero duplicates.
 */
export async function deterministicId(parts: (string | number)[]): Promise<string> {
  const input = parts.map((p) => String(p)).join("|");
  const data = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Take first 32 hex chars and format as 8-4-4-4-12 UUID
  return `${bytes.slice(0, 8)}-${bytes.slice(8, 12)}-${bytes.slice(12, 16)}-${bytes.slice(16, 20)}-${bytes.slice(20, 32)}`;
}

/** Parse a numeric string like "1,234.50" / "(650.00)" / "" → number.
 *  Bank CSVs format amounts with thousand-separators sometimes; we
 *  normalise to a plain number. Empty / non-numeric → 0. */
export function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  // Strip currency symbols, thousand separators, parentheses
  const negativeParens = /^\((.*)\)$/.exec(trimmed);
  const inner = (negativeParens ? negativeParens[1] : trimmed)
    .replace(/[,\s₹]/g, "")
    .replace(/^Rs\.?/i, "")
    .replace(/^INR/i, "")
    .trim();
  const num = Number(inner);
  if (!Number.isFinite(num)) return 0;
  return negativeParens ? -num : num;
}
