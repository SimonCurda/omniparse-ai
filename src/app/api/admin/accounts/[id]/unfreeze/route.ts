import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/admin/accounts/[id]/unfreeze?key=CRON_SECRET
//
// Unfreezes a previously frozen account.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET;

  if (!expectedKey || key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({ where: { id }, select: { id: true, email: true, active: true } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.active) {
      return NextResponse.json({ message: 'Account is already active.' });
    }

    await db.user.update({
      where: { id },
      data: {
        active: true,
        frozenReason: null,
        frozenAt: null,
      },
    });

    await db.auditLog.create({
      data: {
        userId: id,
        action: 'account_unfrozen',
        details: { unfrozenBy: 'admin' },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Account ${user.email} unfrozen.`,
    });
  } catch (err) {
    console.error('[admin/unfreeze] Error:', err);
    return NextResponse.json({ error: 'Failed to unfreeze account' }, { status: 500 });
  }
}
