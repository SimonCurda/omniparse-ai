import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';

// POST /api/pending-review/[id]/approve — approve a pending item, run full
// extraction, create an Invoice record, and clear the pending item.
//
// Body (optional):
//   { addToTrustedSenders: boolean } — if true, adds the sender to the
//   inbox's trusted senders list so future emails auto-import (in 'trusted' mode).
//
// The actual invoice extraction happens by calling the existing /api/parse
// endpoint internally. We construct an internal FormData request with the
// attachment + the user's auth token.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const addToTrustedSenders = body.addToTrustedSenders === true;

  const item = await db.pendingReview.findFirst({
    where: { id, userId: auth.userId, status: 'pending' },
  });
  if (!item) {
    return NextResponse.json({ error: 'Pending item not found or already processed' }, { status: 404 });
  }

  // Check user's plan limit before creating a new invoice
  const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const PLAN_LIMITS: Record<string, number> = {
    free: 15, pro: 500, plus: 2000, business: 10000, enterprise: Infinity,
  };
  const limit = PLAN_LIMITS[user.plan] ?? PLAN_LIMITS.free;
  const currentInvoiceCount = await db.invoice.count({ where: { userId: auth.userId } });
  if (currentInvoiceCount >= limit) {
    return NextResponse.json(
      { error: `You've reached your plan limit of ${limit} invoices. Upgrade to import more.` },
      { status: 403 },
    );
  }

  // Decode the attachment
  const fileBuffer = Buffer.from(item.attachmentData, 'base64');

  // Build a FormData for the internal call to /api/parse
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: item.attachmentMime });
  formData.append('file', blob, item.attachmentFilename);

  // Get the user's auth token from the request header
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  // Construct the internal URL. In Next.js, we can call our own API routes
  // via absolute URL using the request origin.
  const origin = req.headers.get('origin') || req.headers.get('x-forwarded-host');
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const baseUrl = origin || (host ? `${protocol}://${host}` : 'http://localhost:3000');

  // Call /api/parse internally
  const parseResponse = await fetch(`${baseUrl}/api/parse`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Cookie': req.headers.get('cookie') || '',
    },
    body: formData,
  });

  if (!parseResponse.ok) {
    const errorData = await parseResponse.json().catch(() => ({}));
    return NextResponse.json(
      { error: `Failed to extract invoice: ${errorData.error || parseResponse.statusText}` },
      { status: 500 },
    );
  }

  const parseResult = await parseResponse.json();
  const invoiceId = parseResult.id || parseResult.invoice?.id;

  // Mark the pending item as approved
  await db.pendingReview.update({
    where: { id },
    data: {
      status: 'approved',
      attachmentData: '', // free up storage — file is now in Invoice.fileData
      extractedData: parseResult,
    },
  });

  // If requested, add sender to trusted senders list
  if (addToTrustedSenders && item.fromAddress) {
    const inbox = await db.emailInbox.findFirst({
      where: { id: item.inboxId, userId: auth.userId },
      select: { id: true, trustedSenders: true },
    });
    if (inbox) {
      const existing = (inbox.trustedSenders as string[] | null) ?? [];
      if (!existing.includes(item.fromAddress.toLowerCase())) {
        await db.emailInbox.update({
          where: { id: inbox.id },
          data: {
            trustedSenders: [...existing, item.fromAddress.toLowerCase()],
          },
        });
      }
    }
  }

  // Audit log
  await db.auditLog.create({
    data: {
      userId: auth.userId,
      invoiceId,
      action: 'email_invoice_approved',
      details: {
        pendingReviewId: id,
        fromAddress: item.fromAddress,
        subject: item.subject,
        addedToTrusted: addToTrustedSenders,
      },
    },
  });

  return NextResponse.json({
    success: true,
    invoiceId,
    message: 'Invoice created from email',
  });
}
