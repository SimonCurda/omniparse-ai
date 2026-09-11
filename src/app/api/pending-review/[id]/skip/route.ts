import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// POST /api/pending-review/[id]/skip — skip a pending item (mark as skipped, delete attachment data)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const item = await db.pendingReview.findFirst({ where: { id, userId: auth.userId, status: 'pending' } });
  if (!item) {
    return NextResponse.json({ error: 'Item not found or already processed' }, { status: 404 });
  }

  await db.pendingReview.update({
    where: { id },
    data: {
      status: 'skipped',
      // Keep attachmentData so the user can restore + re-approve if they change their mind
    },
  });

  return NextResponse.json({ success: true });
}
