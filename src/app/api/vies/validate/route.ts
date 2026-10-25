import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { validateVatId } from '@/lib/vies';

// ─── VIES validation endpoint ────────────────────────────────────────────────
//
// POST /api/vies/validate
// Body: { vatId: string, countryCode?: string }
// Returns: ViesValidationResult
//
// Available to ALL logged-in users (free + paid). Rationale: VAT ID
// validation is a basic compliance utility; gating it behind a paywall
// would prevent Free-tier users from issuing reverse-charge invoices
// correctly, which harms the whole EU VAT system.
//
// We DO rate-limit by user to prevent VIES abuse (VIES itself enforces
// ~5 req/min/caller — we apply a softer 10 req/min/caller limit before
// VIES rejects us). The rate limit is in-memory per-user; resets every
// minute. Sufficient for casual use; serious B2B bulk validation should
// happen on the user's side.

const RATE_LIMIT_PER_MIN = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Rate limit check
  const now = Date.now();
  const entry = rateLimitMap.get(auth.userId);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(auth.userId, { count: 1, resetAt: now + 60_000 });
  } else {
    entry.count++;
    if (entry.count > RATE_LIMIT_PER_MIN) {
      return NextResponse.json({
        error: `Rate limit: ${RATE_LIMIT_PER_MIN} VIES validations per minute. Try again in ${Math.ceil((entry.resetAt - now) / 1000)}s.`,
      }, { status: 429 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const { vatId, countryCode } = body as { vatId?: string; countryCode?: string };
  if (!vatId || typeof vatId !== 'string') {
    return NextResponse.json({ error: 'vatId is required.' }, { status: 400 });
  }

  const result = await validateVatId(vatId, countryCode);
  return NextResponse.json(result);
}
