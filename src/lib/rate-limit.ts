// Simple in-memory rate limiter
// Maps IP -> { count, resetTime }

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000;

if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetTime) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
}

/**
 * Check if an IP is rate limited.
 * @param ip - Client IP address
 * @param limit - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns true if the request should be blocked (rate limited)
 */
export function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(ip);

  // No entry or window expired → create fresh entry
  if (!entry || now >= entry.resetTime) {
    store.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }

  // Within window: increment and check
  entry.count++;
  if (entry.count > limit) {
    return true;
  }

  return false;
}
