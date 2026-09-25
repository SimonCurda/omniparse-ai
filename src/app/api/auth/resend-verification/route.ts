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

    // In dev mode, or when email couldn't be sent, return the URL so the
    // user can verify manually. Useful when Resend free tier can't send
    // to the user's email (custom domain not verified).
    const isDevMode = process.env.NODE_ENV === 'development' || process.env.EMAIL_DEV_MODE === 'true';
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://omniparse-ai.vercel.app'}/?verify_token=${verificationToken}`;

    if (!sent) {
      return NextResponse.json({
        success: false,
        emailSent: false,
        // Return the URL so the user can click it manually
        ...(isDevMode ? { verificationUrl } : {}),
        error: 'Failed to send verification email (Resend may not be configured with a custom domain yet). ' +
               (isDevMode ? 'Click the verification link below to verify manually.' : 'Please contact support.'),
      }, { status: 200 });  // 200 not 500 — user can still verify via the URL
    }

    return NextResponse.json({
      success: true,
      emailSent: true,
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
