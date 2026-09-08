import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';

const VALID_ACTIONS = ['flag_as_warning', 'flag_as_error', 'block'];
const VALID_OPERATORS = ['equals', 'contains', 'greater_than', 'less_than', 'not_empty', 'is_empty'];
const VALID_TYPES = ['and', 'or'];

function validateConditionJson(condJson: unknown): { valid: boolean; error?: string } {
  if (!condJson || typeof condJson !== 'object' || Array.isArray(condJson)) {
    return { valid: false, error: 'conditionJson must be an object' };
  }
  const cj = condJson as Record<string, unknown>;

  if (!VALID_TYPES.includes(cj.type as string)) {
    return { valid: false, error: 'type must be "and" or "or"' };
  }

  if (!Array.isArray(cj.conditions) || cj.conditions.length === 0) {
    return { valid: false, error: 'conditions must be a non-empty array' };
  }

  for (const c of cj.conditions) {
    if (!c || typeof c !== 'object') {
      return { valid: false, error: 'Each condition must be an object' };
    }
    const cond = c as Record<string, unknown>;
    if (!cond.field || typeof cond.field !== 'string') {
      return { valid: false, error: 'Each condition must have a "field" string' };
    }
    if (!VALID_OPERATORS.includes(cond.operator as string)) {
      return { valid: false, error: `Invalid operator: ${cond.operator}. Must be one of: ${VALID_OPERATORS.join(', ')}` };
    }
    // 'not_empty' and 'is_empty' don't need a value
    if (cond.operator !== 'not_empty' && cond.operator !== 'is_empty') {
      if (cond.value === undefined) {
        return { valid: false, error: `Condition for field "${cond.field}" requires a value` };
      }
    }
  }

  return { valid: true };
}

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

    if (!hasFeature(user.plan, 'custom_validation_rules')) {
      return NextResponse.json({ error: 'Custom validation rules require Plus plan or higher' }, { status: 403 });
    }

    const rules = await db.customRule.findMany({
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

    if (!hasFeature(user.plan, 'custom_validation_rules')) {
      return NextResponse.json({ error: 'Custom validation rules require Plus plan or higher' }, { status: 403 });
    }

    const body = await req.json();
    const { name, conditionJson, action, active } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const condValidation = validateConditionJson(conditionJson);
    if (!condValidation.valid) {
      return NextResponse.json({ error: condValidation.error }, { status: 400 });
    }

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Action must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
    }

    // Check rule count limits
    const currentCount = await db.customRule.count({ where: { userId: user.id } });
    const limits: Record<string, number | null> = { plus: 20, business: 50, enterprise: null };
    const limit = limits[user.plan];
    if (limit !== null && limit !== undefined && currentCount >= limit) {
      return NextResponse.json({ error: `Rule limit reached (${limit} rules for your plan). Upgrade for more.` }, { status: 403 });
    }

    const rule = await db.customRule.create({
      data: {
        userId: user.id,
        name: name.trim(),
        conditionJson: JSON.parse(JSON.stringify(conditionJson)),
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

    if (!hasFeature(user.plan, 'custom_validation_rules')) {
      return NextResponse.json({ error: 'Custom validation rules require Plus plan or higher' }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, conditionJson, action, active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Rule id is required' }, { status: 400 });
    }

    const existing = await db.customRule.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
    }

    if (conditionJson !== undefined) {
      const condValidation = validateConditionJson(conditionJson);
      if (!condValidation.valid) {
        return NextResponse.json({ error: condValidation.error }, { status: 400 });
      }
    }

    if (action !== undefined && !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Action must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
    }

    const rule = await db.customRule.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(conditionJson !== undefined ? { conditionJson: JSON.parse(JSON.stringify(conditionJson)) } : {}),
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

    if (!hasFeature(user.plan, 'custom_validation_rules')) {
      return NextResponse.json({ error: 'Custom validation rules require Plus plan or higher' }, { status: 403 });
    }

    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Rule id query parameter is required' }, { status: 400 });
    }

    const existing = await db.customRule.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    await db.customRule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
