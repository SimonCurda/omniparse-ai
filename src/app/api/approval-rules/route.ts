import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';

const VALID_ACTIONS = ['auto_approve', 'flag_for_review', 'block'];

async function getUser(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) return null;
  const user = await db.user.findUnique({ where: { id: auth.userId } });
  if (!user) return null;
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasFeature(user.plan, 'approval_workflows')) {
      return NextResponse.json({ error: 'Approval workflows require Plus plan or higher' }, { status: 403 });
    }

    const rules = await db.approvalRule.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(rules);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasFeature(user.plan, 'approval_workflows')) {
      return NextResponse.json({ error: 'Approval workflows require Plus plan or higher' }, { status: 403 });
    }

    const body = await req.json();
    const { name, minAmount, maxAmount, action, active } = body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Validate action
    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Action must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
    }

    // At least one of minAmount/maxAmount required
    if (minAmount === undefined && minAmount !== 0 && maxAmount === undefined && maxAmount !== 0) {
      return NextResponse.json({ error: 'At least one of minAmount or maxAmount is required' }, { status: 400 });
    }

    // Check rule count limits
    const currentCount = await db.approvalRule.count({ where: { userId: user.id } });
    const limits: Record<string, number | null> = { plus: 20, business: 30, enterprise: null };
    const limit = limits[user.plan];
    if (limit !== null && limit !== undefined && currentCount >= limit) {
      return NextResponse.json({ error: `Rule limit reached (${limit} rules for your plan). Upgrade for more.` }, { status: 403 });
    }

    const rule = await db.approvalRule.create({
      data: {
        userId: user.id,
        name: name.trim(),
        minAmount: minAmount !== undefined ? Number(minAmount) : null,
        maxAmount: maxAmount !== undefined ? Number(maxAmount) : null,
        action,
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasFeature(user.plan, 'approval_workflows')) {
      return NextResponse.json({ error: 'Approval workflows require Plus plan or higher' }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, minAmount, maxAmount, action, active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Rule id is required' }, { status: 400 });
    }

    // Check ownership
    const existing = await db.approvalRule.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Validate name if provided
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
    }

    // Validate action if provided
    if (action !== undefined && !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Action must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
    }

    const rule = await db.approvalRule.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(minAmount !== undefined ? { minAmount: Number(minAmount) } : {}),
        ...(maxAmount !== undefined ? { maxAmount: Number(maxAmount) } : {}),
        ...(action !== undefined ? { action } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {}),
      },
    });

    return NextResponse.json(rule);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasFeature(user.plan, 'approval_workflows')) {
      return NextResponse.json({ error: 'Approval workflows require Plus plan or higher' }, { status: 403 });
    }

    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Rule id query parameter is required' }, { status: 400 });
    }

    // Check ownership
    const existing = await db.approvalRule.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    await db.approvalRule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
