import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ⚠️ TEMPORARY MIGRATION — adds the scannedUIDs column to EmailInbox table.
// DELETE after running.
// Auth-gated via MIGRATION_KEY (temporary env var set via Vercel API).

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  const expectedKey = process.env.MIGRATION_KEY || process.env.JWT_SECRET;

  if (!expectedKey) {
    return NextResponse.json({ error: 'Neither MIGRATION_KEY nor JWT_SECRET is set' }, { status: 500 });
  }
  if (key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
