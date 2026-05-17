/**
 * Shared types for the bank-statement CSV import flow.
 *
 * All parsing happens client-side — the file never reaches our servers.
 * Each parser maps its bank's CSV column layout to this neutral
 * ParsedTransaction shape, which the import UI then renders + the
 * tRPC `personal.create` mutation consumes one row at a time.
 */

export type BankFormat = "hdfc" | "sbi" | "icici";

export type EntryType = "income" | "expense" | "investment";

export type ParsedTransaction = {
  /** Deterministic UUID derived from (date|amount|description) — passed
   *  to personal.create as clientEventId so the server's idempotent
   *  fast-path makes re-importing the same statement a no-op. */
  clientEventId: string;
  /** Original 1-indexed row number in the source CSV. Lets the UI
   *  surface "row 17 looked weird, skipping" without re-parsing. */
  sourceRow: number;
  /** Local date the transaction settled. Time-of-day is not in bank
   *  exports; we use midnight UTC. */
  occurredAt: Date;
  /** Positive rupee amount. Sign is encoded by `type`. */
  amount: number;
  /** Heuristic from the parser — UI lets users flip it. */
  type: EntryType;
  /** Cleaned-up version of the bank's narration column. */
  description: string;
  /** category-detect.ts result. UI shows it as the default, user can
   *  override per-row. */
  category: string;
  /** Whether the parser flagged this row as a likely self-transfer
   *  (e.g., UPI to own VPA). Defaults unchecked in the preview so it
   *  doesn't double-count when balanced across two accounts. */
  isLikelySelfTransfer: boolean;
};

export type ParseResult = {
  format: BankFormat;
  transactions: ParsedTransaction[];
  /** Rows the parser couldn't make sense of — surfaced in the UI so
   *  users know nothing was silently dropped. */
  skipped: { sourceRow: number; reason: string }[];
};

export type ParseError =
  | { kind: "empty"; message: string }
  | { kind: "format-unknown"; message: string }
  | { kind: "format-mismatch"; message: string; suspected?: BankFormat };
