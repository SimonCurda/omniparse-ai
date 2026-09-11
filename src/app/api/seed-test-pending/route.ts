import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';
import { makeInvoicePdf, makeValidPdf, type InvoiceLayout } from '@/lib/make-pdf';

// POST /api/seed-test-pending
//
// Creates a fake EmailInbox + 5 fake PendingReview records so the user can
// see the Pending Review tab working end-to-end without needing a real email
// account. The pending items have realistic data + properly formatted PDF
// attachments that look like real invoices.
//
// After the user is done testing, they can delete the inbox in Settings and
// all pending items will be cascade-deleted.
//
// This endpoint is auth-gated (only works for the logged-in user) — items
// are created in the user's own account, not globally.

// Helper: build a properly-formatted invoice PDF and return as base64
function makeInvoicePdfBase64(layout: InvoiceLayout): string {
  return makeInvoicePdf(layout).toString('base64');
}

// Helper: build a non-invoice PDF (newsletter, statement, etc.)
function makePlainPdfBase64(text: string): string {
  return makeValidPdf(text).toString('base64');
}

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check if user already has an EmailInbox — if so, skip creating a new one
  let inbox = await db.emailInbox.findFirst({ where: { userId: auth.userId } });

  if (!inbox) {
    // Create a fake inbox (with a fake encrypted password — won't actually connect anywhere)
    inbox = await db.emailInbox.create({
      data: {
        userId: auth.userId,
        label: 'Test Inbox (Demo)',
        emailAddress: 'test@omniparse.dev',
        imapHost: 'mock-imap.omniparse.dev',
        imapPort: 1143,
        username: 'test@omniparse.dev',
        encryptedPassword: encrypt('testpass123'),
        scanMode: 'manual',
        active: true,
      },
    });
  }

  // Delete existing pending items for this inbox so we can re-seed with
  // valid PDFs (the first version generated malformed PDFs that browsers
  // couldn't render). Also handles the case where the user already tested
  // and wants fresh data.
  await db.pendingReview.deleteMany({
    where: { userId: auth.userId, inboxId: inbox.id },
  });

  // Create 5 test pending items with realistic data + properly formatted PDFs
  const testItems = [
    {
      fromAddress: 'billing@aws.com',
      fromName: 'Amazon Web Services',
      subject: 'AWS Invoice INV-2026-0315 - March 2026',
      receivedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
      attachmentFilename: 'aws-invoice-2026-03.pdf',
      attachmentMime: 'application/pdf',
      attachmentData: makeInvoicePdfBase64({
        vendorName: 'Amazon Web Services, Inc.',
        vendorSubtitle: 'P.O. Box 81226, Seattle, WA 98108-1226',
        documentTitle: 'INVOICE',
        sections: [
          { type: 'header', title: 'Bill To:' },
          { type: 'row', label: 'Customer', value: 'Acme Corporation' },
          { type: 'row', label: 'Account ID', value: '123456789012' },
          { type: 'spacing' },
          { type: 'header', title: 'Invoice Details:' },
          { type: 'row', label: 'Invoice Number', value: 'INV-2026-0315' },
          { type: 'row', label: 'Invoice Date', value: 'March 15, 2026' },
          { type: 'row', label: 'Due Date', value: 'April 15, 2026' },
          { type: 'row', label: 'Currency', value: 'USD' },
          { type: 'spacing' },
          { type: 'header', title: 'Service Summary:' },
          {
            type: 'table',
            columns: ['Service', 'Usage', 'Amount'],
            rows: [
              ['EC2 t3.medium', '720 hours', '$234.50'],
              ['S3 Standard Storage', '50 GB', '$12.40'],
              ['Data Transfer', '100 GB', '$185.28'],
            ],
          },
          { type: 'spacing' },
          { type: 'row', label: 'Subtotal', value: '$432.18' },
          { type: 'row', label: 'VAT (20%)', value: '$86.44' },
        ],
        totalLabel: 'Total Due',
        totalValue: '$518.62',
      }),
      classification: 'invoice',
    },
    {
      fromAddress: 'newsletter@marketing.com',
      fromName: 'Marketing Insights Weekly',
      subject: '5 Marketing Trends for 2026 - Download Report',
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      attachmentFilename: 'trends-2026.pdf',
      attachmentMime: 'application/pdf',
      attachmentData: makePlainPdfBase64('Marketing Insights Weekly Report - 5 Trends Shaping the Industry in 2026 - 1. AI is everywhere - 2. Remote work is permanent - 3. Sustainability matters - 4. Personalization at scale - 5. Data privacy - Download the full report at example.com/report'),
      classification: 'no',
    },
    {
      fromAddress: 'invoicing@stripe.com',
      fromName: 'Stripe',
      subject: 'Invoice IN-2026-0042 from Stripe',
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
      attachmentFilename: 'invoice-0042.pdf',
      attachmentMime: 'application/pdf',
      attachmentData: makeInvoicePdfBase64({
        vendorName: 'Stripe, Inc.',
        vendorSubtitle: '354 Oyster Point Blvd, South San Francisco, CA 94080',
        documentTitle: 'INVOICE',
        sections: [
          { type: 'header', title: 'Bill To:' },
          { type: 'row', label: 'Customer', value: 'Acme Corp' },
          { type: 'row', label: 'Email', value: 'billing@acme.com' },
          { type: 'spacing' },
          { type: 'header', title: 'Invoice Details:' },
          { type: 'row', label: 'Invoice Number', value: 'IN-2026-0042' },
          { type: 'row', label: 'Invoice Date', value: 'March 20, 2026' },
          { type: 'row', label: 'Due Date', value: 'April 20, 2026' },
          { type: 'row', label: 'Currency', value: 'EUR' },
          { type: 'spacing' },
          { type: 'header', title: 'Subscription:' },
          {
            type: 'table',
            columns: ['Plan', 'Quantity', 'Amount'],
            rows: [
              ['Business subscription', '5 seats', '€1,234.56'],
            ],
          },
          { type: 'spacing' },
          { type: 'row', label: 'Subtotal', value: '€1,234.56' },
          { type: 'row', label: 'VAT (20%)', value: '€246.91' },
        ],
        totalLabel: 'Total Due',
        totalValue: '€1,481.47',
      }),
      classification: 'invoice',
    },
    {
      fromAddress: 'statements@bank.com',
      fromName: 'Bank',
      subject: 'Your March 2026 Statement',
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      attachmentFilename: 'statement-march.pdf',
      attachmentMime: 'application/pdf',
      attachmentData: makePlainPdfBase64('Bank Statement - Account: ****1234 - Period: March 2026 - Opening balance: $10,000.00 - Closing balance: $9,567.82 - Transactions: 2026-03-01 Coffee shop -$4.50, 2026-03-02 Salary +$3,200.00, 2026-03-05 Rent -$1,200.00, 2026-03-10 Grocery -$87.43, 2026-03-15 Utilities -$145.25'),
      classification: 'maybe',
    },
    {
      fromAddress: 'billing@google.com',
      fromName: 'Google Cloud',
      subject: 'Google Cloud Invoice - April 2026',
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
      attachmentFilename: 'google-invoice-apr-2026.pdf',
      attachmentMime: 'application/pdf',
      attachmentData: makeInvoicePdfBase64({
        vendorName: 'Google LLC',
        vendorSubtitle: '1600 Amphitheatre Parkway, Mountain View, CA 94043',
        documentTitle: 'INVOICE',
        sections: [
          { type: 'header', title: 'Bill To:' },
          { type: 'row', label: 'Customer', value: 'Acme Corporation' },
          { type: 'row', label: 'Project', value: 'omniparse-prod' },
          { type: 'spacing' },
          { type: 'header', title: 'Invoice Details:' },
          { type: 'row', label: 'Invoice Number', value: 'GC-2026-04' },
          { type: 'row', label: 'Invoice Date', value: 'April 1, 2026' },
          { type: 'row', label: 'Due Date', value: 'May 1, 2026' },
          { type: 'row', label: 'Currency', value: 'USD' },
          { type: 'spacing' },
          { type: 'header', title: 'Service Summary:' },
          {
            type: 'table',
            columns: ['Service', 'Usage', 'Amount'],
            rows: [
              ['Compute Engine', '720 hours', '$184.32'],
              ['Cloud Storage', '25 GB', '$3.45'],
              ['BigQuery', '50 GB processed', '$45.20'],
              ['Networking', '200 GB', '$54.48'],
            ],
          },
          { type: 'spacing' },
          { type: 'row', label: 'Subtotal', value: '$287.45' },
          { type: 'row', label: 'VAT (20%)', value: '$57.49' },
        ],
        totalLabel: 'Total Due',
        totalValue: '$344.94',
      }),
      classification: 'invoice',
    },
  ];

  for (const item of testItems) {
    await db.pendingReview.create({
      data: {
        userId: auth.userId,
        inboxId: inbox.id,
        ...item,
        status: 'pending',
      },
    });
  }

  return NextResponse.json({
    success: true,
    message: `Created ${testItems.length} test pending items. Go to the Pending tab to see them.`,
    inboxId: inbox.id,
    pendingCount: testItems.length,
  });
}
