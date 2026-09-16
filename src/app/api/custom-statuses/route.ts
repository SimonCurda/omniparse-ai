import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';

// GET /api/custom-statuses
export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (!user || !hasFeature(user.plan, 'custom_lifecycle_statuses')) {
      return NextResponse.json({ error: 'Custom statuses require Plus plan or higher.' }, { status: 403 });
    }

    const statuses = await db.customStatus.findMany({
      where: { userId: auth.userId },
      orderBy: { sortOrder: 'asc' },
    });

    // Always include basic statuses
    const basic = [
      { id: '__pending', name: 'pending', color: '#f59e0b', sortOrder: 0, isBasic: true },
      { id: '__approved', name: 'approved', color: '#22c55e', sortOrder: 1, isBasic: true },
      { id: '__exported', name: 'exported', color: '#3b82f6', sortOrder: 2, isBasic: true },
      { id: '__paid', name: 'paid', color: '#8b5cf6', sortOrder: 3, isBasic: true },
    ];

    return NextResponse.json([
      ...basic,
      ...statuses.map((s) => ({ ...s, isBasic: false })),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/custom-statuses
export async function POST(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (!user || !hasFeature(user.plan, 'custom_lifecycle_statuses')) {
      return NextResponse.json({ error: 'Custom statuses require Plus plan or higher.' }, { status: 403 });
    }

    const body = await req.json();
    const { name, color, sortOrder } = body;

    if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });

    const reserved = ['pending', 'approved', 'exported', 'paid'];
    if (reserved.includes(name.toLowerCase())) {
      return NextResponse.json({ error: 'Cannot use reserved status name.' }, { status: 400 });
    }

    const existing = await db.customStatus.count({ where: { userId: auth.userId } });
    if (existing >= 20) {
      return NextResponse.json({ error: 'Maximum 20 custom statuses.' }, { status: 400 });
    }

    const status = await db.customStatus.create({
      data: {
        userId: auth.userId,
        name,
        color: color || '#6b7280',
        sortOrder: sortOrder ?? existing,
      },
    });

    return NextResponse.json(status, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/custom-statuses?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (!user || !hasFeature(user.plan, 'custom_lifecycle_statuses')) {
      return NextResponse.json({ error: 'Custom statuses require Plus plan or higher.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Status id is required.' }, { status: 400 });

    const status = await db.customStatus.findFirst({ where: { id, userId: auth.userId } });
    if (!status) return NextResponse.json({ error: 'Status not found' }, { status: 404 });

    // Reset any invoices using this status back to pending
    await db.invoice.updateMany({
      where: { userId: auth.userId, lifecycleStatus: status.name },
      data: { lifecycleStatus: 'pending' },
    });

    await db.customStatus.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
