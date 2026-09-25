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

/**
 * Send a "material change to Terms of Service" notification email.
 *
 * Per GDPR Art. 12 + Czech Civil Code § 1752, material changes to the Terms
 * that would worsen the user's position must be notified at least 30 days
 * before the change takes effect. This function sends such a notification
 * to a single user. The cron route /api/cron/notify-tos-change loops over
 * all eligible users and calls this function for each.
 *
 * Idempotency: the caller is responsible for setting User.lastTosEmailSentAt
 * after a successful send, and for filtering users where lastTosEmailSentAt
 * is already set to a recent timestamp for the current change cycle.
 *
 * Returns true on success, false on failure.
 */
export async function sendTosChangeEmail(
  email: string,
  params: { lastUpdated: string; summary: string; effectiveDate: string }
): Promise<boolean> {
  const client = getResendClient();
  if (!client) {
    console.error('[email] RESEND_API_KEY not set — cannot send ToS change email');
    return false;
  }

  const fromEmail = getFromEmail();
  const appUrl = getAppUrl();
  const tosUrl = `${appUrl}/terms-of-service`;
  const { lastUpdated, summary, effectiveDate } = params;

  const subject = `Important: OmniParse Terms of Service update (effective ${effectiveDate})`;

  console.warn(`[email] Sending ToS-change email to ${email} (effective ${effectiveDate})`);

  try {
    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: email,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #0f172a;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
            <span style="color: white; font-weight: 700; font-size: 18px;">OmniParse AI</span>
          </div>
          <h1 style="font-size: 22px; margin: 0 0 16px;">Terms of Service update — please review</h1>
          <p style="font-size: 15px; line-height: 1.6; color: #475569;">
            We're updating our Terms of Service. The new Terms take effect on
            <strong>${effectiveDate}</strong> (last updated ${lastUpdated}).
          </p>
          <h2 style="font-size: 16px; margin: 24px 0 8px; color: #0f172a;">Summary of changes</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; background: #f8fafc; padding: 12px 16px; border-left: 3px solid #f59e0b; border-radius: 4px;">
            ${summary}
          </p>
          <h2 style="font-size: 16px; margin: 24px 0 8px; color: #0f172a;">What this means for you</h2>
          <ul style="font-size: 14px; line-height: 1.7; color: #475569; padding-left: 20px;">
            <li>The updated Terms take effect on <strong>${effectiveDate}</strong>.</li>
            <li>You have <strong>30 days</strong> from today to review the changes.</li>
            <li>If you disagree with the changes, you may terminate your account before ${effectiveDate} — your existing Terms continue to apply for any open billing period.</li>
            <li>For consumer users (under Czech Act No. 89/2012 Coll. § 419), material changes that worsen your position take effect only with your express agreement, which is deemed given if you continue using the Service after the notice period.</li>
          </ul>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${tosUrl}" style="background: #f59e0b; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
              Read the updated Terms
            </a>
          </p>
          <p style="font-size: 13px; line-height: 1.6; color: #64748b;">
            You're receiving this email because you have an OmniParse AI account.
            Per GDPR Art. 12 and Czech Civil Code § 1752, we're required to notify you of
            material changes to our Terms. If you have questions, reply to this email or
            contact us at damr58h@gmail.com.
          </p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
          <p style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
            OmniParse AI — AI-powered invoice intelligence platform.<br>
            <a href="${appUrl}" style="color: #94a3b8;">${appUrl.replace(/^https?:\/\//, '')}</a>
          </p>
        </body>
        </html>
      `,
      text: `${subject}

We're updating our Terms of Service. The new Terms take effect on ${effectiveDate} (last updated ${lastUpdated}).

Summary of changes:
${summary}

What this means for you:
- The updated Terms take effect on ${effectiveDate}.
- You have 30 days from today to review the changes.
- If you disagree with the changes, you may terminate your account before ${effectiveDate} — your existing Terms continue to apply for any open billing period.
- For consumer users (under Czech Act No. 89/2012 Coll. § 419), material changes that worsen your position take effect only with your express agreement, which is deemed given if you continue using the Service after the notice period.

Read the updated Terms: ${tosUrl}

You're receiving this email because you have an OmniParse AI account. Per GDPR Art. 12 and Czech Civil Code § 1752, we're required to notify you of material changes to our Terms. If you have questions, reply to this email or contact us at damr58h@gmail.com.
`,
    });

    if (error) {
      console.error('[email] Resend API error (tos-change):', JSON.stringify(error));
      return false;
    }

    console.warn(`[email] ToS-change email sent to ${email} (id: ${data?.id || 'unknown'})`);
    return true;
  } catch (err) {
    console.error(
      '[email] Failed to send ToS-change email:',
      err instanceof Error ? err.message : String(err)
    );
    return false;
  }
}
