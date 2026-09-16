import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, signToken } from '@/lib/auth';
import { signupSchema, getClientIp } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { sendVerificationEmail } from '@/lib/email-service';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'op-dev-secret-change-in-production';

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 3 attempts per minute
    const ip = getClientIp(req);
    if (rateLimit(ip, 3, 60_000)) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please wait a moment before trying again.' },
        { status: 429 },
      );
    }

    const body = await req.json();

    // Validate with Zod schema
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? 'Invalid input.' },
        { status: 400 },
      );
    }
    const { email, name, password } = parsed.data;

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      // Don't reveal that the email is already registered (prevent enumeration)
      return NextResponse.json({
        message: 'If this email is not already registered, an account has been created. Please check your email for verification.'
      }, { status: 200 });
    }

    const hashedPw = await hashPassword(password);

    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        password: hashedPw,
        termsAcceptedAt: new Date(),
        ageConfirmedAt: new Date(),
        emailVerified: null, // explicitly null until user clicks verification link
      },
      select: { id: true, email: true, name: true, plan: true, createdAt: true, emailVerified: true },
    });

    // Generate email verification token (JWT signed, expires in 24h)
    const verificationToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: 'verify-email' },
      JWT_SECRET,
      { expiresIn: '24h' },
    );

    // Send verification email (non-blocking — if Resend is not configured,
    // user can still log in but AI features will be blocked until verified)
    const emailSent = await sendVerificationEmail(user.email, verificationToken);

    // In dev mode (or when EMAIL_DEV_MODE is set), return the verification URL
    // in the response so the developer can click it directly without needing
    // Resend to be configured with a custom domain.
    //
    // This is useful because Resend's free tier (onboarding@resend.dev) can
    // only send to the email you signed up to Resend with — so testing with
    // other email addresses fails silently.
    //
    // In production, this is OFF by default. Set EMAIL_DEV_MODE=true in env
    // to enable it (e.g., for testing before your custom domain is verified).
    const isDevMode = process.env.NODE_ENV === 'development' || process.env.EMAIL_DEV_MODE === 'true';
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://omniparse-ai.vercel.app'}/?verify_token=${verificationToken}`;

    const token = signToken({ userId: user.id, email: user.email });

    return NextResponse.json({
      user,
      token,
      emailVerificationRequired: true,
      emailSent,
      // Only include the URL in dev mode OR if email couldn't be sent
      // (so the user isn't stuck without a way to verify)
      ...(isDevMode || !emailSent ? { verificationUrl } : {}),
      message: emailSent
        ? 'Account created. Please check your email for a verification link to activate AI features.'
        : 'Account created. We could not send the verification email (Resend may not be configured). Click the verification link shown in the response or contact support.',
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
