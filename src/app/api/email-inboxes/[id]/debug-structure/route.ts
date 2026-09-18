import { NextRequest, NextResponse } from 'next/server';
import { ImapFlow } from 'imapflow';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { decrypt } from '@/lib/crypto';

// GET /api/email-inboxes/[id]/debug-structure?limit=5&direction=newest
//
// Diagnostic endpoint that connects to the inbox and returns the BODYSTRUCTURE
// of the most recent N emails — without downloading attachments or creating
// PendingReview entries. Used for debugging "why didn't my invoice get caught".
//
// Output shape (per email):
//   {
//     uid: number,
//     from: string,
//     subject: string,
//     receivedAt: string,
//     bodyStructure: <imapflow's raw structure object>
//   }

export const maxDuration = 30;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const inbox = await db.emailInbox.findFirst({ where: { id, userId: auth.userId } });
  if (!inbox) return NextResponse.json({ error: 'Inbox not found' }, { status: 404 });

  let password: string;
  try {
    password = decrypt(inbox.encryptedPassword);
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt credentials' }, { status: 500 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '5'), 25);
  const direction = url.searchParams.get('direction') === 'oldest' ? 'oldest' : 'newest';

  let client: ImapFlow | null = null;
  try {
    client = new ImapFlow({
      host: inbox.imapHost,
      port: inbox.imapPort,
      secure: inbox.imapPort === 993,
      auth: { user: inbox.username, pass: password },
      logger: false,
    });
    await client.connect();

    const lock = await client.getMailboxLock('INBOX');
    try {
      const status = await client.status('INBOX', { messages: true, unseen: true });

      // Fetch all UIDs
      let uids = await client.search({ all: true }, { uid: true });
      if (!uids || uids.length === 0) {
        return NextResponse.json({ ok: true, mailbox: status, emails: [] });
      }

      // Sort
      uids.sort((a: number, b: number) => (direction === 'newest' ? b - a : a - b));
      const uidsToFetch = uids.slice(0, limit);

      const emails: unknown[] = [];
      for (const uid of uidsToFetch) {
        const msg = await client.fetchOne(
          uid,
          { uid: true, envelope: true, bodyStructure: true },
          { uid: true },
        );
        if (!msg) continue;

        // Walk the structure to find candidate attachments
        const candidates: Array<Record<string, unknown>> = [];
        const walk = (node: unknown, path: string): void => {
          if (!node || typeof node !== 'object') return;
          const n = node as Record<string, unknown>;
          const part = n.part !== undefined ? String(n.part) : '(none)';
          const type = typeof n.type === 'string' ? n.type : '(none)';
          const disposition = typeof n.disposition === 'string' ? n.disposition : '(none)';
          const dispParams = (n.dispositionParameters as Record<string, unknown>) ?? {};
          const ctParams = (n.parameters as Record<string, unknown>) ?? {};
          const filename =
            (dispParams.filename as string | undefined) ??
            (ctParams.name as string | undefined) ??
            '(none)';
          const encoding = typeof n.encoding === 'string' ? n.encoding : '(none)';
          const size = typeof n.size === 'number' ? n.size : null;

          // Only include leaf parts (parts with a part number) — not multipart containers
          if (n.part !== undefined) {
            candidates.push({
              path,
              part,
              type,
              disposition,
              filename,
              encoding,
              size,
            });
          }

          if (Array.isArray(n.childNodes)) {
            for (let i = 0; i < n.childNodes.length; i++) {
              walk(n.childNodes[i], `${path}.${i + 1}`);
            }
          }
        };

        if (msg.bodyStructure) {
          walk(msg.bodyStructure, 'root');
        }

        emails.push({
          uid: msg.uid,
          from: msg.envelope?.from?.[0]?.address ?? '',
          fromName: msg.envelope?.from?.[0]?.name ?? '',
          subject: msg.envelope?.subject ?? '(no subject)',
          receivedAt: msg.envelope?.date ?? null,
          candidates,
        });
      }

      return NextResponse.json({
        ok: true,
        mailbox: status,
        direction,
        emails,
      });
    } finally {
      lock.release();
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown IMAP error' },
      { status: 500 },
    );
  } finally {
    if (client) {
      try { await client.logout(); } catch { /* ignore */ }
    }
  }
}
