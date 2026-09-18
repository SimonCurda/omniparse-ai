import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signToken } from '@/lib/auth';
import {
  exchangeGitHubCode,
  getGitHubUserInfo,
  verifyState,
  OAUTH_STATE_COOKIE,
  APP_URL,
} from '@/lib/oauth';

/**
 * GET /api/auth/oauth/github/callback?code=...&state=...
 *
 * 1. Verify the `state` cookie matches the `state` query param (CSRF).
 * 2. Exchange the authorization code for an access token.
 * 3. Fetch the user's GitHub profile (with primary email fallback).
 * 4. Upsert the User row:
 *    - Found by githubId → log in.
 *    - Found by email → link the GitHub account (set githubId).
 *    - Not found → create a new OAuth-only user (password = null).
 * 5. Sign a JWT and redirect to /?token=<jwt> so the client can persist it.
 */
export async function GET(req: NextRequest) {
  const errorRedirect = `${APP_URL}/?oauth_error=github`;

  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const cookieState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  // CSRF: state must be present, match the cookie, and carry a valid HMAC.
  if (!code || !state || !cookieState || state !== cookieState || !verifyState(state)) {
    return NextResponse.redirect(errorRedirect);
  }

  try {
    const { accessToken } = await exchangeGitHubCode(code);
    const info = await getGitHubUserInfo(accessToken);

    if (typeof info.id !== 'number' || !info.email) {
      // GitHub refused to give us a usable email — user has no public + verified
      // primary email. Tell them to fix it on GitHub and retry.
      return NextResponse.redirect(errorRedirect);
    }

    const githubId = String(info.id);
    const email = info.email.toLowerCase();

    // 1) Existing user already linked to this GitHub account.
    let user = await db.user.findUnique({ where: { githubId } });

    if (!user) {
      // 2) Existing user with the same email — link the GitHub account.
      const byEmail = await db.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await db.user.update({
          where: { id: byEmail.id },
          data: { githubId },
        });
      } else {
        // 3) Brand-new OAuth-only user.
        user = await db.user.create({
          data: {
            email,
            name: info.name || info.login || email.split('@')[0],
            password: null,
            githubId,
            // Auto-accept ToS for OAuth sign-ups.
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
    console.error('[oauth/github/callback] failed:', err instanceof Error ? err.message : err);
    return NextResponse.redirect(errorRedirect);
  }
}
