import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/invoices/[id]/file — Return raw file binary (no base64 in JSON)
// Auto-purges expired fileData to save database storage
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const invoice = await db.invoice.findFirst({
      where: { id, userId: auth.userId },
      select: { fileData: true, fileType: true, fileDataExpiresAt: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Auto-purge: if fileData has expired, delete it and return not found
    if (invoice.fileDataExpiresAt && new Date() > invoice.fileDataExpiresAt) {
      await db.invoice.update({
        where: { id },
        data: { fileData: null, fileType: null, fileDataExpiresAt: null },
      });
      return NextResponse.json(
        { error: 'File preview expired. Extraction data is still available.', expired: true },
        { status: 410 }  // 410 Gone — resource was permanently removed
      );
    }

    if (!invoice.fileData || !invoice.fileType) {
      return NextResponse.json({ error: 'No file stored for this invoice' }, { status: 404 });
    }

    // Decode base64 to binary buffer
    const buffer = Buffer.from(invoice.fileData, 'base64');

    // Vercel has a 4.5MB response body limit — reject files larger than 4MB
    if (buffer.length > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large to preview' }, { status: 413 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': invoice.fileType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
