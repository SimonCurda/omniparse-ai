import { NextRequest, NextResponse } from 'next/server';
import { buildBackupDump } from '@/lib/admin-backup';

// GET /api/admin/backup?key=CRON_SECRET
//
// Manual database backup endpoint. Exports the full database (minus a few
// sensitive / oversized fields) as a downloadable JSON file.
//
// SECURITY: Protected by CRON_SECRET env var. Never expose without it.
//
// Excluded fields (intentionally NOT in the dump):
//   - User.password, User.googleId, User.githubId — auth secrets
//   - EmailInbox.encryptedPassword — IMAP credentials (AES blob)
//   - Invoice.fileData — base64 PDF blobs (can be huge; bloats the dump)
//   - PendingReview.attachmentData — base64 attachment blobs
//   - Invoice.rawExtraction — can be very large for complex invoices
//
// Everything else is included verbatim so the dump is a faithful snapshot
// of the database state at the time of the request.
//
// The dump-building logic lives in /src/lib/admin-backup.ts so it can be
// shared with the GitHub push endpoint without duplication.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET;

  if (!expectedKey) {
    return NextResponse.json(
      { error: 'CRON_SECRET env var is not set.' },
      { status: 500 },
    );
  }
  if (key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const backup = await buildBackupDump();

    return new NextResponse(backup.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${backup.filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    console.error('[admin/backup] Error:', err);
    return NextResponse.json(
      { error: 'Failed to generate backup', details: String(err) },
      { status: 500 },
    );
  }
}
