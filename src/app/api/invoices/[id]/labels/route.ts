import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// ─── Invoice ↔ Label endpoints ──────────────────────────────────────────────
// Manage which labels are attached to a given invoice. All endpoints require
// that the invoice belongs to the requesting user (no cross-user access).
//
// Idempotency: the InvoiceLabel table has @@unique([invoiceId, labelId]),
// so re-assigning the same label is a no-op (we swallow the P2002 specifically
// and only that error — every other DB error must surface as 500).

/**
 * Verify the invoice exists and belongs to the requesting user. Returns the
 * invoice id (string) on success, or a NextResponse on failure. Callers should
 * short-circuit on the response.
 */
async function requireOwnedInvoice(
  invoiceId: string,
  userId: string,
): Promise<string | NextResponse> {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, userId },
    select: { id: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }
  return invoice.id;
}

// GET /api/invoices/[id]/labels — list labels attached to this invoice.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: invoiceId } = await params;
    const owned = await requireOwnedInvoice(invoiceId, auth.userId);
    if (owned instanceof NextResponse) return owned;

    const rows = await db.invoiceLabel.findMany({
      where: { invoiceId },
      include: {
        label: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(
      rows.map((r) => ({
        id: r.label.id,
        name: r.label.name,
        color: r.label.color,
        assignedAt: r.createdAt,
      })),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/invoices/[id]/labels — assign a label to an invoice.
// Body: { labelId: string }
//
// On the unique-constraint P2002 (label already assigned), treat as success
// (idempotent). All other errors are logged and returned as 500.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: invoiceId } = await params;
    const owned = await requireOwnedInvoice(invoiceId, auth.userId);
    if (owned instanceof NextResponse) return owned;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || typeof body.labelId !== 'string' || !body.labelId) {
      return NextResponse.json({ error: 'labelId is required.' }, { status: 400 });
    }
    const labelId = body.labelId;

    // The label must belong to the same user — prevents a malicious client
    // from attaching another user's label id to their own invoice (which
    // would leak the other user's label name/color via the GET response).
    const label = await db.label.findFirst({
      where: { id: labelId, userId: auth.userId },
      select: { id: true, name: true, color: true },
    });
    if (!label) {
      return NextResponse.json({ error: 'Label not found.' }, { status: 404 });
    }

    try {
      await db.invoiceLabel.create({
        data: { invoiceId, labelId },
      });
    } catch (err) {
      // ONLY swallow unique-constraint errors — those mean the label was
      // already attached, which is the desired end state (idempotent assign).
      // Any other error must be logged and surfaced as a 500.
      const isUniqueViolation =
        err && typeof err === 'object' && 'code' in err && err.code === 'P2002';
      if (isUniqueViolation) {
        return NextResponse.json({
          id: label.id,
          name: label.name,
          color: label.color,
          alreadyAssigned: true,
        });
      }
      console.error('[invoices/[id]/labels] POST failed:', err);
      return NextResponse.json({ error: 'Failed to assign label.' }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: label.id,
        name: label.name,
        color: label.color,
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/invoices/[id]/labels?labelId=xxx — remove a label from an invoice.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: invoiceId } = await params;
    const owned = await requireOwnedInvoice(invoiceId, auth.userId);
    if (owned instanceof NextResponse) return owned;

    const { searchParams } = new URL(req.url);
    const labelId = searchParams.get('labelId');
    if (!labelId) {
      return NextResponse.json({ error: 'labelId query param is required.' }, { status: 400 });
    }

    // Restrict the delete to rows whose label belongs to the same user
    // (via the invoice ownership we already checked + the label's userId
    // matching). findFirst gives us the cross-user safety check.
    const row = await db.invoiceLabel.findFirst({
      where: { invoiceId, labelId },
      select: { id: true },
    });
    if (!row) {
      // Idempotent delete — already gone, return success.
      return NextResponse.json({ success: true, alreadyRemoved: true });
    }

    await db.invoiceLabel.delete({ where: { id: row.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
