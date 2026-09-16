import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'op-dev-secret-change-in-production';

// POST /api/auth/verify-email
// Body: { token: string } — the JWT verification token from the email link
//
// Verifies the token signature + expiry, then sets User.emailVerified = now().
// After verification, the user can use AI features (upload, scan, chat).

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = body.token;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Verification token is required.' },
        { status: 400 },
      );
    }

    // Verify the JWT signature + expiry
    let payload: { userId?: string; email?: string; purpose?: string };
    try {
      payload = jwt.verify(token, JWT_SECRET) as typeof payload;
    } catch {
      return NextResponse.json(
        { error: 'Verification link is invalid or has expired. Please request a new verification email.' },
        { status: 400 },
      );
    }

    // Verify the token has the correct purpose
    if (payload.purpose !== 'verify-email') {
      return NextResponse.json(
        { error: 'Invalid verification token.' },
        { status: 400 },
      );
    }

    if (!payload.userId) {
      return NextResponse.json(
        { error: 'Invalid verification token.' },
        { status: 400 },
      );
    }

    // Find the user
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found.' },
        { status: 404 },
      );
    }

    // Check if email matches (defense in depth — token may have been
    // issued before user changed their email)
    if (user.email !== payload.email) {
      return NextResponse.json(
        { error: 'This verification link is no longer valid. Please request a new one.' },
        { status: 400 },
      );
    }

    // Already verified
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Your email is already verified. You can continue using OmniParse AI.',
        alreadyVerified: true,
      });
    }

    // Mark email as verified
    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully. You can now use all OmniParse AI features.',
    });
  } catch (err) {
    console.error('[verify-email] Error:', err);
    return NextResponse.json(
      { error: 'Verification failed. Please try again or contact support.' },
      { status: 500 },
    );
  }
}
