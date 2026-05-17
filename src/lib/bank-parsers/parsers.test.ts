import { describe, expect, it } from "vitest";
import { parseCsv, parseAmount, deterministicId } from "./csv";
import { detectFormat, parseAuto, parseByFormat } from "./parsers";

describe("parseCsv", () => {
  it("parses simple comma-separated rows", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    expect(parseCsv('a,b,c\n"hello, world",2,3\n')).toEqual([
      ["a", "b", "c"],
      ["hello, world", "2", "3"],
    ]);
  });

  it("handles escaped double-quotes inside quoted fields", () => {
    expect(parseCsv('a\n"she said ""hi"""\n')).toEqual([
      ["a"],
      ['she said "hi"'],
    ]);
  });

  it("handles CRLF line endings (Windows)", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips UTF-8 BOM", () => {
    expect(parseCsv("﻿a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("drops trailing all-empty rows", () => {
    expect(parseCsv("a\n1\n\n\n")).toEqual([["a"], ["1"]]);
  });
});

describe("parseAmount", () => {
  it("parses plain numbers", () => {
    expect(parseAmount("1234.50")).toBe(1234.5);
  });

  it("strips thousand separators", () => {
    expect(parseAmount("1,23,456.78")).toBe(123456.78);
  });

  it("treats parenthesised numbers as negative", () => {
    expect(parseAmount("(650.00)")).toBe(-650);
  });

  it("handles currency prefixes", () => {
    expect(parseAmount("₹500")).toBe(500);
    expect(parseAmount("Rs. 250")).toBe(250);
    expect(parseAmount("INR 1,000")).toBe(1000);
  });

  it("returns 0 for empty / non-numeric", () => {
    expect(parseAmount("")).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount("--")).toBe(0);
  });
});

describe("deterministicId", () => {
  it("returns the same UUID for the same input", async () => {
    const a = await deterministicId(["2026-04-03", 65000, "swiggy"]);
    const b = await deterministicId(["2026-04-03", 65000, "swiggy"]);
    expect(a).toBe(b);
  });

  it("returns different UUIDs for different inputs", async () => {
    const a = await deterministicId(["2026-04-03", 65000, "swiggy"]);
    const b = await deterministicId(["2026-04-04", 65000, "swiggy"]);
    expect(a).not.toBe(b);
  });

  it("matches the 8-4-4-4-12 UUID shape", async () => {
    const id = await deterministicId(["test"]);
    expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
  });
});

const HDFC_SAMPLE = `Date,Narration,Value Dat,Debit Amount,Credit Amount,Chq/Ref Number,Closing Balance
03/04/26,UPI-SWIGGY BANGALORE-swiggy@hdfcbank,03/04/26,650.00,0.00,REF12345,45000.00
04/04/26,SALARY CREDIT APR 2026,04/04/26,0.00,75000.00,REF12346,120000.00
05/04/26,SIP HDFC FLEXI CAP FUND,05/04/26,5000.00,0.00,REF12347,115000.00
06/04/26,NEFT SELF TRANSFER FROM SBI,06/04/26,0.00,10000.00,REF12348,125000.00
INVALID-DATE,bad-date-row,INVALID-DATE,100.00,0.00,REF,124900.00
`;

const SBI_SAMPLE = `Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance
03 Apr 2026,03 Apr 2026,UPI/ZOMATO/PAY,REF1,499.00,,12000.00
04 Apr 2026,04 Apr 2026,SBI ATM CASH WITHDRAWAL,REF2,2000.00,,10000.00
`;

const ICICI_SAMPLE = `Sr No.,Value Date,Transaction Date,Cheque Number,Transaction Remarks,Debit Amount,Credit Amount,Balance
1,03/04/2026,03/04/2026,,UPI/UBER INDIA/PAY,250.00,,15000.00
2,04/04/2026,04/04/2026,,GROWW MUTUAL FUND SIP,,2500.00,12500.00
`;

describe("detectFormat", () => {
  it("recognises HDFC headers", () => {
    expect(detectFormat(parseCsv(HDFC_SAMPLE))).toBe("hdfc");
  });

  it("recognises SBI headers", () => {
    expect(detectFormat(parseCsv(SBI_SAMPLE))).toBe("sbi");
  });

  it("recognises ICICI headers", () => {
    expect(detectFormat(parseCsv(ICICI_SAMPLE))).toBe("icici");
  });

  it("returns null for unrecognised CSV", () => {
    expect(detectFormat(parseCsv("foo,bar\n1,2"))).toBeNull();
  });

  it("handles prelude metadata rows before the real header", () => {
    const withPrelude = `Statement of Account\nA/C Number: XXXX1234\n\n${HDFC_SAMPLE}`;
    expect(detectFormat(parseCsv(withPrelude))).toBe("hdfc");
  });
});

