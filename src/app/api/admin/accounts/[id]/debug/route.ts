import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/admin/accounts/[id]/debug?key=CRON_SECRET
// Body: { enabled: boolean }
//
// Toggles the `debugEnabled` flag on a user. When enabled, the upload tab
// shows a "Debug" button that surfaces parse diagnostic logs (see
// /api/parse-debug-logs). When disabled, no debug logs are returned and
// existing logs are not surfaced — but they are not deleted here (use the
// user's own /api/parse-debug-logs DELETE endpoint to clear them).
//
// Auth: CRON_SECRET query param (same as the other admin account routes).

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET;

  if (!expectedKey || key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Request body must be { enabled: boolean }.' },
        { status: 400 },
      );
    }

    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, debugEnabled: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (user.debugEnabled === body.enabled) {
      return NextResponse.json({
        success: true,
        message: `Debug mode already ${body.enabled ? 'enabled' : 'disabled'} for ${user.email}.`,
        debugEnabled: user.debugEnabled,
      });
    }

    await db.user.update({
      where: { id },
      data: { debugEnabled: body.enabled },
    });

    // Audit trail so admins can see who flipped debug mode and when.
    await db.auditLog.create({
      data: {
        userId: id,
        action: 'debug_mode_toggled',
        details: {
          enabled: body.enabled,
          changedBy: 'admin',
        },
      },
    });

    console.warn(
      `[admin/debug] ${body.enabled ? 'Enabled' : 'Disabled'} debug mode for ${user.email}`,
    );

    return NextResponse.json({
      success: true,
      message: `Debug mode ${body.enabled ? 'enabled' : 'disabled'} for ${user.email}.`,
      debugEnabled: body.enabled,
    });
  } catch (err) {
    console.error('[admin/debug] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
