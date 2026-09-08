import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';

const VALID_BULK_ACTIONS = ['delete', 'change_status'];

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!hasFeature(user.plan, 'bulk_operations')) {
      return NextResponse.json({ error: 'Bulk operations require Plus plan or higher' }, { status: 403 });
    }

    const body = await req.json();
    const { action, invoiceIds, data } = body;

    if (!action || !VALID_BULK_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Action must be one of: ${VALID_BULK_ACTIONS.join(', ')}` }, { status: 400 });
    }

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json({ error: 'invoiceIds must be a non-empty array' }, { status: 400 });
    }

    if (invoiceIds.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 invoices per bulk action' }, { status: 400 });
    }

    // Verify ownership of all invoices
    const ownedInvoices = await db.invoice.findMany({
      where: { id: { in: invoiceIds }, userId: user.id },
      select: { id: true },
    });
    const ownedIds = new Set(ownedInvoices.map((inv) => inv.id));
    const count = ownedIds.size;

    if (count === 0) {
      return NextResponse.json({ error: 'No matching invoices found' }, { status: 404 });
    }

    if (action === 'delete') {
      // Delete all owned invoices
      await db.invoice.deleteMany({
        where: { id: { in: Array.from(ownedIds) } },
      });

      // Create audit log for each
      await db.auditLog.createMany({
        data: Array.from(ownedIds).map((invId) => ({
          userId: user.id,
          invoiceId: invId,
          action: 'deleted',
          details: { bulk: true },
        })),
      });
    } else if (action === 'change_status') {
      if (!data || !data.status) {
        return NextResponse.json({ error: 'data.status is required for change_status action' }, { status: 400 });
      }

      const newStatus = String(data.status);

      await db.invoice.updateMany({
        where: { id: { in: Array.from(ownedIds) } },
        data: { status: newStatus },
      });

      // Create audit log for each
      await db.auditLog.createMany({
        data: Array.from(ownedIds).map((invId) => ({
          userId: user.id,
          invoiceId: invId,
          action: 'edited',
          details: { bulk: true, field: 'status', newValue: newStatus },
        })),
      });
    }

    return NextResponse.json({ success: true, count });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