describe("parseAuto — HDFC", () => {
  it("parses all four valid HDFC rows", async () => {
    const r = await parseAuto(parseCsv(HDFC_SAMPLE));
    if (!("transactions" in r)) throw new Error(`expected success: ${JSON.stringify(r)}`);
    expect(r.format).toBe("hdfc");
    expect(r.transactions).toHaveLength(4);
    expect(r.skipped).toHaveLength(1); // the bad-date row
  });

  it("correctly identifies a Swiggy debit as an expense in 'food' category", async () => {
    const r = await parseAuto(parseCsv(HDFC_SAMPLE));
    if (!("transactions" in r)) throw new Error("expected success");
    const swiggy = r.transactions.find((t) => /swiggy/i.test(t.description));
    expect(swiggy?.type).toBe("expense");
    expect(swiggy?.amount).toBe(650);
    expect(swiggy?.category).toBe("food");
  });

  it("classifies SIP as investment regardless of debit direction", async () => {
    const r = await parseAuto(parseCsv(HDFC_SAMPLE));
    if (!("transactions" in r)) throw new Error("expected success");
    const sip = r.transactions.find((t) => /sip/i.test(t.description));
    expect(sip?.type).toBe("investment");
  });

  it("flags self-transfers", async () => {
    const r = await parseAuto(parseCsv(HDFC_SAMPLE));
    if (!("transactions" in r)) throw new Error("expected success");
    const selfTxn = r.transactions.find((t) => /self/i.test(t.description));
    expect(selfTxn?.isLikelySelfTransfer).toBe(true);
  });

  it("classifies salary credit as income", async () => {
    const r = await parseAuto(parseCsv(HDFC_SAMPLE));
    if (!("transactions" in r)) throw new Error("expected success");
    const salary = r.transactions.find((t) => /salary/i.test(t.description));
    expect(salary?.type).toBe("income");
    expect(salary?.amount).toBe(75000);
  });
});

describe("parseAuto — SBI", () => {
  it("parses SBI rows with month-name dates", async () => {
    const r = await parseAuto(parseCsv(SBI_SAMPLE));
    if (!("transactions" in r)) throw new Error("expected success");
    expect(r.format).toBe("sbi");
    expect(r.transactions).toHaveLength(2);
    expect(r.transactions[0].amount).toBe(499);
    expect(r.transactions[0].type).toBe("expense");
  });
});

describe("parseAuto — ICICI", () => {
  it("parses ICICI rows and detects Groww SIP as investment", async () => {
    const r = await parseAuto(parseCsv(ICICI_SAMPLE));
    if (!("transactions" in r)) throw new Error("expected success");
    expect(r.format).toBe("icici");
    expect(r.transactions).toHaveLength(2);
    const sip = r.transactions.find((t) => /groww/i.test(t.description));
    expect(sip?.type).toBe("investment");
  });
});

describe("parseAuto — error cases", () => {
  it("returns 'empty' for empty input", async () => {
    const r = await parseAuto([]);
    expect("kind" in r ? r.kind : null).toBe("empty");
  });

  it("returns 'format-unknown' for unrecognised CSV", async () => {
    const r = await parseAuto(parseCsv("foo,bar\n1,2"));
    expect("kind" in r ? r.kind : null).toBe("format-unknown");
  });
});

describe("parseByFormat — manual format selection", () => {
  it("succeeds when user explicitly picks the right format", async () => {
    const r = await parseByFormat(parseCsv(HDFC_SAMPLE), "hdfc");
    if (!("transactions" in r)) throw new Error("expected success");
    expect(r.transactions).toHaveLength(4);
  });

  it("returns 'format-mismatch' when user picks the wrong format", async () => {
    const r = await parseByFormat(parseCsv(HDFC_SAMPLE), "sbi");
    expect("kind" in r ? r.kind : null).toBe("format-mismatch");
  });
});

describe("dedup via deterministicId", () => {
  it("two parses of the same statement produce identical clientEventIds", async () => {
    const r1 = await parseAuto(parseCsv(HDFC_SAMPLE));
    const r2 = await parseAuto(parseCsv(HDFC_SAMPLE));
    if (!("transactions" in r1) || !("transactions" in r2)) {
      throw new Error("expected success");
    }
    const ids1 = r1.transactions.map((t) => t.clientEventId).sort();
    const ids2 = r2.transactions.map((t) => t.clientEventId).sort();
    expect(ids1).toEqual(ids2);
  });
});
