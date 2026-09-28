import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';
import { checkMonthlyParseLimit, incrementMonthlyParseCount } from '@/lib/parse-limit';

// ─── Server-side MIME attachment extraction ───────────────────────────────
// When a pending review item was stored with the raw email body instead of
// the actual PDF (happened before the email-scanner fix), we need to extract
// the real attachment from the MIME structure before sending to /api/parse.
// Otherwise /api/parse's magic-byte validation rejects it.

function detectMimeFromBuffer(buf: Buffer): string {
  if (buf.length < 4) return 'application/octet-stream';
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf';
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf.length > 11 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  return 'application/octet-stream';
}

function isRawEmail(buf: Buffer): boolean {
  const text = buf.slice(0, Math.min(buf.length, 500)).toString('latin1').toLowerCase();
  return /^(delivered-to|received|return-path|dkim-signature|arc-|mime-version|content-type|from:|to:|subject:)/im.test(text);
}

function extractAttachmentFromRawEmail(rawEmail: Buffer): { buffer: Buffer; filename: string; mime: string } | null {
  try {
    const raw = rawEmail.toString('latin1');
    const ctMatch = raw.match(/content-type:\s*multipart\/[^;]+;\s*boundary=(?:"([^"]+)"|([^\s\r\n]+))/i);
    if (!ctMatch) return null;
    const boundary = ctMatch[1] || ctMatch[2];
    if (!boundary) return null;

    const delimiter = `--${boundary}`;
    const parts = raw.split(delimiter);
    if (parts.length < 2) return null;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (!part || part.trim() === '--' || part.trim() === '') continue;

      const headerEnd = part.indexOf('\r\n\r\n') >= 0 ? part.indexOf('\r\n\r\n') : part.indexOf('\n\n');
      if (headerEnd < 0) continue;
      const partHeaders = part.slice(0, headerEnd).toLowerCase();
      const partBody = part.slice(headerEnd + 4).trim();

      const isPdf = partHeaders.includes('content-type: application/pdf') ||
                    partHeaders.match(/name="[^"]*\.pdf"/i) ||
                    partHeaders.match(/filename=[^\s]*\.pdf/i);
      const isImage = partHeaders.includes('content-type: image/') ||
                      partHeaders.match(/name="[^"]*\.(jpg|jpeg|png|webp)"/i) ||
                      partHeaders.match(/filename=[^\s]*\.(jpg|jpeg|png|webp)/i);

      if (!isPdf && !isImage) continue;

      let filename = 'attachment';
      const nameMatch = partHeaders.match(/name="([^"]+)"/i) ||
                        partHeaders.match(/filename=([^\s;]+)/i) ||
                        partHeaders.match(/filename="([^"]+)"/i);
      if (nameMatch) filename = nameMatch[1] || filename;

      let fileBuffer: Buffer;
      if (partHeaders.includes('content-transfer-encoding: base64')) {
        fileBuffer = Buffer.from(partBody.replace(/[\s\r\n]/g, ''), 'base64');
      } else if (partHeaders.includes('content-transfer-encoding: quoted-printable')) {
        const decoded = partBody
          .replace(/=\r?\n/g, '')
          .replace(/=([0-9A-F]{2})/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
        fileBuffer = Buffer.from(decoded, 'latin1');
      } else {
        fileBuffer = Buffer.from(partBody, 'latin1');
      }

      // Verify magic bytes
      const detectedMime = detectMimeFromBuffer(fileBuffer);
      if (detectedMime !== 'application/octet-stream') {
        return { buffer: fileBuffer, filename, mime: detectedMime };
      }
    }
    return null;
  } catch {
    return null;
  }
}

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

  // Check user's plan limit — HARD monthly counter (not affected by deletion)
  const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true, active: true, frozenReason: true } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Frozen account check
  if (!user.active) {
    return NextResponse.json(
      { error: user.frozenReason || 'Your account has been frozen. Please contact support.', code: 'ACCOUNT_FROZEN' },
      { status: 403 },
    );
  }

  // Hard monthly parse limit — same counter as /api/parse
  const parseLimit = await checkMonthlyParseLimit(auth.userId, user.plan);
  if (!parseLimit.allowed) {
    return NextResponse.json(
      { error: parseLimit.message || `Monthly limit reached (${parseLimit.count}/${parseLimit.limit}). Resets on the 1st of next month.`, code: 'MONTHLY_LIMIT_REACHED' },
      { status: 429 },
    );
  }

  // Decode the attachment
  let fileBuffer = Buffer.from(item.attachmentData, 'base64');
  let fileMime = item.attachmentMime;
  let fileFilename = item.attachmentFilename;

  // ─── Recover PDF from raw email if needed ──────────────────────────
  // If the stored attachment is actually the raw email body (happened before
  // the email-scanner fix), extract the real PDF/image from the MIME structure.
  // Otherwise /api/parse's magic-byte validation will reject it.
  if (isRawEmail(fileBuffer)) {
    console.warn(`[pending-review/approve] Stored attachment is raw email, extracting real PDF...`);
    const extracted = extractAttachmentFromRawEmail(fileBuffer);
    if (extracted) {
      console.warn(`[pending-review/approve] Extracted "${extracted.filename}" (${extracted.mime}, ${extracted.buffer.length} bytes) from raw email`);
      fileBuffer = extracted.buffer;
      fileMime = extracted.mime;
      fileFilename = extracted.filename;
    } else {
      return NextResponse.json(
        { error: 'The stored attachment is a raw email, but no PDF/image could be extracted from its MIME structure. Please delete this item and re-scan the inbox.' },
        { status: 400 },
      );
    }
  }

  // Build a FormData for the internal call to /api/parse
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: fileMime });
  formData.append('file', blob, fileFilename);

  // ─── Pass email provenance metadata to /api/parse ──────────────────
  // /api/parse stamps these onto the Invoice's customFields at creation
  // time, so the "From Email" badge works regardless of whether this
  // approval is manual or auto-approval rules fire inside parse.
  formData.append('emailSource', 'true');
  if (item.fromAddress) formData.append('emailFromAddress', item.fromAddress);
  if (item.fromName) formData.append('emailFromName', item.fromName);
  if (item.subject) formData.append('emailSubject', item.subject);
  if (item.receivedAt) {
    try {
      formData.append('emailDate', new Date(item.receivedAt).toISOString());
    } catch { /* skip invalid date */ }
  }
  formData.append('pendingReviewId', id);

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

  // Note: email provenance (customFields.source='email' + email metadata) is
  // now set at invoice creation time inside /api/parse, NOT here. This means
  // the "From Email" badge works for:
  //   - Manual approvals (this path)
  //   - Auto-approval rules that fire inside /api/parse
  //   - Future auto-approve webhooks that call /api/parse directly
  // No post-creation customFields update needed.

  // Mark the pending item as approved (keep attachmentData for potential un-approve)
  await db.pendingReview.update({
    where: { id },
    data: {
      status: 'approved',
      // Don't delete attachmentData — keep it so the user can un-approve
      // and restore the pending item if they made a mistake.
      extractedData: { ...parseResult, invoiceId },
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
