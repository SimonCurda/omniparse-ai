import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/invoices/[id]/file — Return raw file binary (no base64 in JSON).
// Auto-purges expired fileData to save database storage.
//
// SECURITY: files are stored as base64 in the DB (not on filesystem) — they
// can never be "executed" server-side. When returned to the browser, we force
// Content-Disposition: attachment so the browser DOWNLOADS the file instead
// of rendering it inline (prevents PDF JS execution in user's session).
// We also set X-Content-Type-Options: nosniff + sandbox CSP on the response.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const invoice = await db.invoice.findFirst({
      where: { id, userId: auth.userId },
      select: { fileData: true, fileType: true, fileDataExpiresAt: true, invNumber: true, vendor: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.fileDataExpiresAt && new Date() > invoice.fileDataExpiresAt) {
      await db.invoice.update({
        where: { id },
        data: { fileData: null, fileType: null, fileDataExpiresAt: null },
      });
      return NextResponse.json(
        { error: 'File preview expired. Extraction data is still available.', expired: true },
        { status: 410 },
      );
    }

    if (!invoice.fileData || !invoice.fileType) {
      return NextResponse.json({ error: 'No file stored for this invoice' }, { status: 404 });
    }

    const buffer = Buffer.from(invoice.fileData, 'base64');

    if (buffer.length > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large to preview' }, { status: 413 });
    }

    // Sanitized filename: strip non-[A-Za-z0-9_.\-], force extension to match fileType.
    const safeBase = (invoice.invNumber || invoice.vendor || 'invoice')
      .replace(/[^\w.\-]/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 60) || 'invoice';
    const ext = invoice.fileType === 'application/pdf' ? 'pdf'
              : invoice.fileType === 'image/jpeg'     ? 'jpg'
              : invoice.fileType === 'image/png'      ? 'png'
              : invoice.fileType === 'image/webp'     ? 'webp'
              : 'bin';
    const filename = `${safeBase}.${ext}`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': invoice.fileType,
        'Content-Length': String(buffer.length),
        // Force the browser to DOWNLOAD, not render inline.
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'X-Content-Type-Options': 'nosniff',
        // Lock down THIS response to nothing-loadable.
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'private, max-age=3600, must-revalidate',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[download] error:', message);
    return NextResponse.json({ error: 'Failed to retrieve file.' }, { status: 500 });
  }
}
