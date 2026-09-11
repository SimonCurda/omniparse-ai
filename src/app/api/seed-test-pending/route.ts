import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';

// POST /api/seed-test-pending
//
// Creates a fake EmailInbox + 5 fake PendingReview records so the user can
// see the Pending Review tab working end-to-end without needing a real email
// account. The pending items have realistic data + tiny valid PDF attachments.
//
// After the user is done testing, they can delete the inbox in Settings and
// all pending items will be cascade-deleted.
//
// This endpoint is auth-gated (only works for the logged-in user).

// Tiny valid PDF with text — same generator as the mock IMAP server
function makePdf(text: string): string {
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = `BT /F1 12 Tf 50 750 Td (${escaped}) Tj ET`;
  const objs = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj`,
    `4 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];
  const offsets: number[] = [];
  let pos = 0;
  const body: string[] = [];
  for (const obj of objs) {
    offsets.push(pos);
    body.push(obj);
    pos += obj.length + 1;
  }
  const xrefStart = pos;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += String(off).padStart(10, '0') + ' 00000 n \n';
  const trailer = `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from([...body, xref, trailer].join('\n')).toString('base64');
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

  // Check if pending items already exist for this inbox
  const existingCount = await db.pendingReview.count({
    where: { userId: auth.userId, inboxId: inbox.id, status: 'pending' },
  });
  if (existingCount > 0) {
    return NextResponse.json({
      success: true,
      message: `You already have ${existingCount} pending items. Go to the Pending tab to review them.`,
      inboxId: inbox.id,
      pendingCount: existingCount,
    });
  }

  // Create 5 test pending items with realistic data
  const testItems = [
    {
      fromAddress: 'billing@aws.com',
      fromName: 'Amazon Web Services',
      subject: 'AWS Invoice INV-2026-0315 - March 2026',
      receivedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
      attachmentFilename: 'aws-invoice-2026-03.pdf',
      attachmentMime: 'application/pdf',
      attachmentData: makePdf('AWS Invoice  Invoice Number: INV-2026-0315  Date: 2026-03-15  Due Date: 2026-04-15  Vendor: Amazon Web Services, Inc.  Amount: $432.18  VAT: $86.44  Total: $518.62  Currency: USD  Description: EC2 t3.medium - 720 hours, S3 storage - 50 GB, Data transfer - 100 GB'),
      classification: 'invoice',
    },
    {
      fromAddress: 'newsletter@marketing.com',
      fromName: 'Marketing Insights Weekly',
      subject: '5 Marketing Trends for 2026 - Download Report',
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      attachmentFilename: 'trends-2026.pdf',
      attachmentMime: 'application/pdf',
      attachmentData: makePdf('Marketing Insights Weekly  5 Trends Shaping the Industry in 2026  1. AI is everywhere  2. Remote work is permanent  3. Sustainability matters  4. Personalization at scale  5. Data privacy  Download the full report at example.com/report'),
      classification: 'no',
    },
    {
      fromAddress: 'invoicing@stripe.com',
      fromName: 'Stripe',
      subject: 'Invoice IN-2026-0042 from Stripe',
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
      attachmentFilename: 'invoice-0042.pdf',
      attachmentMime: 'application/pdf',
      attachmentData: makePdf('Stripe  Invoice Number: IN-2026-0042  Date: 2026-03-20  Due Date: 2026-04-20  Bill to: Acme Corp  Amount: EUR 1234.56  VAT: EUR 246.91  Total: EUR 1481.47  Currency: EUR  Plan: Business subscription  Seats: 5'),
      classification: 'invoice',
    },
    {
      fromAddress: 'statements@bank.com',
      fromName: 'Bank',
      subject: 'Your March 2026 Statement',
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      attachmentFilename: 'statement-march.pdf',
      attachmentMime: 'application/pdf',
      attachmentData: makePdf('Bank Statement  Account: ****1234  Period: March 2026  Opening balance: $10,000.00  Closing balance: $9,567.82  Transactions: 2026-03-01 Coffee shop -$4.50, 2026-03-02 Salary +$3,200.00, 2026-03-05 Rent -$1,200.00'),
      classification: 'maybe',
    },
    {
      fromAddress: 'billing@google.com',
      fromName: 'Google Cloud',
      subject: 'Google Cloud Invoice - April 2026',
      receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
      attachmentFilename: 'google-invoice-apr-2026.pdf',
      attachmentMime: 'application/pdf',
      attachmentData: makePdf('Google Cloud Invoice  Invoice Number: GC-2026-04  Date: 2026-04-01  Due Date: 2026-05-01  Vendor: Google LLC  Amount: $287.45  VAT: $57.49  Total: $344.94  Currency: USD  Project: omniparse-prod  Compute Engine: 720 hours  Cloud Storage: 25 GB'),
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
