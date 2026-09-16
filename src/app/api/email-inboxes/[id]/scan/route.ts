import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, isEmailVerified } from '@/lib/auth';
import { scanInbox } from '@/lib/email-scanner';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/validation';

// POST /api/email-inboxes/[id]/scan — manually scan an inbox for new invoices
//
// Query params:
//   ?reset=true  — clear lastSeenUID + scannedUIDs before scanning, so we
//                  re-examine every email in the inbox from the beginning.
//                  Useful when a filter bug previously caused emails to be
//                  silently skipped (e.g., inline image attachments).
//
// Body:
//   { direction: 'oldest' | 'newest' } — default 'oldest'
//
// Rate limited: 10 scans per hour per user (prevents scan spam that could
// burn AI quota). Reset every hour.
//
// Vercel Hobby tier caps function duration at 60s. We set maxDuration = 60
// and the scanner internally stops at ~50s to leave buffer for response.
export const maxDuration = 60;

const SCAN_LIMIT_PER_HOUR = 10;
const SCAN_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ─── Per-user scan rate limit (prevents scan spam) ──────────────
  // Scoped to userId, not IP — prevents a single user from burning
  // AI quota by spamming the Scan button or scripting the endpoint.
  // Limit: 10 scans/hour. Reset every hour.
  if (rateLimit(`scan:${auth.userId}`, SCAN_LIMIT_PER_HOUR, SCAN_WINDOW_MS)) {
    return NextResponse.json(
      {
        error: `Scan limit reached (${SCAN_LIMIT_PER_HOUR} scans per hour). Please wait before scanning again.`,
        code: 'SCAN_RATE_LIMITED',
      },
      { status: 429 },
    );
  }

  const inbox = await db.emailInbox.findFirst({ where: { id, userId: auth.userId } });
  if (!inbox) {
    return NextResponse.json({ error: 'Inbox not found' }, { status: 404 });
  }
  if (!inbox.active) {
    return NextResponse.json({ error: 'Inbox is paused. Activate it in Settings first.' }, { status: 400 });
  }

  // ─── Email verification check ───────────────────────────────────
  // Block scanning until the user's email is verified. This prevents
  // attackers from creating fake accounts and immediately scanning
  // inboxes to burn AI quota.
  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { emailVerified: true, createdAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (!isEmailVerified(user.emailVerified, user.createdAt)) {
    return NextResponse.json(
      {
        error: 'Email verification required. Please verify your email address before scanning inboxes.',
        code: 'EMAIL_NOT_VERIFIED',
      },
      { status: 403 },
    );
  }

  // Check for ?reset=true — clears the scan cursor so we re-examine every email
  const url = new URL(req.url);
  const reset = url.searchParams.get('reset') === 'true';
  if (reset) {
    // Force-rescan is more expensive — apply stricter rate limit (2/hour)
    if (rateLimit(`scan-reset:${auth.userId}`, 2, SCAN_WINDOW_MS)) {
      return NextResponse.json(
        {
          error: 'Force Rescan limit reached (2 per hour). Please wait before force-rescanning again.',
          code: 'SCAN_RESET_RATE_LIMITED',
        },
        { status: 429 },
      );
    }

    await db.emailInbox.update({
      where: { id },
      data: {
        lastSeenUID: 0,
        scannedUIDs: [],
      },
    });
  }

  // Parse direction from request body
  const body = await req.json().catch(() => ({}));
  const direction = body.direction === 'newest' ? 'newest' : 'oldest';

  const result = await scanInbox(id, auth.userId, { maxDurationMs: 50_000, direction });

  return NextResponse.json(result);
}
