import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ⚠️ TEMPORARY MIGRATION — adds the scannedUIDs column to EmailInbox table.
// DELETE after running.
export async function POST(req: NextRequest) {
  const auth = await import('@/lib/auth').then(m => m.getUserFromRequest(req));
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await db.$executeRaw`ALTER TABLE "EmailInbox" ADD COLUMN IF NOT EXISTS "scannedUIDs" JSONB;`;
    return NextResponse.json({ success: true, message: 'scannedUIDs column added to EmailInbox table.' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already exists')) {
      return NextResponse.json({ success: true, message: 'Column already exists.' });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
