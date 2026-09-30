import crypto from 'crypto';
import { db } from '@/lib/db';

// ─── API Key helpers ──────────────────────────────────────────────────────
// API keys have the format: op_live_<32 random hex chars>
// We store SHA-256(key) in the DB — the full key is only shown once at creation.

const KEY_PREFIX = 'op_live_';

/**
 * Generate a new API key. Returns the full key (only shown once) + the
 * hash to store in the DB + the prefix for display.
 */
export function generateApiKey(): { fullKey: string; keyHash: string; keyPrefix: string } {
  const randomPart = crypto.randomBytes(24).toString('hex'); // 48 hex chars
  const fullKey = KEY_PREFIX + randomPart;
  const keyHash = hashKey(fullKey);
  const keyPrefix = fullKey.slice(0, 12); // "op_live_abc1"
  return { fullKey, keyHash, keyPrefix };
}

/**
 * Hash an API key for storage. Uses SHA-256 — same approach as password
 * hashing but API keys are high-entropy so bcrypt's slowness isn't needed.
 */
export function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Validate an API key from a request's Authorization header.
 * Returns the user ID if valid, or null if invalid/missing.
 *
 * Also updates lastUsedAt + monthlyCount (lazy reset like parse-limit).
 */
export async function validateApiKey(authHeader: string | null): Promise<{ userId: string; keyId: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const key = authHeader.slice(7).trim();
  if (!key.startsWith(KEY_PREFIX)) return null;

  const keyHash = hashKey(key);
  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, userId: true, monthlyCount: true, countResetAt: true },
  });
  if (!apiKey) return null;

  // Lazy monthly reset
  const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  let newCount = apiKey.monthlyCount;
  if (!apiKey.countResetAt || apiKey.countResetAt < startOfMonth) {
    newCount = 0;
  }
  newCount++;

  // Update lastUsedAt + count (fire-and-forget — don't block the response)
  db.apiKey.update({
    where: { id: apiKey.id },
    data: {
      lastUsedAt: new Date(),
      monthlyCount: newCount,
      countResetAt: startOfMonth,
    },
  }).catch(() => { /* silent fail — don't block extraction */ });

  return { userId: apiKey.userId, keyId: apiKey.id };
}

/**
 * Get the API rate limit for a given plan. Separate from the parse limit
 * — API users get their own quota pool.
 */
export function getApiLimit(plan: string): number {
  const limits: Record<string, number> = {
    free: 50,        // 50 API calls/month on free (enough for testing)
    pro: 2000,       // 2,000/month on Pro
    plus: 10000,     // 10,000/month on Plus
    business: 50000, // 50,000/month on Business
    enterprise: Infinity,
  };
  return limits[plan] ?? limits.free;
}
