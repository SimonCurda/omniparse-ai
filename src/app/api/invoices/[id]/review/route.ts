import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// PATCH /api/invoices/[id]/review — Toggle "reviewed" state
//
// Persists the reviewed flag inside the existing `customFields` JSON column,
// so no DB migration is needed. The flag is a manual marker the user clicks
// in the UI to track which invoices they have already looked at, independent
// of the auto-detected `validationStatus`.
//
// SMART LIFECYCLE AUTOMATION:
// When the user marks an invoice as checked (reviewed=true), the lifecycle
// status is automatically bumped to "approved" — but ONLY if the current
// status is "pending" or empty. This prevents overwriting a more advanced
// status (e.g. "exported" or a custom terminal status the user set
// manually). When the user un-checks an invoice (reviewed=false), the
// lifecycle status is left untouched — the user can revert it manually if
// needed. This implements the workflow: pending → (review) → approved →
// (export) → exported.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const invoice = await db.invoice.findFirst({
      where: { id, userId: auth.userId },
      select: { id: true, customFields: true, lifecycleStatus: true },
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

    // Smart lifecycle: bump to "approved" only when marking as reviewed AND
    // the current lifecycle is still at its initial state ("pending" or
    // empty). This avoids overriding "exported" or any custom status the
    // user may have set.
    const shouldBumpToApproved =
      reviewed &&
      (!invoice.lifecycleStatus ||
        invoice.lifecycleStatus === '' ||
        invoice.lifecycleStatus === 'pending');

    await db.invoice.update({
      where: { id },
      data: {
        customFields: updatedCustomFields as any,
        ...(shouldBumpToApproved ? { lifecycleStatus: 'approved' } : {}),
      },
    });

    await db.auditLog.create({
      data: {
        userId: auth.userId,
        invoiceId: id,
        action: reviewed ? 'reviewed' : 'unreviewed',
        details: {
          reviewed,
          reviewedAt,
          ...(shouldBumpToApproved ? { lifecycleAutoBumped: 'approved' } : {}),
        },
      },
    });

    return NextResponse.json({
      id,
      reviewed,
      reviewedAt,
      customFields: updatedCustomFields,
      lifecycleStatus: shouldBumpToApproved ? 'approved' : invoice.lifecycleStatus,
      lifecycleAutoBumped: shouldBumpToApproved,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
