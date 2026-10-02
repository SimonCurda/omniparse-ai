import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

// GET /api/admin/legal-pdf — serve the admin legal PDF (full version with
// developer notes, changelogs, SCC status tracking, etc.)
//
// SECURITY: This route requires CRON_SECRET authentication (same as other
// admin endpoints). The PDF is stored OUTSIDE /public/ so it's not
// accessible by guessing the URL.
export async function GET(req: NextRequest) {
  // Auth: CRON_SECRET via ?key= query param (same as other admin endpoints)
  const key = new URL(req.url).searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET env var is not set.' }, { status: 500 });
  }
  if (key !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pdfPath = join(process.cwd(), 'src/app/api/admin/legal-pdf/admin-legal.pdf');
    const pdfBuffer = await readFile(pdfPath);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="OmniParse-Legal-Documents-Admin.pdf"',
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch {
    return NextResponse.json({ error: 'PDF not found.' }, { status: 404 });
  }
}
