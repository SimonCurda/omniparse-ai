import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET;
  if (!expectedKey || key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const user = await db.user.findUnique({ where: { id }, select: { id: true, email: true, hidden: true } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!user.hidden) return NextResponse.json({ message: 'Account is not hidden.' });
    await db.user.update({ where: { id }, data: { hidden: false } });
    return NextResponse.json({ success: true, message: `Account ${user.email} restored to active view.` });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to unhide account' }, { status: 500 });
  }
}
