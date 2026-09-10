import { createHmac, randomBytes } from 'crypto';

/**
 * OAuth helper for Google + GitHub sign-in.
 *
 * The flow:
 * 1. Browser → /api/auth/oauth/{google,github} — server signs a CSRF `state`,
 *    stores it in an HttpOnly cookie, and redirects to the provider.
 * 2. Provider → /api/auth/oauth/{google,github}/callback?code=...&state=...
 *    server verifies the `state` cookie, exchanges the `code` for an access
 *    token, fetches user info, upserts the User row, and redirects to
 *    /?token=<jwt> so the client can persist the token in localStorage.
 *
 * Password users (password != null) and OAuth-only users (password == null)
 * coexist. OAuth users have one of `googleId` / `githubId` set and `password`
 * is null. A single user can have both an OAuth link and a password if they
 * linked accounts via email-based lookup.
 */

const DEV_JWT_SECRET = 'op-dev-secret-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || DEV_JWT_SECRET;

/** Public app URL used to build the OAuth redirect URI. */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://omniparse-ai.vercel.app';

/** Cookie name used to round-trip the OAuth `state` between request + callback. */
export const OAUTH_STATE_COOKIE = 'op_oauth_state';

/** State cookie lifetime: 10 minutes (in seconds). */
export const OAUTH_STATE_MAX_AGE = 600;

// ─── Redirect URIs ────────────────────────────────────────────────────────────

export function getGoogleRedirectUri(): string {
  return `${APP_URL}/api/auth/oauth/google/callback`;
}

export function getGitHubRedirectUri(): string {
  return `${APP_URL}/api/auth/oauth/github/callback`;
}

// ─── Authorization URLs ────────────────────────────────────────────────────────

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: getGoogleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    // prompt=select_account lets users pick which Google account to use,
    // even if they're only signed into one.
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getGitHubAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID || '',
    redirect_uri: getGitHubRedirectUri(),
    scope: 'user:email',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

// ─── Token Exchange ──────────────────────────────────────────────────────────

export interface GoogleTokenResponse {
  accessToken: string;
  idToken?: string;
}

export async function exchangeGoogleCode(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: getGoogleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token?: string; id_token?: string };
  if (!data.access_token) {
    throw new Error('Google token exchange returned no access_token');
  }
  return { accessToken: data.access_token, idToken: data.id_token };
}

export async function exchangeGitHubCode(code: string): Promise<{ accessToken: string }> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      code,
      client_id: process.env.GITHUB_CLIENT_ID || '',
      client_secret: process.env.GITHUB_CLIENT_SECRET || '',
      redirect_uri: getGitHubRedirectUri(),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(`GitHub token exchange returned no access_token: ${data.error || 'unknown error'}`);
  }
  return { accessToken: data.access_token };
}

// ─── User Info ────────────────────────────────────────────────────────────────

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google userinfo failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as GoogleUserInfo;
  if (!data.sub || !data.email) {
    throw new Error('Google userinfo missing sub or email');
  }
  return data;
}

export interface GitHubUserInfo {
  id: number;
  email?: string;
  name?: string;
  login?: string;
}

export async function getGitHubUserInfo(accessToken: string): Promise<GitHubUserInfo> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub user fetch failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as GitHubUserInfo;
  if (typeof data.id !== 'number') {
    throw new Error('GitHub user fetch returned no id');
  }

  // GitHub often returns email: null when the user has marked their email
  // as private. Fall back to the /user/emails endpoint and pick the primary
  // verified address.
  if (!data.email) {
    try {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      });
      if (emailRes.ok) {
        const emails = (await emailRes.json()) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;
        const primary =
          emails.find((e) => e.primary && e.verified) ||
          emails.find((e) => e.verified) ||
          emails.find((e) => e.primary);
        if (primary) data.email = primary.email;
      }
    } catch {
      // Ignore — caller will handle missing email.
    }
  }

  return data;
}

// ─── CSRF State ──────────────────────────────────────────────────────────────

/**
 * Generate a state value in the form `<random16hex>.<hmac(random16hex)>`.
 * The HMAC binds the random part to the JWT secret so an attacker cannot
 * forge a state without the secret. The full value is also stored in a
 * cookie and verified on the callback.
 */
export function generateState(): string {
  const random = randomBytes(8).toString('hex'); // 16 hex chars
  const hmac = createHmac('sha256', JWT_SECRET).update(random).digest('hex');
  return `${random}.${hmac}`;
}

/**
 * Verify that a state value carries a valid HMAC signature for its random
 * part. Uses a constant-time comparison to avoid leaking timing info.
 */
export function verifyState(state: string): boolean {
  const sep = state.lastIndexOf('.');
  if (sep <= 0 || sep === state.length - 1) return false;
  const random = state.slice(0, sep);
  const hmac = state.slice(sep + 1);
  const expected = createHmac('sha256', JWT_SECRET).update(random).digest('hex');
  if (hmac.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < hmac.length; i++) {
    diff |= hmac.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
