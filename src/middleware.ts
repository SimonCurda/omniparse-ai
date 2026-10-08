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
  // Content-Security-Policy: primary XSS defense. 'unsafe-inline' is required
  // for script-src/style-src because Next.js + Tailwind rely on inline scripts
  // for hydration. Tightened:
  //   - object-src 'none' (no plugins/Flash/PDF JS)
  //   - base-uri 'self' (no <base> hijack)
  //   - form-action 'self' (no form exfiltration)
  //   - frame-ancestors 'none' (clickjacking defense)
  //   - upgrade-insecure-requests
  //   - navigate-to 'self'
  'Content-Security-Policy':
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://api.groq.com https://openrouter.ai; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'none'; " +
    "frame-src 'self' data: blob:; " +
    "upgrade-insecure-requests; " +
    "navigate-to 'self';",
  // COOP/COEP/CORP — process-isolation headers. Make it much harder for a
  // cross-origin page (e.g. attacker's site in another tab) to interact
  // with our window object or read its memory.
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Cross-Origin-Resource-Policy': 'same-origin',
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
  const accept = request.headers.get('accept') || ''

  // ─── Markdown content negotiation ──────────────────────────────────
  if (pathname === '/' && accept.includes('text/markdown')) {
    return new NextResponse(getHomepageMarkdown(), {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Vary': 'Accept',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  // ─── Agent-friendly 404 with Markdown body ────────────────────────
  const isStaticAsset = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|eot|pdf)$/.test(pathname)
  const isApiRoute = pathname.startsWith('/api/')
  const isNextInternal = pathname.startsWith('/_next/')
  if (!isStaticAsset && !isApiRoute && !isNextInternal && accept.includes('text/markdown')) {
    return new NextResponse(get404Markdown(pathname), {
      status: 404,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Vary': 'Accept',
        'Cache-Control': 'no-store',
      },
    })
  }

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

function getHomepageMarkdown(): string {
  return `# OmniParse — AI Invoice Parsing

OmniParse is an AI-powered invoice and receipt parsing service. Upload documents (PDF, JPG, PNG, WebP) and the AI extracts vendor, dates, amounts, line items, and custom fields as structured JSON. Includes confidence scores, tampering detection, validation rules, and a REST API.

## Key Features

- AI Extraction: vendor, dates, amounts, line items from any invoice
- Confidence Scores on every field
- 3-layer Tampering Detection (metadata, heuristics, VLM)
- Validation Rules (8 built-in + custom)
- Export: CSV, JSON, Excel, PDF
- REST API with X-API-Key header (see /api-docs)
- Email Import via IMAP
- Approval Workflows
- Chat Assistant for invoice data

## Pricing

- Free: 15 invoices/month, REST API access
- Pro ($49/mo): 500 invoices, editing, JSON/Excel export
- Plus ($99/mo): 2,000 invoices, approval workflows
- Business ($199/mo): 10,000 invoices, multi-entity
- Enterprise ($499/mo): Unlimited

## When to Use

- Extract structured data from invoices and receipts
- Validate invoice data against business rules
- Detect tampered or fraudulent documents
- Build automated accounts-payable workflows
- Query invoice data via chat or REST API

## Links

- [API Documentation](/api-docs)
- [OpenAPI Specification](/openapi.json)
- [llms.txt](/llms.txt)
- [Sitemap](/sitemap.xml)
- [Blog](/blog)
- [Compare](/compare)
`
}

function get404Markdown(pathname: string): string {
  return `# 404 — Page Not Found

The page \`${pathname}\` does not exist on OmniParse.

## Useful Links

- [Homepage](/)
- [API Documentation](/api-docs)
- [OpenAPI Specification](/openapi.json)
- [llms.txt](/llms.txt)
- [Sitemap](/sitemap.xml)
- [Blog](/blog)
- [About](/about)
- [Contact](/contact)

If you believe this is an error, please contact support.
`
}
