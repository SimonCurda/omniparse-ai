import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/cron/purge-files — Batch purge expired fileData to save DB storage
// Called by Vercel Cron or external scheduler
// Returns count of purged invoices
export async function POST(req: Request) {
  // Verify cron secret to prevent unauthorized calls.
  // In production, CRON_SECRET must be set as a Vercel env var. There is no
  // fallback — if the env var is missing, the endpoint refuses to serve
  // requests (security: don't ship hardcoded dev secrets to prod).
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[cron] CRON_SECRET env var is not set. Refusing request.');
    return NextResponse.json(
      { error: 'Cron endpoint not configured. Set CRON_SECRET env var.' },
      { status: 503 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find all invoices where fileDataExpiresAt has passed but fileData still exists
    const expired = await db.invoice.findMany({
      where: {
        fileDataExpiresAt: { lte: new Date() },
        fileData: { not: null },
      },
      select: { id: true },
    });

    if (expired.length === 0) {
      return NextResponse.json({ purged: 0, message: 'No expired file data found' });
    }

    // Batch purge: set fileData to null for all expired invoices
    // This frees database storage while keeping all extraction results
    const ids = expired.map((inv) => inv.id);
    const result = await db.invoice.updateMany({
      where: { id: { in: ids } },
      data: { fileData: null, fileType: null, fileDataExpiresAt: null },
    });

    return NextResponse.json({
      purged: result.count,
      message: `Purged file data from ${result.count} invoice(s). Extraction results preserved.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
