import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// POST /api/pending-review/[id]/restore — restore a skipped/blocked item to pending
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const item = await db.pendingReview.findFirst({
    where: { id, userId: auth.userId, status: { in: ['skipped', 'blocked'] } },
  });
  if (!item) {
    return NextResponse.json({ error: 'Item not found or not in a restorable state' }, { status: 404 });
  }

  // If it was blocked, remove the sender from the blocklist
  if (item.status === 'blocked' && item.fromAddress) {
    await db.emailBlocklist.deleteMany({
      where: { userId: auth.userId, address: item.fromAddress.toLowerCase() },
    });
  }

  await db.pendingReview.update({
    where: { id },
    data: { status: 'pending' },
  });

  return NextResponse.json({ success: true, message: 'Restored to pending' });
}
