import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

// POST /api/admin/accounts/[id]/reset-password?key=CRON_SECRET
// Body: { password: string }
//
// Admin-initiated password reset. Sets a new password on the user's
// account directly (no email verification loop — the admin is
// authenticated via CRON_SECRET and is expected to have verified the
// requester's identity out-of-band, per ToS §4a).
//
// This also works for OAuth-only accounts (password == null) — it sets
// a password so the user can sign in with email+password in addition
// to their OAuth provider.
//
// SECURITY: Protected by CRON_SECRET env var. Never expose without it.

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
    const password = body.password;

    if (typeof password !== 'string' || !password) {
      return NextResponse.json({ error: 'password is required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, password: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const hashed = await hashPassword(password);

    await db.user.update({
      where: { id },
      data: { password: hashed },
    });

    // Log the reset action
    await db.auditLog.create({
      data: {
        userId: id,
        action: 'password_reset_by_admin',
        details: { resetBy: 'admin', email: user.email },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Password reset for ${user.email}`,
    });
  } catch (err) {
    console.error('[admin/reset-password] Error:', err);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
