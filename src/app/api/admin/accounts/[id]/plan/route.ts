import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/admin/accounts/[id]/plan?key=CRON_SECRET
// Body: { plan: 'free' | 'pro' | 'plus' | 'business' | 'enterprise' }
//
// Changes a user's plan. Used internally by the admin dashboard.

const VALID_PLANS = ['free', 'pro', 'plus', 'business', 'enterprise'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET;

  if (!expectedKey || key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const newPlan = body.plan;

    if (!newPlan || !VALID_PLANS.includes(newPlan)) {
      return NextResponse.json(
        { error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` },
        { status: 400 },
      );
    }

    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, plan: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.plan === newPlan) {
      return NextResponse.json({ message: `Account is already on ${newPlan} plan.` });
    }

    await db.user.update({
      where: { id },
      data: { plan: newPlan },
    });

    // Log the plan change
    await db.auditLog.create({
      data: {
        userId: id,
        action: 'plan_changed',
        details: { oldPlan: user.plan, newPlan, changedBy: 'admin' },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Account ${user.email} plan changed from ${user.plan} to ${newPlan}.`,
      oldPlan: user.plan,
      newPlan,
    });
  } catch (err) {
    console.error('[admin/plan] Error:', err);
    return NextResponse.json({ error: 'Failed to change plan' }, { status: 500 });
  }
}
