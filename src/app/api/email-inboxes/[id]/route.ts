import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// DELETE /api/email-inboxes/[id] — delete an inbox + its pending reviews
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const inbox = await db.emailInbox.findFirst({ where: { id, userId: auth.userId } });
  if (!inbox) {
    return NextResponse.json({ error: 'Inbox not found' }, { status: 404 });
  }

  // Delete pending reviews first (cascade is set in Prisma schema, but explicit is safer)
  await db.pendingReview.deleteMany({ where: { inboxId: id } });

  await db.emailInbox.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: 'email_inbox_removed',
      details: { inboxId: id, label: inbox.label, emailAddress: inbox.emailAddress },
    },
  });

  return NextResponse.json({ success: true });
}
