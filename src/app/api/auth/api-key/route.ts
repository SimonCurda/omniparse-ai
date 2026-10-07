import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { randomBytes } from 'crypto';

// GET /api/auth/api-key — return the current user's API key (generates one
//   on first call if none exists yet). The key is shown in the Settings →
//   API Access card so the user can copy it.
//
// POST /api/auth/api-key — regenerate the API key. The old key is
//   immediately invalidated. Returns the new key.
//
// DELETE /api/auth/api-key — revoke (clear) the API key. External scripts
//   using the old key will get 401 on all subsequent requests.
//
// Auth: requires a valid Bearer JWT (NOT an API key — you can't use the
// API key to manage the API key, to prevent lockout).

export const dynamic = 'force-dynamic';

function generateApiKey(): string {
  // 32 bytes of randomness → 64 hex chars. Prefixed with "op_live_" so
  // it's identifiable as an OmniParse key (and easy to grep for in logs).
  return 'op_live_' + randomBytes(32).toString('hex');
}

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { apiKey: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Auto-generate on first access so the user doesn't have to click
    // "generate" — the key is just there waiting for them.
    if (!user.apiKey) {
      const newKey = generateApiKey();
      await db.user.update({
        where: { id: auth.userId },
        data: { apiKey: newKey },
      });
      return NextResponse.json({ apiKey: newKey });
    }

    return NextResponse.json({ apiKey: user.apiKey });
  } catch (err) {
    console.error('[api-key GET] Error:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve API key' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const newKey = generateApiKey();
    await db.user.update({
      where: { id: auth.userId },
      data: { apiKey: newKey },
    });
    return NextResponse.json({ apiKey: newKey });
  } catch (err) {
    console.error('[api-key POST] Error:', err);
    return NextResponse.json(
      { error: 'Failed to regenerate API key' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.user.update({
      where: { id: auth.userId },
      data: { apiKey: null },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[api-key DELETE] Error:', err);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 },
    );
  }
}
