/**
 * Field-level encryption for sensitive personal-finance values.
 *
 * Algorithm: AES-256-GCM. The auth tag is part of the output, so any
 * tampered ciphertext fails decryption — protects against silent data
 * corruption as well as confidentiality.
 *
 * Wire format (base64-encoded):
 *   bytes 0..11   = IV   (12 bytes, random per encryption)
 *   bytes 12..27  = tag  (16 bytes, GCM auth tag)
 *   bytes 28..    = ciphertext
 *
 * Trust model:
 *   - Server holds the key in PFT_ENCRYPTION_KEY env var (32 random
 *     bytes, base64). Same trust boundary as the rest of the app —
 *     not E2EE.
 *   - Database (Supabase staff, anyone with a stolen DB dump, SQL
 *     injection exfiltrators) sees ciphertext only. Without the key
 *     they can't recover the values.
 *   - Honest copy on the user's side: "Encrypted at the field level.
 *     Our database hosting provider can't read your data." No claim
 *     about us not being able to read it (we can, that's how scoring
 *     and analytics work).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.PFT_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "PFT_ENCRYPTION_KEY is not set. Generate with `openssl rand -base64 32` and add to env.",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `PFT_ENCRYPTION_KEY must be 32 bytes (base64-encoded). Got ${buf.length} bytes.`,
    );
  }
  cachedKey = buf;
  return buf;
}

/** For tests — wipe the cached key so a re-read picks up a new env var. */
export function _resetKeyCache(): void {
  cachedKey = null;
}

export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptValue(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptValue(encoded: string): string {
  const key = getKey();
  const buf = Buffer.from(encoded, "base64");
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("Ciphertext too short — possibly corrupted or unencrypted");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Encrypt a numeric amount. The number is serialised with up to 2
 * decimals (the schema's precision) before encryption so we can
 * round-trip through Number() on read.
 */
export function encryptAmount(amount: number): string {
  return encryptValue(amount.toFixed(2));
}

export function decryptAmount(encoded: string): number {
  return Number(decryptValue(encoded));
}
