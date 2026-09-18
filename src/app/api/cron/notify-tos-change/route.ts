import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendTosChangeEmail } from '@/lib/email-service';

/**
 * POST /api/cron/notify-tos-change
 *
 * Sends a "material change to Terms of Service" email to all users who have
 * not yet been notified for the current change cycle.
 *
 * Triggered manually after a material ToS change is committed. To use:
 *
 * 1. Set CRON_SECRET env var.
 * 2. After deploying a material ToS change, call this endpoint once:
 *    curl -X POST https://omniparse-ai.vercel.app/api/cron/notify-tos-change \
 *      -H "Authorization: Bearer $CRON_SECRET" \
 *      -H "Content-Type: application/json" \
 *      -d '{"lastUpdated":"September 18, 2026","effectiveDate":"October 18, 2026","summary":"..."}'
 *
 * 3. The endpoint loops over all users where lastTosEmailSentAt is null OR
 *    older than the cutoff timestamp, sends the email via Resend, and marks
 *    them as notified. Idempotent — safe to retry.
 *
 * Per GDPR Art. 12 + Czech Civil Code § 1752, material changes that worsen
 * the user's position require 30 days' advance notice. Set the
 * `effectiveDate` parameter to at least 30 days from now.
 *
 * Rate-limiting: Resend free tier is 100 emails/day. We send in batches of 50
 * with a 500ms delay between sends to stay well under the limit. For larger
 * user bases, upgrade to Resend Pro and increase BATCH_SIZE.
 */
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500;

export async function POST(req: Request) {
  // Auth check
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[cron/notify-tos-change] CRON_SECRET env var is not set. Refusing request.');
    return NextResponse.json(
      { error: 'Cron endpoint not configured. Set CRON_SECRET env var.' },
      { status: 503 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse body
  let body: { lastUpdated?: string; effectiveDate?: string; summary?: string; cutoff?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { lastUpdated, effectiveDate, summary, cutoff } = body;
  if (!lastUpdated || !effectiveDate || !summary) {
    return NextResponse.json(
      { error: 'Missing required fields: lastUpdated, effectiveDate, summary' },
      { status: 400 }
    );
  }

  // Validate 30-day notice period (GDPR Art. 12 + Czech CC §1752)
  const effective = new Date(effectiveDate);
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  if (effective < thirtyDaysFromNow) {
    return NextResponse.json(
      {
        error: `effectiveDate must be at least 30 days from now (i.e., on or after ${thirtyDaysFromNow.toISOString().split('T')[0]}). Per GDPR Art. 12 + Czech CC §1752, material changes require 30 days' advance notice.`,
      },
      { status: 400 }
    );
  }

  // Find users who haven't been notified yet for this change cycle.
  // "Not notified" = lastTosEmailSentAt is null OR older than the cutoff (if provided).
  // The cutoff lets the operator re-trigger notifications for a new change cycle:
  // pass cutoff = the deployment timestamp of the new ToS version.
  const cutoffDate = cutoff ? new Date(cutoff) : new Date(0); // default: epoch = notify everyone
  const where = {
    emailVerified: { not: null }, // only verified users
    active: true,
    withdrawnAt: null, // skip withdrawn users
    OR: [{ lastTosEmailSentAt: null }, { lastTosEmailSentAt: { lt: cutoffDate } }],
  };

  const usersToNotify = await db.user.findMany({
    where,
    select: { id: true, email: true },
    take: BATCH_SIZE, // safety cap per call — call multiple times if more users
  });

  if (usersToNotify.length === 0) {
    return NextResponse.json({
      message: 'No users to notify.',
      notifiedCount: 0,
    });
  }

  let successCount = 0;
  let failureCount = 0;
  const failures: { userId: string; email: string; error: string }[] = [];

  for (const user of usersToNotify) {
    const ok = await sendTosChangeEmail(user.email, {
      lastUpdated,
      effectiveDate,
      summary,
    });

    if (ok) {
      // Mark as notified
      await db.user.update({
        where: { id: user.id },
        data: { lastTosEmailSentAt: new Date() },
      });
      successCount++;
    } else {
      failureCount++;
      failures.push({
        userId: user.id,
        email: user.email,
        error: 'Resend send failed — see server logs',
      });
    }

    // Delay between sends to respect Resend rate limits
    await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
  }

  console.warn(
    `[cron/notify-tos-change] Batch complete: ${successCount} sent, ${failureCount} failed (cutoff=${cutoffDate.toISOString()}, effective=${effectiveDate})`
  );

  return NextResponse.json({
    message: 'ToS change notification batch complete',
    notifiedCount: successCount,
    failureCount,
    failures: failures.slice(0, 10), // cap returned failures
    remainingToNotify: usersToNotify.length === BATCH_SIZE ? 'possibly more — call again with same body' : 0,
  });
}
