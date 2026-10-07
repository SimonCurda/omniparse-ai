import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// Force dynamic rendering and explicitly disable every form of caching.
// The invoices list changes whenever the user uploads or deletes an invoice,
// so a stale cached copy in the browser (or in a Vercel edge cache) leads
// to "invoices tab is broken" reports where the list shown doesn't match
// what's actually in the database. The user observed that the tab works in
// an incognito window — that's the giveaway: incognito has no cache, the
// regular browser profile does. Setting `Cache-Control: no-store` on every
// response forces the browser to always revalidate against the server.
//
// `dynamic = 'force-dynamic'` also tells Next.js not to render this route
// at build time (which would otherwise produce a static, frozen copy).
export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store',
} as const;

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE_HEADERS });
  }

  const invoices = await db.invoice.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
    // Exclude fileData from list — it's base64 and can be megabytes.
    // Use /api/invoices/[id]/file for viewing individual files.
    select: {
      id: true, filename: true, vendor: true, invNumber: true,
      invDate: true, dueDate: true, amount: true, vatAmount: true,
      total: true, currency: true, status: true, isDuplicate: true,
      confidence: true, fieldConfidence: true, rawExtraction: true,
      lineItems: true, errorMessage: true, validationResults: true,
      validationStatus: true, normalizedVendor: true, normalizedInvDate: true,
      normalizedDueDate: true, normalizedAmount: true, normalizedTotal: true,
      normalizedCurrency: true, processingTime: true, customFields: true,
      approvalStatus: true, approvalRuleId: true, lifecycleStatus: true,
      entityId: true, createdAt: true, updatedAt: true,
      labels: { include: { label: { select: { id: true, name: true, color: true } } } },
    },
  });

  return NextResponse.json(
    invoices.map((inv) => ({
      ...inv,
      labels: inv.labels.map((a) => ({ label: { id: a.label.id, name: a.label.name, color: a.label.color } })),
    })),
    { headers: NO_CACHE_HEADERS },
  );
}

export async function DELETE(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Invoice ID is required.' }, { status: 400 });
  }

  const invoice = await db.invoice.findFirst({ where: { id, userId: auth.userId } });
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  await db.invoice.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
