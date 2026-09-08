import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!hasFeature(user.plan, 'approval_workflows')) {
      return NextResponse.json({ error: 'Approval workflows require Plus plan or higher' }, { status: 403 });
    }

    const status = req.nextUrl.searchParams.get('status');

    const where: Record<string, unknown> = {
      userId: user.id,
      approvalStatus: { notIn: ['none', 'auto_approved'] },
    };

    if (status && ['pending_review', 'approved', 'rejected', 'blocked'].includes(status)) {
      (where.approvalStatus as Record<string, unknown>).equals = status;
      delete (where.approvalStatus as Record<string, unknown>).notIn;
    }

    const invoices = await db.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(invoices);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
