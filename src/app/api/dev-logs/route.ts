import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

/**
 * GET /api/dev-logs — Requires auth. Returns instructions for reading crash
 * logs that are stored in the browser's localStorage.
 * POST /api/dev-logs — Accepts { logs: [...] } from client-side crash logger.
 *
 * Since crash logs live in the browser's localStorage, this endpoint is for
 * the error boundary's "copy to clipboard" feature. The actual log reading
 * happens client-side via localStorage.
 */

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    message: 'Crash logs are stored in browser localStorage (key: op_crash_log).',
    instructions: [
      'Open browser DevTools → Console',
      'Run: JSON.parse(localStorage.getItem("op_crash_log") || "[]")',
      'Or trigger a crash to see the ErrorBoundary with built-in log viewer',
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Just acknowledge receipt — logs are already in localStorage
    return NextResponse.json({ ok: true, received: body?.logs?.length ?? 0 });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
