import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signToken } from '@/lib/auth';
import {
  exchangeGoogleCode,
  getGoogleUserInfo,
  verifyState,
  OAUTH_STATE_COOKIE,
  APP_URL,
} from '@/lib/oauth';

/**
 * GET /api/auth/oauth/google/callback?code=...&state=...
 *
 * 1. Verify the `state` cookie matches the `state` query param (CSRF).
 * 2. Exchange the authorization code for an access token.
 * 3. Fetch the user's Google profile.
 * 4. Upsert the User row:
 *    - Found by googleId → log in.
 *    - Found by email → link the Google account (set googleId).
 *    - Not found → create a new OAuth-only user (password = null).
 * 5. Sign a JWT and redirect to /?token=<jwt> so the client can persist it.
 */
export async function GET(req: NextRequest) {
  const errorRedirect = `${APP_URL}/?oauth_error=google`;

  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const cookieState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  // CSRF: state must be present, match the cookie, and carry a valid HMAC.
  if (!code || !state || !cookieState || state !== cookieState || !verifyState(state)) {
    return NextResponse.redirect(errorRedirect);
  }

  try {
    const { accessToken } = await exchangeGoogleCode(code);
    const info = await getGoogleUserInfo(accessToken);

    if (!info.sub || !info.email) {
      return NextResponse.redirect(errorRedirect);
    }

    const email = info.email.toLowerCase();

    // 1) Existing user already linked to this Google account.
    let user = await db.user.findUnique({ where: { googleId: info.sub } });

    if (!user) {
      // 2) Existing user with the same email — link the Google account.
      const byEmail = await db.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await db.user.update({
          where: { id: byEmail.id },
          data: { googleId: info.sub },
        });
      } else {
        // 3) Brand-new OAuth-only user.
        user = await db.user.create({
          data: {
            email,
            name: info.name || email.split('@')[0],
            password: null,
            googleId: info.sub,
            // Auto-accept ToS for OAuth sign-ups (Google enforces its own
            // age/consent checks at the consent screen).
            termsAcceptedAt: new Date(),
            ageConfirmedAt: new Date(),
          },
        });
      }
    }

    const token = signToken({ userId: user.id, email: user.email });
    const res = NextResponse.redirect(`${APP_URL}/?token=${token}`);
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  } catch (err) {
    console.error('[oauth/google/callback] failed:', err instanceof Error ? err.message : err);
    return NextResponse.redirect(errorRedirect);
  }
}
