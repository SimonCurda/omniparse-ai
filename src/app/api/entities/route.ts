import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature, PLAN_ENTITY_LIMITS } from '@/lib/auth';

// GET /api/entities
export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true, activeEntityId: true } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!hasFeature(user.plan, 'multi_entity')) {
      return NextResponse.json({ entities: [], activeEntityId: null, limit: 0 });
    }

    const entities = await db.entity.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ entities, activeEntityId: user.activeEntityId, limit: PLAN_ENTITY_LIMITS[user.plan] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/entities
export async function POST(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (!user || !hasFeature(user.plan, 'multi_entity')) {
      return NextResponse.json({ error: 'Multi-entity requires Business plan or higher.' }, { status: 403 });
    }

    const limit = PLAN_ENTITY_LIMITS[user.plan];
    const existing = await db.entity.count({ where: { userId: auth.userId } });
    if (existing >= limit) {
      return NextResponse.json({ error: `Entity limit reached (${limit}).` }, { status: 429 });
    }

    const body = await req.json();
    const { name } = body;
    if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });

    const entity = await db.entity.create({
      data: { userId: auth.userId, name },
    });

    return NextResponse.json(entity, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/entities?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (!user || !hasFeature(user.plan, 'multi_entity')) {
      return NextResponse.json({ error: 'Multi-entity requires Business plan or higher.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Entity id is required.' }, { status: 400 });

    const entity = await db.entity.findFirst({ where: { id, userId: auth.userId } });
    if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 404 });

    // Reset user's active entity if deleting the active one
    const userWithEntity = await db.user.findUnique({ where: { id: auth.userId }, select: { activeEntityId: true } });
    if (userWithEntity?.activeEntityId === id) {
      await db.user.update({ where: { id: auth.userId }, data: { activeEntityId: null } });
    }

    // Null out entity references on invoices before deleting the entity
    await db.invoice.updateMany({ where: { entityId: id, userId: auth.userId }, data: { entityId: null } });

    await db.entity.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
