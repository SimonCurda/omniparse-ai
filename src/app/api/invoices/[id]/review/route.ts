import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// PATCH /api/invoices/[id]/review — Toggle "reviewed" state
//
// Persists the reviewed flag inside the existing `customFields` JSON column,
// so no DB migration is needed. The flag is a manual marker the user clicks
// in the UI to track which invoices they have already looked at, independent
// of the auto-detected `validationStatus`.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const invoice = await db.invoice.findFirst({
      where: { id, userId: auth.userId },
      select: { id: true, customFields: true },
    });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const reviewed = body.reviewed === true;
    const reviewedAt = reviewed ? new Date().toISOString() : null;

    const existing = (invoice.customFields as Record<string, unknown> | null) ?? {};
    const updatedCustomFields: Record<string, unknown> = {
      ...existing,
      reviewed,
      reviewedAt,
    };

    await db.invoice.update({
      where: { id },
      data: { customFields: updatedCustomFields as any },
    });

    await db.auditLog.create({
      data: {
        userId: auth.userId,
        invoiceId: id,
        action: reviewed ? 'reviewed' : 'unreviewed',
        details: { reviewed, reviewedAt },
      },
    });

    return NextResponse.json({
      id,
      reviewed,
      reviewedAt,
      customFields: updatedCustomFields,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
