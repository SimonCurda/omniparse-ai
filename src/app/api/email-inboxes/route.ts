import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { encrypt, decrypt } from '@/lib/crypto';
import { testImapConnection } from '@/lib/email-scanner';

// Common IMAP providers — auto-fill host + port when user picks one
const IMAP_PROVIDERS: Record<string, { host: string; port: number; docs: string }> = {
  gmail: { host: 'imap.gmail.com', port: 993, docs: 'https://support.google.com/accounts/answer/185833' },
  outlook: { host: 'outlook.office365.com', port: 993, docs: 'https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-for-outlook-com-8361e398-8774-4e9b-b0c5-6ccae4d2b994' },
  yahoo: { host: 'imap.mail.yahoo.com', port: 993, docs: 'https://help.yahoo.com/kb/SLN15241.html' },
  icloud: { host: 'imap.mail.me.com', port: 993, docs: 'https://support.apple.com/en-us/HT202304' },
  zoho: { host: 'imap.zoho.com', port: 993, docs: 'https://www.zoho.com/mail/help/imap-access.html' },
  proton: { host: '127.0.0.1', port: 1143, docs: 'https://proton.me/mail/bridge' }, // requires Proton Bridge
  other: { host: '', port: 993, docs: '' },
};

// GET /api/email-inboxes — list user's inboxes
export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const inboxes = await db.emailInbox.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      label: true,
      emailAddress: true,
      imapHost: true,
      imapPort: true,
      username: true,
      scanMode: true,
      trustedSenders: true,
      active: true,
      lastSeenUID: true,
      lastScannedAt: true,
      lastScanError: true,
      createdAt: true,
      // NEVER select encryptedPassword
    },
  });

  return NextResponse.json({ inboxes, providers: IMAP_PROVIDERS });
}

// POST /api/email-inboxes — create a new inbox
export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    label,
    emailAddress,
    imapHost,
    imapPort,
    username,
    password,
    scanMode = 'manual',
    trustedSenders = [],
    testOnly = false,
  } = body;

  // Validate
  if (!label || !emailAddress || !imapHost || !username || !password) {
    return NextResponse.json(
      { error: 'Missing required fields: label, emailAddress, imapHost, username, password' },
      { status: 400 },
    );
  }

  const port = Number(imapPort) || 993;

  // Test the connection first (always — even if not testOnly, we want to
  // verify credentials before saving)
  const testResult = await testImapConnection(imapHost, port, username, password);
  if (!testResult.ok) {
    return NextResponse.json(
      { error: `Connection failed: ${testResult.error}` },
      { status: 400 },
    );
  }

  // If testOnly, don't save — just return success
  if (testOnly) {
    return NextResponse.json({
      ok: true,
      mailboxCount: testResult.mailboxCount,
      message: `Connected successfully. ${testResult.mailboxCount ?? 0} messages in inbox.`,
    });
  }

  // Limit: max 5 inboxes per user (prevent abuse)
  const existingCount = await db.emailInbox.count({ where: { userId: auth.userId } });
  if (existingCount >= 5) {
    return NextResponse.json(
      { error: 'Maximum 5 email inboxes per account.' },
      { status: 400 },
    );
  }

  // Encrypt the password
  const encryptedPassword = encrypt(password);

  const inbox = await db.emailInbox.create({
    data: {
      userId: auth.userId,
      label,
      emailAddress: emailAddress.toLowerCase(),
      imapHost,
      imapPort: port,
      username,
      encryptedPassword,
      scanMode: scanMode === 'trusted' ? 'trusted' : 'manual',
      trustedSenders: Array.isArray(trustedSenders) ? trustedSenders : [],
    },
    select: {
      id: true,
      label: true,
      emailAddress: true,
      imapHost: true,
      imapPort: true,
      username: true,
      scanMode: true,
      trustedSenders: true,
      active: true,
      lastScannedAt: true,
      createdAt: true,
    },
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: 'email_inbox_added',
      details: { inboxId: inbox.id, label, emailAddress, imapHost },
    },
  });

  return NextResponse.json({ inbox, message: `Connected successfully. ${testResult.mailboxCount ?? 0} messages in inbox.` });
}

// PATCH /api/email-inboxes — update an inbox (toggle active, change mode, add trusted senders)
export async function PATCH(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, active, scanMode, trustedSenders } = body;

  if (!id) {
    return NextResponse.json({ error: 'Inbox ID required' }, { status: 400 });
  }

  const inbox = await db.emailInbox.findFirst({ where: { id, userId: auth.userId } });
  if (!inbox) {
    return NextResponse.json({ error: 'Inbox not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof active === 'boolean') updates.active = active;
  if (scanMode === 'manual' || scanMode === 'trusted') updates.scanMode = scanMode;
  if (Array.isArray(trustedSenders)) {
    updates.trustedSenders = trustedSenders.map((s: string) => s.toLowerCase());
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
  }

  const updated = await db.emailInbox.update({
    where: { id },
    data: updates,
    select: {
      id: true,
      label: true,
      emailAddress: true,
      scanMode: true,
      trustedSenders: true,
      active: true,
      lastScannedAt: true,
    },
  });

  return NextResponse.json({ inbox: updated });
}

// Helper used by other routes — verify inbox ownership
export async function verifyInboxOwnership(inboxId: string, userId: string) {
  const inbox = await db.emailInbox.findFirst({ where: { id: inboxId, userId } });
  return inbox;
}
