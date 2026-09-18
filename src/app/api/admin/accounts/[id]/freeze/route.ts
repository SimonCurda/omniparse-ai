import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/admin/accounts/[id]/freeze?key=CRON_SECRET
// Body: { reason: string }
//
// Freezes an account. The user can still log in but AI features
// (upload, scan, chat) are blocked. Used for abuse prevention.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET;

  if (!expectedKey || key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const reason = body.reason || 'Account frozen by administrator due to suspected abuse.';

    const user = await db.user.findUnique({ where: { id }, select: { id: true, email: true, active: true } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.active) {
      return NextResponse.json({ message: 'Account is already frozen.' });
    }

    await db.user.update({
      where: { id },
      data: {
        active: false,
        frozenReason: reason,
        frozenAt: new Date(),
      },
    });

    // Log the freeze action
    await db.auditLog.create({
      data: {
        userId: id,
        action: 'account_frozen',
        details: { reason, frozenBy: 'admin' },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Account ${user.email} frozen. Reason: ${reason}`,
    });
  } catch (err) {
    console.error('[admin/freeze] Error:', err);
    return NextResponse.json({ error: 'Failed to freeze account' }, { status: 500 });
  }
}
