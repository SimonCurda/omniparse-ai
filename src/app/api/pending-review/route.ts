import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/pending-review — list pending review items for the user
export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'pending';

  const items = await db.pendingReview.findMany({
    where: { userId: auth.userId, status },
    orderBy: { receivedAt: 'desc' },
    select: {
      id: true,
      inboxId: true,
      fromAddress: true,
      fromName: true,
      subject: true,
      receivedAt: true,
      attachmentFilename: true,
      attachmentMime: true,
      classification: true,
      status: true,
      createdAt: true,
      // Don't select attachmentData in the list view (it's base64, can be MBs)
    },
  });

  return NextResponse.json(items);
}
