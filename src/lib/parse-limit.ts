// ─── Monthly Parse Limit Helper ──────────────────────────────────────────
//
// Tracks total invoices PARSED per month — NOT just existing ones.
// If a Free user parses 15 invoices, deletes them all, they STILL can't
// parse more this month. Counter resets on the 1st of each month.
//
// Uses a counter on the User model (monthlyParseCount + parseCountResetAt)
// instead of counting db.invoice rows, because invoice rows can be deleted.
//
// The reset is checked at runtime (not via cron) — if the current month
// is different from parseCountResetAt's month, the counter resets to 0.

import { db } from '@/lib/db';

const PLAN_LIMITS: Record<string, number> = {
  free: 15,
  pro: 500,
  plus: 2000,
  business: 10000,
  enterprise: Infinity,
};

/**
 * Get the start of the current month (server time, UTC).
 * Used to determine if the monthly counter needs resetting.
 */
function getStartOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Check if the user can parse more invoices this month.
 * Also handles the monthly reset if needed.
 *
 * Returns:
 *   - { allowed: true } if the user can parse
 *   - { allowed: false, limit, count, message } if the user is at their limit
 *
 * Does NOT increment the counter — call incrementMonthlyParseCount() after
 * a successful parse to increment it.
 */
export async function checkMonthlyParseLimit(
  userId: string,
  plan: string,
): Promise<{ allowed: boolean; count: number; limit: number; message?: string }> {
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const startOfMonth = getStartOfMonth();

  // Fetch the current counter
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { monthlyParseCount: true, parseCountResetAt: true },
  });

  if (!user) {
    return { allowed: false, count: 0, limit, message: 'User not found' };
  }

  // Check if we need to reset the counter (new month)
  let currentCount = user.monthlyParseCount;
  const lastReset = user.parseCountResetAt;

  if (!lastReset || lastReset < startOfMonth) {
    // New month — reset the counter
    currentCount = 0;
    await db.user.update({
      where: { id: userId },
      data: {
        monthlyParseCount: 0,
        parseCountResetAt: startOfMonth,
      },
    });
    console.warn(`[parse-limit] Reset monthly counter for user ${userId} (new month: ${startOfMonth.toISOString()})`);
  }

  // Check against the limit
  if (currentCount >= limit) {
    return {
      allowed: false,
      count: currentCount,
      limit,
      message: `Monthly limit reached (${currentCount}/${limit} invoices parsed this month). You've used your entire quota for this billing period. The limit resets on the 1st of next month. Upgrade to a higher plan for more capacity.`,
    };
  }

  return { allowed: true, count: currentCount, limit };
}

/**
 * Increment the monthly parse counter by 1.
 * Call this AFTER a successful invoice parse (in /api/parse or /api/pending-review/[id]/approve).
 *
 * If the counter hasn't been initialized for this month yet, this also
 * sets parseCountResetAt to the start of the current month.
 */
export async function incrementMonthlyParseCount(userId: string): Promise<void> {
  const startOfMonth = getStartOfMonth();

  // Check if we need to reset first (handles the edge case where the
  // month changed between the check and the increment)
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { monthlyParseCount: true, parseCountResetAt: true },
  });

  if (!user) return;

  if (!user.parseCountResetAt || user.parseCountResetAt < startOfMonth) {
    // New month — reset and set to 1
    await db.user.update({
      where: { id: userId },
      data: {
        monthlyParseCount: 1,
        parseCountResetAt: startOfMonth,
      },
    });
  } else {
    // Same month — increment
    await db.user.update({
      where: { id: userId },
      data: {
        monthlyParseCount: user.monthlyParseCount + 1,
      },
    });
  }
}

/**
 * Get the user's current monthly parse count and limit for display.
 * Handles the monthly reset if needed.
 */
export async function getMonthlyParseStatus(
  userId: string,
  plan: string,
): Promise<{ count: number; limit: number; remaining: number; resetsAt: Date }> {
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const startOfMonth = getStartOfMonth();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { monthlyParseCount: true, parseCountResetAt: true },
  });

  if (!user) {
    return { count: 0, limit, remaining: limit, resetsAt: startOfMonth };
  }

  // Check if we need to reset
  let count = user.monthlyParseCount;
  if (!user.parseCountResetAt || user.parseCountResetAt < startOfMonth) {
    count = 0;
    await db.user.update({
      where: { id: userId },
      data: { monthlyParseCount: 0, parseCountResetAt: startOfMonth },
    });
  }

  // Calculate next reset date (1st of next month)
  const now = new Date();
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    count,
    limit,
    remaining: Math.max(0, limit - count),
    resetsAt: nextReset,
  };
}
