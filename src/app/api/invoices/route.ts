import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    },
  });

  return NextResponse.json(invoices);
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
