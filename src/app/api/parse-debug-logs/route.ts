import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// ─── Parse Debug Logs ────────────────────────────────────────────────────────
// Reads / clears the ParseDebugLog entries for the requesting user. These logs
// are only surfaced when an admin has flipped `user.debugEnabled = true` for
// that account; otherwise the GET endpoint refuses to return anything (defence
// in depth — even if a client finds this endpoint, they get nothing unless an
// admin has explicitly opted them in).

// GET /api/parse-debug-logs — last 20 logs for this user (requires debugEnabled)
export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { debugEnabled: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (!user.debugEnabled) {
      // Don't 403 — that signals "you found the endpoint but you can't use it",
      // which leaks information. Return an empty list so the client UI just
      // shows "no logs" without knowing debug mode exists.
      return NextResponse.json({ logs: [], debugEnabled: false });
    }

    const logs = await db.parseDebugLog.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        filename: true,
        fileType: true,
        logs: true,
        success: true,
        error: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ logs, debugEnabled: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/parse-debug-logs — clear all logs for this user.
//
// We do NOT require debugEnabled here: an admin may have just flipped it off,
// and the user (or admin acting on their behalf) should still be able to wipe
// the historical logs. The user is identified by their JWT, so only the owner
// of the logs can delete them.
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await db.parseDebugLog.deleteMany({
      where: { userId: auth.userId },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
