import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── Cron: Retry Pending Invoices ────────────────────────────────────────────
// GET /api/cron/retry-pending?key=CRON_SECRET
//
// Finds invoices stuck in `status='pending_retry'` that still have fileData
// (so we can re-attempt parsing without asking the user to re-upload). For
// each one, we flip the status back to `review` so the user can re-trigger
// parsing from the UI, and set a human-readable errorMessage explaining what
// happened.
//
// Capped at MAX_PER_RUN invoices per call so a single cron tick doesn't pin
// the serverless function for too long. If there are more to retry, the next
// cron tick picks them up.
//
// Auth: ?key=CRON_SECRET query param (admin/cron pattern).

const MAX_PER_RUN = 10;

function authenticate(req: NextRequest): boolean {
  const key = new URL(req.url).searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return !!key && key === cronSecret;
}

export async function GET(req: NextRequest) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Only retry invoices that still have fileData — without it there's nothing
    // to re-parse and the user would have to re-upload anyway, so leaving them
    // in pending_retry is the correct state.
    const stuck = await db.invoice.findMany({
      where: {
        status: 'pending_retry',
        fileData: { not: null },
      },
      select: {
        id: true,
        userId: true,
        filename: true,
        errorMessage: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' }, // oldest first — they've been waiting longest
      take: MAX_PER_RUN,
    });

    if (stuck.length === 0) {
      return NextResponse.json({
        retried: 0,
        message: 'No pending_retry invoices with fileData to retry.',
      });
    }

    const now = new Date();
    const message =
      'Automatic retry queued by cron — please re-run extraction from the review tab.';

    // Update each invoice individually (rather than updateMany) so we can write
    // a per-invoice audit log entry. The audit log is the only record of WHO
    // flipped the status, which matters for support tickets.
    const updated: Array<{ id: string; userId: string }> = [];
    for (const inv of stuck) {
      await db.invoice.update({
        where: { id: inv.id },
        data: {
          status: 'review',
          errorMessage: message,
        },
      });

      await db.auditLog.create({
        data: {
          userId: inv.userId,
          invoiceId: inv.id,
          action: 'status_changed',
          details: {
            from: 'pending_retry',
            to: 'review',
            reason: 'cron_retry_pending',
            previousError: inv.errorMessage ?? null,
            triggeredBy: 'cron',
            triggeredAt: now.toISOString(),
          },
        },
      });

      updated.push({ id: inv.id, userId: inv.userId });
    }

    console.warn(
      `[cron/retry-pending] Reset ${updated.length} invoice(s) from pending_retry → review`,
    );

    return NextResponse.json({
      retried: updated.length,
      capped: updated.length === MAX_PER_RUN,
      message:
        updated.length === MAX_PER_RUN
          ? `Reached the per-run cap of ${MAX_PER_RUN}. Run again to continue.`
          : `Reset ${updated.length} invoice(s) to 'review'.`,
      invoices: updated,
    });
  } catch (err) {
    console.error('[cron/retry-pending] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
