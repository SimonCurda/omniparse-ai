import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// POST /api/fix-email-badges
// Retroactively marks existing invoices as email-sourced by finding approved
// PendingReview records and updating the linked Invoice's customFields.
//
// This is needed because invoices approved BEFORE the customFields.source
// update was added don't have source: 'email' set.
//
// Temporary endpoint — delete after running.

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Find all approved pending reviews for this user
  const approvedItems = await db.pendingReview.findMany({
    where: { userId: auth.userId, status: 'approved' },
    select: { id: true, fromAddress: true, fromName: true, subject: true, receivedAt: true, extractedData: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const item of approvedItems) {
    // Extract invoiceId from the stored extractedData
    const extractedData = item.extractedData as Record<string, unknown> | null;
    const invoiceId = extractedData?.invoiceId as string | undefined;

    if (!invoiceId) {
      skipped++;
      continue;
    }

    // Find the invoice
    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, userId: auth.userId },
      select: { id: true, customFields: true },
    });

    if (!invoice) {
      skipped++;
      continue;
    }

    // Check if already has source: 'email'
    const existing = (invoice.customFields as Record<string, unknown> | null) ?? {};
    if (existing.source === 'email') {
      skipped++;
      continue;
    }

    // Update with email source info
    await db.invoice.update({
      where: { id: invoice.id },
      data: {
        customFields: {
          ...existing,
          source: 'email',
          emailFromAddress: item.fromAddress,
          emailFromName: item.fromName,
          emailSubject: item.subject,
          emailDate: item.receivedAt,
          pendingReviewId: item.id,
        },
      },
    });
    updated++;
  }

  return NextResponse.json({
    success: true,
    message: `Updated ${updated} invoice(s) with email badge. ${skipped} already had it or were missing invoice link.`,
    updated,
    skipped,
    total: approvedItems.length,
  });
}
