import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/email-blocklist — list blocked senders
export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const blocklist = await db.emailBlocklist.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(blocklist);
}

// POST /api/email-blocklist — manually add a sender to blocklist
export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { address, reason } = body;

  if (!address || typeof address !== 'string') {
    return NextResponse.json({ error: 'address is required' }, { status: 400 });
  }

  const entry = await db.emailBlocklist.upsert({
    where: { userId_address: { userId: auth.userId, address: address.toLowerCase() } },
    update: { reason: typeof reason === 'string' ? reason.slice(0, 200) : null },
    create: {
      userId: auth.userId,
      address: address.toLowerCase(),
      reason: typeof reason === 'string' ? reason.slice(0, 200) : null,
    },
  });

  return NextResponse.json({ entry });
}

// DELETE /api/email-blocklist?id=... — remove a sender from blocklist
export async function DELETE(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 });

  const entry = await db.emailBlocklist.findFirst({ where: { id, userId: auth.userId } });
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.emailBlocklist.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
