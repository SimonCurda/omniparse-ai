import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

// Security headers applied to ALL responses.
// Defense-in-depth mitigations; not the sole control for any vulnerability.
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-DNS-Prefetch-Control': 'off',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  // Content-Security-Policy: primary XSS defense. Restricts where scripts,
  // styles, images, fonts, connections, etc. may load from. 'unsafe-inline'
  // is required for script-src/style-src because Next.js + Tailwind rely on
  // inline scripts/styles for hydration and styling; future hardening can
  // switch to per-request nonces. img-src includes data:/blob: to support
  // in-browser file previews (PDFs/images rendered from base64/blob URLs).
  // connect-src includes Groq + OpenRouter as defense-in-depth in case
  // client-side calls are added later (currently all AI calls are server-side).
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.groq.com https://openrouter.ai; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
}

/** General API rate limit: 60 requests per minute per IP */
const GENERAL_LIMIT = 60
const GENERAL_WINDOW_MS = 60 * 1000

/** Auth login rate limit: 5 requests per minute per IP */
const LOGIN_LIMIT = 5
const LOGIN_WINDOW_MS = 60 * 1000

/** Auth register rate limit: 3 requests per minute per IP */
const REGISTER_LIMIT = 3
const REGISTER_WINDOW_MS = 60 * 1000

/**
 * Extract client IP from request headers.
 * Checks x-forwarded-for (first IP) then x-real-ip.
 * Falls back to 'unknown' if neither header is present.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  return 'unknown'
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Apply rate limiting to all API routes
  if (pathname.startsWith('/api/')) {
    const ip = getClientIp(request)
    let limited = false

    // Stricter rate limits for auth routes
    if (pathname === '/api/auth/login') {
      // Use a scoped key so middleware auth limits don't clash with route-handler limits
      limited = rateLimit(`mw:login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS)
    } else if (pathname === '/api/auth/register') {
      limited = rateLimit(`mw:register:${ip}`, REGISTER_LIMIT, REGISTER_WINDOW_MS)
    } else {
      // General API rate limit for all other /api/* routes
      limited = rateLimit(`mw:api:${ip}`, GENERAL_LIMIT, GENERAL_WINDOW_MS)
    }

    if (limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      )
    }
  }

  // Continue with security headers
  const res = NextResponse.next({ request })
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value)
  }
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
