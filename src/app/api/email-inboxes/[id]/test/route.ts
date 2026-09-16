import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';
import { testImapConnection } from '@/lib/email-scanner';

// POST /api/email-inboxes/[id]/test
//
// Tests the IMAP connection for an EXISTING inbox using its stored credentials.
// Returns mailbox status on success, human-readable error on failure.
//
// Used by the "Test Connection" button on existing inbox rows in the settings
// UI — useful for diagnosing:
//   - Wrong password (Gmail revoked your app password)
//   - Provider changed their host/port
//   - Network/firewall issues
//   - Account locked

export const maxDuration = 30;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const inbox = await db.emailInbox.findFirst({ where: { id, userId: auth.userId } });
  if (!inbox) return NextResponse.json({ error: 'Inbox not found' }, { status: 404 });

  let password: string;
  try {
    password = decrypt(inbox.encryptedPassword);
  } catch {
    return NextResponse.json(
      { error: 'Failed to decrypt stored credentials. This usually means JWT_SECRET changed — please remove the inbox and add it again.' },
      { status: 500 },
    );
  }

  const result = await testImapConnection(
    inbox.imapHost,
    inbox.imapPort,
    inbox.username,
    password,
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    mailboxCount: result.mailboxCount,
    unseenCount: result.unseenCount,
    message: `Connected. ${result.mailboxCount ?? 0} total messages (${result.unseenCount ?? 0} unread).`,
  });
}
