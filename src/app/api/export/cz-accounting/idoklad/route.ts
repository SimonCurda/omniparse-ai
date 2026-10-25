import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';
import { generateIdokladCsv, type InvoiceExportRow } from '@/lib/cz-accounting';

// ─── iDoklad CSV Export ──────────────────────────────────────────────────────
//
// POST /api/export/cz-accounting/idoklad
// Body: { invoiceIds: string[] }
// Returns: CSV file download (UTF-8 BOM)
//
// Output: iDoklad "Přijaté faktury" import CSV.
// Import path in iDoklad: Přehledy → Přijaté faktury → Import → CSV.

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (!user || !hasFeature(user.plan, 'custom_export_templates')) {
      return NextResponse.json({
        error: 'Czech accounting export requires Plus plan or higher.',
      }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { invoiceIds } = body as { invoiceIds?: string[] };
    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json({ error: 'invoiceIds (non-empty array) is required.' }, { status: 400 });
    }

    const invoices = await db.invoice.findMany({
      where: { id: { in: invoiceIds }, userId: auth.userId },
      select: {
        id: true, vendor: true, invNumber: true, invDate: true, dueDate: true,
        amount: true, vatAmount: true, total: true, currency: true,
        documentLanguage: true, customFields: true,
      },
    });

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'No invoices found.' }, { status: 404 });
    }

    const rows: InvoiceExportRow[] = invoices.map(inv => ({
      id: inv.id,
      vendor: inv.vendor,
      invNumber: inv.invNumber,
      invDate: inv.invDate,
      dueDate: inv.dueDate,
      amount: inv.amount,
      vatAmount: inv.vatAmount,
      total: inv.total,
      currency: inv.currency,
      documentLanguage: inv.documentLanguage,
      customFields: inv.customFields as Record<string, unknown> | null,
    }));

    const csv = generateIdokladCsv(rows);
    const today = new Date().toISOString().slice(0, 10);
    const filename = `idoklad-import-${today}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[export/cz-accounting/idoklad] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
