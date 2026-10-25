import { NextResponse } from 'next/server';
import { getAllFeatureFlags } from '@/lib/feature-flags';

// GET /api/feature-flags/public — returns the PUBLIC subset of feature flags.
//
// This endpoint is intentionally NOT auth-gated, because the values it
// returns control UI elements on the LANDING PAGE (navbar, footer) which
// are rendered before the user logs in. Only flags that are safe to
// expose publicly are listed here.
//
// Currently exposes:
//   - show_language_toggle: controls whether the globe-icon language
//     toggle (and the Settings Language card) are visible. Default OFF.
//
// Returns: { show_language_toggle: boolean }
export async function GET() {
  try {
    const all = await getAllFeatureFlags();
    return NextResponse.json({
      show_language_toggle: !!all.show_language_toggle,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
