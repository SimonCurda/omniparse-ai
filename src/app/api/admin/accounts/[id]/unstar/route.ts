import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET;
  if (!expectedKey || key !== expectedKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const user = await db.user.findUnique({ where: { id }, select: { id: true, email: true, starred: true } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!user.starred) return NextResponse.json({ message: 'Not starred.' });
    await db.user.update({ where: { id }, data: { starred: false } });
    return NextResponse.json({ success: true, message: `Account ${user.email} unstarred.` });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
