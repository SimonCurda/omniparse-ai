// ─── Email Service (Resend) ───────────────────────────────────────────────
//
// Sends transactional emails: email verification, password reset, etc.
// Uses Resend (https://resend.com) — free tier 100 emails/day, no credit card.
// Sign up at https://resend.com, get API key at https://resend.com/api-keys,
// set as RESEND_API_KEY env var.
//
// Default sender: onboarding@resend.dev (works immediately for testing).
// For production, verify your own domain at https://resend.com/domains
// and set RESEND_FROM_EMAIL env var (e.g. noreply@omniparse-ai.com).
//
// CRITICAL: This file must ONLY be imported from server-side code (API routes).
// Never import from client components — Resend API key must stay server-side.

import { Resend } from 'resend';

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://omniparse-ai.vercel.app';
}

/**
 * Send email verification link to a newly-registered user.
 *
 * The link contains a JWT signed with JWT_SECRET containing:
 *   { userId, purpose: 'verify-email', iat, exp }
 *
 * When the user clicks the link, the frontend calls
 * POST /api/auth/verify-email with the token, which verifies the JWT
 * signature + expiry, then sets User.emailVerified = now().
 *
 * Link expires after 24 hours. If user doesn't verify in time, they
 * can request a new link via /api/auth/resend-verification.
 *
 * Returns true on success, false on failure (logged to console).
 */
export async function sendVerificationEmail(
  email: string,
  verificationToken: string,
): Promise<boolean> {
  const client = getResendClient();
  if (!client) {
    console.error('[email] RESEND_API_KEY not set — cannot send verification email');
    return false;
  }

  const verificationUrl = `${getAppUrl()}/?verify_token=${verificationToken}`;
  const fromEmail = getFromEmail();

  console.warn(`[email] Sending verification email to ${email} from ${fromEmail} (URL: ${verificationUrl.substring(0, 60)}...)`);

  try {
    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Verify your email — OmniParse AI',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Verify your email — OmniParse AI</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #0f172a;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
            <span style="color: white; font-weight: 700; font-size: 18px;">OmniParse AI</span>
          </div>
          <h1 style="font-size: 24px; margin: 0 0 16px;">Verify your email address</h1>
          <p style="font-size: 15px; line-height: 1.6; color: #475569;">
            Welcome to OmniParse AI! Click the button below to verify your email address and activate your account.
          </p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${verificationUrl}" style="background: #f59e0b; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
              Verify email
            </a>
          </p>
          <p style="font-size: 13px; line-height: 1.6; color: #64748b;">
            Or copy this link into your browser:
            <br>
            <a href="${verificationUrl}" style="color: #f59e0b; word-break: break-all;">${verificationUrl}</a>
          </p>
          <p style="font-size: 13px; line-height: 1.6; color: #64748b;">
            This link expires in 24 hours. If you didn't create an account with OmniParse AI, you can safely ignore this email.
          </p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
          <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
            OmniParse AI — AI-powered invoice intelligence platform.<br>
            <a href="${getAppUrl()}" style="color: #94a3b8;">${getAppUrl().replace(/^https?:\/\//, '')}</a>
          </p>
        </body>
        </html>
      `,
      text: `Verify your email — OmniParse AI

Welcome to OmniParse AI! Click the link below to verify your email address:

${verificationUrl}

This link expires in 24 hours. If you didn't create an account with OmniParse AI, you can safely ignore this email.
`,
    });

    if (error) {
      console.error('[email] Resend API error:', JSON.stringify(error));
      return false;
    }

    console.warn(`[email] Verification email sent to ${email} (id: ${data?.id || 'unknown'})`);
    return true;
  } catch (err) {
    console.error('[email] Failed to send verification email:', err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) {
      console.error('[email] Stack:', err.stack);
    }
    return false;
  }
}
