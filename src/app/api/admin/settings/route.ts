import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/settings?key=CRON_SECRET
//   Returns admin-configured settings (session timeout, etc.)
//
// PUT /api/admin/settings?key=CRON_SECRET
//   Body: { sessionTimeout: string }
//   Updates the session timeout setting.
//
// Settings are stored in the FeatureFlag table with a special prefix
// "setting_" to distinguish them from boolean flags. The value is stored
// in the `updatedBy` column (repurposed as a string value store).

export const dynamic = 'force-dynamic';

function checkAuth(req: NextRequest): boolean {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET;
  return !!expectedKey && key === expectedKey;
}

// Valid session timeout options
export const VALID_TIMEOUTS = ['5m', '10m', '15m', '30m', '1h', '1d', '7d', 'never'];

// Convert timeout string to JWT expiresIn value
export function timeoutToExpiry(timeout: string): string {
  switch (timeout) {
    case '5m': return '5m';
    case '10m': return '10m';
    case '15m': return '15m';
    case '30m': return '30m';
    case '1h': return '1h';
    case '1d': return '1d';
    case '7d': return '7d';
    case 'never': return '365d'; // 1 year — effectively "never"
    default: return '7d';
  }
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const row = await db.featureFlag.findUnique({
      where: { flag: 'setting_session_timeout' },
    });
    const sessionTimeout = row?.updatedBy || '7d';
    return NextResponse.json({ sessionTimeout });
  } catch (err) {
    console.error('[admin/settings GET] Error:', err);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { sessionTimeout?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const timeout = body.sessionTimeout;
  if (!timeout || !VALID_TIMEOUTS.includes(timeout)) {
    return NextResponse.json(
      { error: `sessionTimeout must be one of: ${VALID_TIMEOUTS.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    // Upsert the setting in the FeatureFlag table.
    // We use `updatedBy` as a string value store (it's a string column).
    const existing = await db.featureFlag.findUnique({
      where: { flag: 'setting_session_timeout' },
    });
    if (existing) {
      await db.featureFlag.update({
        where: { flag: 'setting_session_timeout' },
        data: { updatedBy: timeout, updatedAt: new Date() },
      });
    } else {
      await db.featureFlag.create({
        data: { flag: 'setting_session_timeout', enabled: true, updatedBy: timeout },
      });
    }

    return NextResponse.json({ ok: true, sessionTimeout: timeout });
  } catch (err) {
    console.error('[admin/settings PUT] Error:', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
