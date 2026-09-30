import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { generateApiKey } from '@/lib/api-key';

// GET /api/api-keys — list user's API keys (without the full key value)
export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const keys = await db.apiKey.findMany({
    where: { userId: auth.userId },
    select: {
      id: true,
      keyPrefix: true,
      name: true,
      monthlyCount: true,
      countResetAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ keys });
}

// POST /api/api-keys — create a new API key. Returns the full key ONCE.
// Body: { name: string } — user-facing label like "Production" or "Zapier"
export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 50) : '';
  if (!name) {
    return NextResponse.json({ error: 'Name is required (e.g. "Production", "Zapier")' }, { status: 400 });
  }

  // Limit to 5 API keys per user (prevents abuse)
  const existingCount = await db.apiKey.count({ where: { userId: auth.userId } });
  if (existingCount >= 5) {
    return NextResponse.json({ error: 'Maximum 5 API keys allowed. Revoke an existing key first.' }, { status: 403 });
  }

  const { fullKey, keyHash, keyPrefix } = generateApiKey();

  const apiKey = await db.apiKey.create({
    data: {
      userId: auth.userId,
      keyHash,
      keyPrefix,
      name,
    },
    select: { id: true, keyPrefix: true, name: true, createdAt: true },
  });

  // Return the FULL KEY — this is the only time it's ever shown.
  // The user must copy it now; we can't recover it later.
  return NextResponse.json({
    ...apiKey,
    key: fullKey,
    warning: 'Copy this key now. For security, it will not be shown again.',
  }, { status: 201 });
}

// DELETE /api/api-keys?id=xxx — revoke (delete) an API key
export async function DELETE(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Key id is required' }, { status: 400 });
  }

  // Verify ownership
  const existing = await db.apiKey.findUnique({ where: { id } });
  if (!existing || existing.userId !== auth.userId) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  await db.apiKey.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
