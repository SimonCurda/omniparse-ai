import crypto from 'crypto';

// ─── AES-256-GCM encryption for IMAP credentials ─────────────────────────────
//
// Why GCM (Galois/Counter Mode)?
// - Provides both confidentiality (encryption) AND integrity (auth tag)
//   so tampered ciphertext is detected on decrypt.
// - Each encryption gets a unique random IV (initialization vector) so the
//   same plaintext encrypted twice produces different ciphertext.
//
// Key derivation:
// We use the existing JWT_SECRET env var (already required by the app) as the
// source of entropy. We hash it with SHA-256 to get exactly 32 bytes (256 bits)
// which is what AES-256 needs. This avoids introducing a new env var.
//
// Storage format: "iv:ciphertext:authTag" — all hex-encoded, colon-separated.

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV is recommended for GCM

function getKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // This should never happen in production — auth.ts throws in prod if
    // JWT_SECRET is missing. The fallback here is only for dev/local.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required to encrypt email credentials');
    }
    return crypto.createHash('sha256').update('op-dev-secret-change-in-production').digest();
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string (e.g. an IMAP app password).
 * Returns "iv:ciphertext:authTag" — all hex-encoded.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), encrypted.toString('hex'), authTag.toString('hex')].join(':');
}

/**
 * Decrypt a blob produced by encrypt().
 * Throws if the auth tag doesn't match (i.e. ciphertext was tampered with).
 */
export function decrypt(blob: string): string {
  const parts = blob.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted blob format (expected iv:ciphertext:authTag)');
  }
  const [ivHex, ciphertextHex, authTagHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Quick test helper — verifies the encryption round-trips correctly.
 * Used by the "Test connection" button in the inbox config UI.
 */
export function testCrypto(): { ok: boolean; error?: string } {
  try {
    const sample = 'test-password-123';
    const encrypted = encrypt(sample);
    const decrypted = decrypt(encrypted);
    return { ok: decrypted === sample };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
