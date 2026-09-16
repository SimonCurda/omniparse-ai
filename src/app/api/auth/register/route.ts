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
    await sendVerificationEmail(user.email, verificationToken);

    const token = signToken({ userId: user.id, email: user.email });

    return NextResponse.json({
      user,
      token,
      emailVerificationRequired: true,
      message: 'Account created. Please check your email for a verification link to activate AI features.',
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
