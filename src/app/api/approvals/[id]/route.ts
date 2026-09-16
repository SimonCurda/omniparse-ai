import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';

const VALID_ACTIONS = ['approve', 'reject'];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!hasFeature(user.plan, 'approval_workflows')) {
      return NextResponse.json({ error: 'Approval workflows require Plus plan or higher' }, { status: 403 });
    }

    const { id } = await params;
    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice || invoice.userId !== user.id) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const body = await req.json();
    const { action, note } = body;

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Action must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
    }

    const approvalStatus = action === 'approve' ? 'approved' : 'rejected';
    const auditAction = action === 'approve' ? 'approved' : 'rejected';

    const updated = await db.invoice.update({
      where: { id },
      data: {
        approvalStatus,
        approvedBy: user.id,
        approvedAt: new Date(),
        approvalNote: note || null,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        invoiceId: id,
        action: auditAction,
        details: note ? { note } : {},
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
