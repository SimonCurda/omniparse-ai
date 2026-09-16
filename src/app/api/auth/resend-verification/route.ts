import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sendVerificationEmail } from '@/lib/email-service';
import { getClientIp } from '@/lib/validation';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'op-dev-secret-change-in-production';

// POST /api/auth/resend-verification
//
// Resends the email verification link to the authenticated user.
// Used when the user is logged in but their email is not yet verified.
//
// Rate limited: 3 requests per hour per IP (prevents abuse).

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (rateLimit(`resend-verify:${ip}`, 3, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many resend attempts. Please check your email and try again later.' },
        { status: 429 },
      );
    }

    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Your email is already verified.',
      });
    }

    // Generate new verification token
    const verificationToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: 'verify-email' },
      JWT_SECRET,
      { expiresIn: '24h' },
    );

    const sent = await sendVerificationEmail(user.email, verificationToken);

    if (!sent) {
      return NextResponse.json(
        { error: 'Failed to send verification email. Please contact support.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    });
  } catch (err) {
    console.error('[resend-verification] Error:', err);
    return NextResponse.json(
      { error: 'Failed to resend verification email.' },
      { status: 500 },
    );
  }
}
