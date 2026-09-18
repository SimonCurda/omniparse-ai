import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// POST /api/pending-review/[id]/unapprove — undo an approval
// Deletes the Invoice that was created + restores the pending item to 'pending'
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const item = await db.pendingReview.findFirst({
    where: { id, userId: auth.userId, status: 'approved' },
  });
  if (!item) {
    return NextResponse.json({ error: 'Item not found or not approved' }, { status: 404 });
  }

  // Extract the invoiceId from the stored extractedData
  const extractedData = item.extractedData as Record<string, unknown> | null;
  const invoiceId = extractedData?.invoiceId as string | undefined;

  // Delete the Invoice if it exists
  if (invoiceId) {
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, userId: auth.userId },
      select: { id: true },
    });
    if (invoice) {
      await db.invoice.delete({ where: { id: invoiceId } });
      await db.auditLog.create({
        data: {
          userId: auth.userId,
          invoiceId,
          action: 'email_invoice_unapproved',
          details: { pendingReviewId: id, fromAddress: item.fromAddress },
        },
      });
    }
  }

  // Restore the pending item to 'pending' status
  await db.pendingReview.update({
    where: { id },
    data: { status: 'pending' },
  });

  return NextResponse.json({ success: true, message: 'Un-approved. The invoice was deleted and the item is back in pending.' });
}
