import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import {
  _resetKeyCache,
  decryptAmount,
  decryptValue,
  encryptAmount,
  encryptValue,
  isEncryptionConfigured,
} from "./encryption";

const ORIGINAL_KEY = process.env.PFT_ENCRYPTION_KEY;

beforeAll(() => {
  process.env.PFT_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  _resetKeyCache();
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.PFT_ENCRYPTION_KEY;
  else process.env.PFT_ENCRYPTION_KEY = ORIGINAL_KEY;
  _resetKeyCache();
});

describe("encryption", () => {
  it("round-trips a string value", () => {
    const out = decryptValue(encryptValue("hello world"));
    expect(out).toBe("hello world");
  });

  it("round-trips an empty string", () => {
    expect(decryptValue(encryptValue(""))).toBe("");
  });

  it("round-trips Indian unicode", () => {
    expect(decryptValue(encryptValue("नमस्ते 🙏 Mumbai"))).toBe(
      "नमस्ते 🙏 Mumbai",
    );
  });

  it("two encrypts of the same plaintext produce different ciphertext (random IV)", () => {
    const a = encryptValue("same input");
    const b = encryptValue("same input");
    expect(a).not.toBe(b);
    // ...but both decrypt back to the same plaintext
    expect(decryptValue(a)).toBe("same input");
    expect(decryptValue(b)).toBe("same input");
  });

  it("ciphertext is base64", () => {
    const enc = encryptValue("test");
    expect(enc).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("rejects truncated ciphertext", () => {
    expect(() => decryptValue("abc")).toThrow(/too short/);
  });

  it("rejects tampered ciphertext (auth-tag check)", () => {
    const enc = encryptValue("original");
    // Flip a byte somewhere in the middle of the ciphertext (after IV+tag)
    const buf = Buffer.from(enc, "base64");
    buf[buf.length - 1] = buf[buf.length - 1] ^ 0xff;
    const tampered = buf.toString("base64");
    expect(() => decryptValue(tampered)).toThrow();
  });

  describe("encryptAmount / decryptAmount", () => {
    it("round-trips a whole rupee", () => {
      expect(decryptAmount(encryptAmount(15000))).toBe(15000);
    });

    it("round-trips paisa precision", () => {
      expect(decryptAmount(encryptAmount(1234.56))).toBe(1234.56);
    });

    it("round-trips zero", () => {
      expect(decryptAmount(encryptAmount(0))).toBe(0);
    });

    it("round-trips a large number", () => {
      expect(decryptAmount(encryptAmount(99999999.99))).toBe(99999999.99);
    });
  });

  it("isEncryptionConfigured returns true when key is set", () => {
    expect(isEncryptionConfigured()).toBe(true);
  });
});

describe("encryption — key validation", () => {
  it("isEncryptionConfigured returns false when key is missing", () => {
    const orig = process.env.PFT_ENCRYPTION_KEY;
    delete process.env.PFT_ENCRYPTION_KEY;
    _resetKeyCache();
    expect(isEncryptionConfigured()).toBe(false);
    process.env.PFT_ENCRYPTION_KEY = orig;
    _resetKeyCache();
  });

  it("isEncryptionConfigured returns false when key is wrong length", () => {
    const orig = process.env.PFT_ENCRYPTION_KEY;
    process.env.PFT_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
    _resetKeyCache();
    expect(isEncryptionConfigured()).toBe(false);
    process.env.PFT_ENCRYPTION_KEY = orig;
    _resetKeyCache();
  });
});
