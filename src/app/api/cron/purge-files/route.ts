import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/cron/purge-files — Batch purge expired fileData to save DB storage
// Called by Vercel Cron or external scheduler
// Returns count of purged invoices
export async function POST(req: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'omniparse-cron-dev';

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
