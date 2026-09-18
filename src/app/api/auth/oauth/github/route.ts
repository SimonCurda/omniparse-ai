import { NextResponse } from 'next/server';
import { getGitHubAuthUrl, generateState, OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE } from '@/lib/oauth';

/**
 * GET /api/auth/oauth/github
 * Starts the GitHub OAuth flow:
 *  - generates a signed `state` (CSRF protection)
 *  - stores it in an HttpOnly cookie (maxAge = 10 min)
 *  - redirects the browser to GitHub's authorize endpoint
 */
export async function GET() {
  const state = generateState();
  const url = getGitHubAuthUrl(state);

  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: OAUTH_STATE_MAX_AGE,
  });
  return res;
}
