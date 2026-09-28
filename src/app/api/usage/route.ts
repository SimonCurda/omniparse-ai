import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { getMonthlyParseStatus } from '@/lib/parse-limit';

// GET /api/usage — Returns the user's REAL monthly parse usage.
//
// WHY THIS EXISTS:
// The UI previously showed `invoices.length` as "invoices used this month",
// but that counts invoices the user still HAS (not what they PARSED this
// month). If a user uploaded 15 invoices then deleted them all, the UI
// would show "0/15" even though the user actually hit their monthly limit.
//
// This endpoint exposes the actual `monthlyParseCount` from the User table
// (incremented on every successful parse, reset by getMonthlyParseStatus()
// when the month changes).
export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { plan: true, monthlyParseCount: true, parseCountResetAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const status = await getMonthlyParseStatus(auth.userId, user.plan);

    return NextResponse.json({
      count: status.count,
      limit: status.limit,
      remaining: status.remaining,
      resetsAt: status.resetsAt.toISOString(),
      plan: user.plan,
      raw: {
        monthlyParseCount: user.monthlyParseCount,
        parseCountResetAt: user.parseCountResetAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/usage] error:', message);
    return NextResponse.json({ error: 'Failed to fetch usage.' }, { status: 500 });
  }
}
