import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getAllFeatureFlags } from '@/lib/feature-flags';

// GET /api/feature-flags — returns the public subset of feature flags used by
// the client to decide which UI affordances to render. Requires auth so we
// don't expose the flag table to anonymous callers (even though the values
// are not secret, gating keeps the surface area minimal).
//
// Returns: { show_cost_per_invoice: boolean, show_normalized_toggle: boolean }
export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const all = await getAllFeatureFlags();

    return NextResponse.json({
      show_cost_per_invoice: !!all.show_cost_per_invoice,
      show_normalized_toggle: !!all.show_normalized_toggle,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
