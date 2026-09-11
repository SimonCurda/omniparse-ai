import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/pending-review/[id] — get full pending item including attachment (for preview)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const item = await db.pendingReview.findFirst({
    where: { id, userId: auth.userId },
    select: {
      id: true,
      inboxId: true,
      fromAddress: true,
      fromName: true,
      subject: true,
      receivedAt: true,
      attachmentFilename: true,
      attachmentMime: true,
      attachmentData: true,
      classification: true,
      extractedData: true,
      status: true,
      createdAt: true,
    },
  });

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  return NextResponse.json(item);
}

// DELETE /api/pending-review/[id] — skip (mark as skipped, delete attachment data)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const item = await db.pendingReview.findFirst({ where: { id, userId: auth.userId } });
  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  await db.pendingReview.update({
    where: { id },
    data: {
      status: 'skipped',
      attachmentData: '', // free up storage
    },
  });

  return NextResponse.json({ success: true });
}
