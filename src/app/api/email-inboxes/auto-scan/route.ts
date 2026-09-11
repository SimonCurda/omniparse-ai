import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scanInbox } from '@/lib/email-scanner';

// GET /api/email-inboxes/auto-scan?key=SECRET
//
// External cron endpoint (cron-job.org, GitHub Actions, etc.) hits this URL
// every N minutes. It picks ONE inbox that hasn't been scanned recently and
// scans it. Next cron tick picks the next inbox.
//
// Security: the `key` query param must match the CRON_SECRET env var. This
// prevents randoms from triggering scans (which would burn AI tokens).
//
// Vercel Hobby: maxDuration = 60s. Scanner stops at ~50s internally.

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  const expectedKey = process.env.CRON_SECRET;
  if (!expectedKey) {
    return NextResponse.json(
      { error: 'CRON_SECRET env var is not set. Set it in your Vercel project settings.' },
      { status: 500 },
    );
  }
  if (key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find the inbox that hasn't been scanned for the longest time.
  // Only scan active inboxes. Scan at most once every 5 minutes per inbox.
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const inbox = await db.emailInbox.findFirst({
    where: {
      active: true,
      OR: [
        { lastScannedAt: null },
        { lastScannedAt: { lt: fiveMinutesAgo } },
      ],
    },
    orderBy: { lastScannedAt: 'asc' }, // oldest first
  });

  if (!inbox) {
    return NextResponse.json({
      ok: true,
      message: 'No inboxes due for scanning',
      scanned: false,
    });
  }

  // Scan it
  const result = await scanInbox(inbox.id, inbox.userId, { maxDurationMs: 50_000 });

  return NextResponse.json({
    ok: true,
    scanned: true,
    inbox: { id: inbox.id, label: inbox.label, emailAddress: inbox.emailAddress },
    result,
  });
}
