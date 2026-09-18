import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Plan gate: audit_trail is a Plus+ feature
    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (!user || !hasFeature(user.plan, 'audit_trail')) {
      return NextResponse.json({ error: 'Audit trail requires Plus plan or higher' }, { status: 403 });
    }

    const invoiceId = req.nextUrl.searchParams.get('invoiceId');

    const where: Record<string, unknown> = { userId: auth.userId };
    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(logs);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
