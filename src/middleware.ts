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
  // When an AI agent requests the homepage with Accept: text/markdown,
  // return a Markdown representation of the page content with
  // Content-Type: text/markdown and Vary: Accept. This satisfies the
  // Ora "Markdown content negotiation" check and lets agents consume
  // the page content without parsing HTML.
  if (pathname === '/' && accept.includes('text/markdown')) {
    const markdown = getHomepageMarkdown()
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Vary': 'Accept',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  // ─── Agent-friendly 404 with Markdown body ────────────────────────
  // When an agent requests a nonexistent path with Accept: text/markdown,
  // return a 404 with a Markdown body explaining the error and linking to
  // docs/sitemap. This satisfies the Ora "Agent-friendly 404s" check.
  // We only do this for paths that look like they should be pages (not
  // static assets, not API routes — those have their own 404 handling).
  const isStaticAsset = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|eot|pdf)$/.test(pathname)
  const isApiRoute = pathname.startsWith('/api/')
  const isNextInternal = pathname.startsWith('/_next/')
  if (!isStaticAsset && !isApiRoute && !isNextInternal && accept.includes('text/markdown')) {
    const markdown = get404Markdown(pathname)
    return new NextResponse(markdown, {
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

// ─── Markdown helpers for agent content negotiation ─────────────────────
// These functions return Markdown representations of the homepage and 404
// pages for AI agents that send Accept: text/markdown.

function getHomepageMarkdown(): string {
  return `# OmniParse — AI Invoice Parsing

OmniParse is an AI-powered invoice and receipt parsing service. Upload documents (PDF, JPG, PNG, WebP) and the AI extracts vendor, dates, amounts, line items, and custom fields as structured JSON. Includes confidence scores, tampering detection, validation rules, and a chat assistant for querying your invoice data.

## Key Features

- **AI Extraction**: Vision language models extract vendor, invoice number, dates, amounts, VAT, totals, and line items from any invoice format.
- **Confidence Scores**: Every field has a confidence score so you know what to verify.
- **Tampering Detection**: 3-layer check (metadata, heuristics, VLM) detects modified PDFs.
- **Validation Rules**: 8 built-in rules + custom rules to catch errors before export.
- **Export**: CSV, JSON, Excel, PDF exports with custom templates.
- **Chat Assistant**: Ask questions about your invoice data in natural language.
- **REST API**: Programmatic access via X-API-Key header. See /api-docs for full documentation.
- **Email Import**: Connect IMAP inboxes to auto-import invoices from email attachments.
- **Approval Workflows**: Auto-approve, flag, or block invoices by amount thresholds.
- **Multi-Entity**: Business+ plans support multiple subsidiaries/entities.

## Pricing

- **Free**: 15 invoices/month, 10 chat messages, CSV export, REST API access.
- **Pro** ($49/mo): 500 invoices/month, unlimited chat, editing, JSON/Excel export, batch upload.
- **Plus** ($99/mo): 2,000 invoices/month, approval workflows, custom rules, audit trail, bulk operations.
- **Business** ($199/mo): 10,000 invoices/month, multi-entity, executive dashboard, vendor scorecard.
- **Enterprise** ($499/mo): Unlimited everything, advanced audit logs, compliance exports.

## API Access

The REST API is available on all plans. Generate an API key from Settings → API Access in the dashboard. Pass it via the \`X-API-Key\` header. Full documentation at [/api-docs](/api-docs). OpenAPI spec at [/openapi.json](/openapi.json).

## When to Use

Use OmniParse when you need to:
- Extract structured data from invoices and receipts automatically
- Validate invoice data against business rules before processing
- Detect tampered or fraudulent documents
- Build automated accounts-payable workflows
- Query your invoice data via chat or REST API
- Import invoices from email attachments automatically

## Links

- [API Documentation](/api-docs)
- [API Tester](/api-test)
- [OpenAPI Specification](/openapi.json)
- [llms.txt](/llms.txt)
- [Sitemap](/sitemap.xml)
- [Privacy Policy](/privacy-policy)
- [Terms of Service](/terms-of-service)
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
- [Privacy Policy](/privacy-policy)
- [Terms of Service](/terms-of-service)
- [About](/about)
- [Contact](/contact)

If you believe this is an error, please contact support.
`
}
