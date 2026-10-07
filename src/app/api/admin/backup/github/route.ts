import { NextRequest, NextResponse } from 'next/server';
import { buildBackupDump, pushBackupToGitHub } from '@/lib/admin-backup';

// POST /api/admin/backup/github?key=CRON_SECRET
//
// Builds the same JSON dump as GET /api/admin/backup, but instead of
// streaming it to the browser, pushes it to a GitHub repo via the
// Contents API. The dump lands at:
//
//   backups/omniparse-backup-<timestamp>.json   (new file every run)
//   backups/latest.json                         (overwritten every run)
//
// Env vars (all required):
//   GITHUB_BACKUP_TOKEN  — PAT with contents:write on the target repo
//   GITHUB_BACKUP_OWNER  — repo owner login
//   GITHUB_BACKUP_REPO   — repo name
//
// SECURITY: Protected by CRON_SECRET env var. Never expose without it.

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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

  // Fail fast with a clear message if the GitHub env vars aren't configured.
  // We check this before building the dump so the admin gets instant feedback
  // instead of waiting for the (potentially large) snapshot to be assembled.
  const token = process.env.GITHUB_BACKUP_TOKEN;
  const owner = process.env.GITHUB_BACKUP_OWNER;
  const repo = process.env.GITHUB_BACKUP_REPO;
  if (!token || !owner || !repo) {
    return NextResponse.json(
      {
        error:
          'GitHub backup is not configured. Set GITHUB_BACKUP_TOKEN, GITHUB_BACKUP_OWNER, and GITHUB_BACKUP_REPO env vars.',
      },
      { status: 500 },
    );
  }

  try {
    const backup = await buildBackupDump();
    const result = await pushBackupToGitHub(backup);

    if (!result.ok) {
      console.error('[admin/backup/github] Push failed:', result.error);
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      filename: backup.filename,
      bytes: backup.bytes,
      url: result.url,
      latestUrl: result.latestUrl,
      pushedAt: backup.iso,
    });
  } catch (err) {
    console.error('[admin/backup/github] Error:', err);
    return NextResponse.json(
      { error: 'Failed to push backup to GitHub', details: String(err) },
      { status: 500 },
    );
  }
}
