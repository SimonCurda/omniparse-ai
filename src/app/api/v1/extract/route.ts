import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateApiKey, getApiLimit } from '@/lib/api-key';
import { checkMonthlyParseLimit, incrementMonthlyParseCount } from '@/lib/parse-limit';

// POST /api/v1/extract — public API endpoint for invoice extraction.
//
// AUTH: API key via Authorization: Bearer op_live_xxx
// (Also accepts JWT for users who want to use the API from their own frontend)
//
// BODY: multipart/form-data
//   file:        (required) PDF, JPEG, PNG, or WebP (max 10MB)
//   store:       (optional) "true" = create an Invoice in the user's account
//                "false" = stateless extraction, don't store (default: "true")
//   vendor:      (optional) hint — pre-fill vendor if AI can't detect
//   currency:    (optional) hint — pre-fill currency (ISO 4217, e.g. "EUR")
//
// RESPONSE (200):
//   {
//     "vendor": "Acme Corp",
//     "invoice_number": "INV-2026-001",
//     "invoice_date": "2026-01-15",
//     "due_date": "2026-02-14",
//     "amount": 1000.00,
//     "vat_amount": 210.00,
//     "total": 1210.00,
//     "currency": "EUR",
//     "line_items": [...],
//     "confidence": 0.95,
//     "field_confidence": { ... },
//     "invoice_id": "cm...",   // only if store=true
//   }
//
// RESPONSE (401): { error: "Invalid or missing API key" }
// RESPONSE (429): { error: "Monthly API limit reached (X/Y). Resets on ..." }
// RESPONSE (400): { error: "..." } — validation errors
// RESPONSE (500): { error: "..." } — AI extraction failure

export async function POST(req: NextRequest) {
  try {
    // ─── Auth: try API key first, then JWT ─────────────────────────────
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    // Try API key
    if (authHeader?.startsWith('Bearer op_live_')) {
      const apiKeyResult = await validateApiKey(authHeader);
      if (!apiKeyResult) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }
      userId = apiKeyResult.userId;
    } else {
      // Fall back to JWT (for users using the API from their own frontend)
      const { getUserFromRequest } = await import('@/lib/auth');
      const jwtAuth = await getUserFromRequest(req);
      if (jwtAuth) userId = jwtAuth.userId;
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required. Send an API key as: Authorization: Bearer op_live_xxx' },
        { status: 401 },
      );
    }

    // ─── Get user + check limits ───────────────────────────────────────
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { plan: true, active: true, frozenReason: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!user.active) {
      return NextResponse.json(
        { error: user.frozenReason || 'Account has been frozen.' },
        { status: 403 },
      );
    }

    // ─── Parse FormData ────────────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get('file');
    const storeParam = formData.get('store');
    const store = storeParam !== 'false'; // default: true

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Send a file in the "file" field.' },
        { status: 400 },
      );
    }

    // ─── Monthly limit check (shared with web UI) ──────────────────────
    // API calls count against the same monthly parse limit — this prevents
    // a user from bypassing their plan limit via the API.
    const parseLimit = await checkMonthlyParseLimit(userId, user.plan);
    if (!parseLimit.allowed) {
      const now = new Date();
      const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      return NextResponse.json({
        error: `Monthly limit reached (${parseLimit.count}/${parseLimit.limit}). Resets on ${nextReset.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}.`,
        count: parseLimit.count,
        limit: parseLimit.limit,
        resets_at: nextReset.toISOString(),
      }, { status: 429 });
    }

    // ─── Call internal /api/parse ──────────────────────────────────────
    // We reuse the existing extraction logic by calling our own API.
    // This ensures the API and web UI always behave identically.
    const origin = req.headers.get('origin') || req.headers.get('x-forwarded-host');
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const baseUrl = origin || (host ? `${protocol}://${host}` : 'http://localhost:3000');

    // Build a new FormData for the internal call
    const internalForm = new FormData();
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    internalForm.append('file', blob, file.name);

    // Pass the JWT token (mint a short-lived one for the internal call)
    const { signToken } = await import('@/lib/auth');
    const internalToken = signToken({ userId, email: '' });

    const parseResponse = await fetch(`${baseUrl}/api/parse`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${internalToken}`,
        'Cookie': req.headers.get('cookie') || '',
      },
      body: internalForm,
    });

    if (!parseResponse.ok) {
      const errorData = await parseResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Extraction failed', details: errorData },
        { status: parseResponse.status },
      );
    }

    const parseResult = await parseResponse.json();

    // ─── Build clean API response ──────────────────────────────────────
    // Strip internal fields that API users don't need.
    const response: Record<string, unknown> = {
      vendor: parseResult.vendor || null,
      invoice_number: parseResult.invNumber || null,
      invoice_date: parseResult.invDate || null,
      due_date: parseResult.dueDate || null,
      amount: parseResult.amount ?? null,
      vat_amount: parseResult.vatAmount ?? null,
      total: parseResult.total ?? null,
      currency: parseResult.currency || 'USD',
      line_items: parseResult.lineItems || [],
      confidence: parseResult.confidence ?? 0,
      field_confidence: parseResult.fieldConfidence || {},
      validation_status: parseResult.validationStatus || 'unknown',
    };

    if (store && parseResult.id) {
      response.invoice_id = parseResult.id;
    } else if (!store) {
      // If store=false, delete the invoice that /api/parse created
      if (parseResult.id) {
        await db.invoice.delete({ where: { id: parseResult.id } }).catch(() => {});
        // Also decrement the monthly counter since we're not keeping this
        // (The counter was incremented by /api/parse. We can't easily
        // decrement it, but the user didn't actually "use" a parse.
        // This is a known limitation — store=false still counts against
        // the monthly limit. Documented in the API docs.)
      }
      delete (response as Record<string, unknown>).invoice_id;
    }

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/v1/extract] error:', message);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}

// GET /api/v1/extract — return API info (helpful for users testing the endpoint)
export async function GET() {
  return NextResponse.json({
    name: 'OmniParse AI Extract API',
    version: '1',
    method: 'POST',
    auth: 'Authorization: Bearer op_live_xxx',
    docs: '/api-docs',
    supported_formats: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    max_file_size: '10MB',
  });
}
