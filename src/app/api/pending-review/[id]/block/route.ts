import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// POST /api/pending-review/[id]/block — skip + block sender (add to EmailBlocklist)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const item = await db.pendingReview.findFirst({ where: { id, userId: auth.userId, status: 'pending' } });
  if (!item) {
    return NextResponse.json({ error: 'Item not found or already processed' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 200) : null;

  // Add to blocklist (upsert — if already blocked, just update the reason)
  if (item.fromAddress) {
    await db.emailBlocklist.upsert({
      where: {
        userId_address: { userId: auth.userId, address: item.fromAddress.toLowerCase() },
      },
      update: { reason },
      create: {
        userId: auth.userId,
        address: item.fromAddress.toLowerCase(),
        reason,
      },
    });
  }

  // Mark pending item as blocked
  await db.pendingReview.update({
    where: { id },
    data: {
      status: 'blocked',
      // Keep attachmentData so the user can unblock + re-approve if they change their mind
    },
  });

  return NextResponse.json({ success: true, message: `Blocked ${item.fromAddress}` });
}
