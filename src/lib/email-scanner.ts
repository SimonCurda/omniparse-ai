// ─── Email Scanner ───────────────────────────────────────────────────────
//
// Connects to a user's IMAP inbox, fetches unseen emails with PDF/image
// attachments, runs them through the classifier, and either:
//   - Creates a PendingReview entry (for manual approval mode, or untrusted senders)
//   - Auto-imports as an Invoice (for trusted senders in 'trusted' mode)
//
// Designed to run within Vercel's 60s function timeout. Uses UID-based
// chunking so we can resume from where we left off on the next call.
//
// Caps:
//   - Max 25 emails per scan call (rest wait for next call)
//   - Max 100 pending items per inbox — scan pauses if queue is full

import { ImapFlow } from 'imapflow';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { classifyEmail, classifyEmailKeywordsOnly, type EmailClassification } from '@/lib/email-classifier';

const ALLOWED_ATTACHMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const ALLOWED_ATTACHMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

const MAX_EMAILS_PER_SCAN = 25;
const MAX_PENDING_PER_INBOX = 100;

export interface ScanResult {
  scanned: number;
  imported: number;       // auto-imported (trusted sender)
  pending: number;        // added to Pending Review queue
  skipped: number;        // not an invoice / no attachment / blocked sender
  blocked: number;        // sender added to blocklist (by user action — not here)
  remaining: number;      // emails still unprocessed in inbox
  nextUID: number;        // last UID we processed (for resume)
  paused: 'none' | 'pending_full' | 'max_emails' | 'time_limit';
  error?: string;
}

/**
 * Scan a single inbox for new invoice emails.
 *
 * @param inboxId The EmailInbox record ID
 * @param userId The user who owns the inbox (for security check)
 * @param options Optional abort signal + time budget
 */
export async function scanInbox(
  inboxId: string,
  userId: string,
  options: { maxDurationMs?: number } = {},
): Promise<ScanResult> {
  const maxDurationMs = options.maxDurationMs ?? 50_000; // 50s default (leaves 10s buffer under Vercel's 60s)
  const startTime = Date.now();

  const result: ScanResult = {
    scanned: 0,
    imported: 0,
    pending: 0,
    skipped: 0,
    blocked: 0,
    remaining: 0,
    nextUID: 0,
    paused: 'none',
  };

  // Load inbox + verify ownership
  const inbox = await db.emailInbox.findFirst({
    where: { id: inboxId, userId },
  });
  if (!inbox) {
    result.error = 'Inbox not found';
    return result;
  }
  if (!inbox.active) {
    result.error = 'Inbox is paused';
    return result;
  }

  // Check pending queue size — pause if full
  const pendingCount = await db.pendingReview.count({
    where: { userId, status: 'pending', inboxId },
  });
  if (pendingCount >= MAX_PENDING_PER_INBOX) {
    result.paused = 'pending_full';
    return result;
  }

  // Decrypt password
  let password: string;
  try {
    password = decrypt(inbox.encryptedPassword);
  } catch {
    result.error = 'Failed to decrypt inbox credentials (JWT_SECRET may have changed)';
    return result;
  }

  // Load user's blocklist (lowercased addresses)
  const blocklistRows = await db.emailBlocklist.findMany({ where: { userId } });
  const blocklist = new Set(blocklistRows.map((b) => b.address.toLowerCase()));

  // Load trusted senders for this inbox
  const trustedSenders = new Set<string>(
    (inbox.trustedSenders as string[] | null)?.map((s) => s.toLowerCase()) ?? [],
  );

  // Connect to IMAP
  let client: ImapFlow | null = null;
  try {
    client = new ImapFlow({
      host: inbox.imapHost,
      port: inbox.imapPort,
      secure: inbox.imapPort === 993,
      auth: { user: inbox.username, pass: password },
      logger: false, // silence imapflow's default logging
    });
    await client.connect();

    // Open INBOX (read-write so we can mark messages as seen)
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Search for messages with UID > lastSeenUID
      const searchCriteria = { uid: inbox.lastSeenUID > 0 ? `${inbox.lastSeenUID + 1}:*` : '1:*' };
      const uids = await client.search(searchCriteria, { uid: true });

      if (!uids || uids.length === 0) {
        // Nothing new
        result.nextUID = inbox.lastSeenUID;
        return result;
      }

      // Cap at MAX_EMAILS_PER_SCAN
      const uidsToProcess = uids.slice(0, MAX_EMAILS_PER_SCAN);
      result.remaining = Math.max(0, uids.length - uidsToProcess.length);

      let lastProcessedUID = inbox.lastSeenUID;

      for (const uid of uidsToProcess) {
        // Time budget check
        if (Date.now() - startTime > maxDurationMs) {
          result.paused = 'time_limit';
          break;
        }

        // Fetch the message (headers + structure)
        const msg = await client.fetchOne(uid, {
          uid: true,
          envelope: true,
          bodyStructure: true,
          headers: true,
        }, { uid: true });

        if (!msg) continue;

        result.scanned++;

        // Extract sender address from envelope
        const fromAddr = msg.envelope?.from?.[0]?.address?.toLowerCase() ?? '';
        const fromName = msg.envelope?.from?.[0]?.name ?? null;
        const subject = msg.envelope?.subject ?? '(no subject)';
        const receivedAt = msg.envelope?.date ? new Date(msg.envelope.date) : new Date();

        // ─── Stage 2: Sender blocklist check (free) ────────────────────
        if (fromAddr && blocklist.has(fromAddr)) {
          result.blocked++;
          // Mark as seen so we don't reprocess
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
          if (uid > lastProcessedUID) lastProcessedUID = uid;
          continue;
        }

        // ─── Stage 1: Find attachment ───────────────────────────────────
        // Walk the body structure to find PDF/image parts
        const attachment = findAttachment(msg.bodyStructure);
        if (!attachment) {
          // No usable attachment — skip + mark seen
          result.skipped++;
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
          if (uid > lastProcessedUID) lastProcessedUID = uid;
          continue;
        }

        // Download the attachment
        // imapflow's download() returns { meta, content } where content is a
        // Node Readable stream. We collect it into a Buffer.
        const downloadResult = await client.download(uid, attachment.part, { uid: true });
        const chunks: Buffer[] = [];
        for await (const chunk of downloadResult.content) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }
        const attachmentBytes = Buffer.concat(chunks);

        // 10 MB limit (matches /api/parse)
        if (attachmentBytes.length > 10 * 1024 * 1024) {
          result.skipped++;
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
          if (uid > lastProcessedUID) lastProcessedUID = uid;
          continue;
        }

        // ─── Stage 3: Keyword classification (free) ─────────────────────
        const emailInfo = {
          fromAddress: fromAddr,
          fromName,
          subject,
          attachmentFilename: attachment.filename || 'attachment',
        };

        // If sender is trusted AND scan mode is 'trusted', auto-import
        // without running the classifier (saves AI cost — user already
        // explicitly trusted this sender).
        const isTrustedSender = inbox.scanMode === 'trusted' && fromAddr && trustedSenders.has(fromAddr);

        let classification: EmailClassification = 'maybe';
        if (isTrustedSender) {
          classification = 'invoice';
        } else {
          // Run keyword check first (free)
          const keywordResult = classifyEmailKeywordsOnly(emailInfo);
          if (keywordResult === 'invoice') {
            classification = 'invoice';
          } else {
            // No keyword match — run AI classifier
            try {
              classification = await classifyEmail(emailInfo);
            } catch {
              classification = 'maybe';
            }
          }
        }

        // ─── Save to PendingReview (or auto-import if trusted) ─────────
        if (isTrustedSender) {
          // Auto-import: create a PendingReview with 'invoice' classification
          // but status 'pending' with auto-approve flag (so the user can
          // still review if they want, OR we auto-approve).
          //
          // For now, we still create a PendingReview entry — the user can
          // bulk-approve trusted senders in one click. This is safer than
          // auto-creating Invoice records directly.
          await db.pendingReview.create({
            data: {
              userId,
              inboxId,
              fromAddress: fromAddr,
              fromName,
              subject,
              receivedAt,
              attachmentFilename: attachment.filename || 'attachment',
              attachmentMime: attachment.mimeType,
              attachmentData: attachmentBytes.toString('base64'),
              classification: 'invoice',
              extractedData: Prisma.JsonNull,
              status: 'pending',
            },
          });
          result.pending++;
          result.imported++; // Count as "imported" in the sense that it's trusted
        } else {
          // Always goes to Pending Review — user decides
          await db.pendingReview.create({
            data: {
              userId,
              inboxId,
              fromAddress: fromAddr,
              fromName,
              subject,
              receivedAt,
              attachmentFilename: attachment.filename || 'attachment',
              attachmentMime: attachment.mimeType,
              attachmentData: attachmentBytes.toString('base64'),
              classification,
              extractedData: Prisma.JsonNull,
              status: 'pending',
            },
          });
          result.pending++;
        }

        // Mark email as seen so we don't reprocess
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        if (uid > lastProcessedUID) lastProcessedUID = uid;

        // Re-check pending queue cap
        const currentPending = await db.pendingReview.count({
          where: { userId, status: 'pending', inboxId },
        });
        if (currentPending >= MAX_PENDING_PER_INBOX) {
          result.paused = 'pending_full';
          break;
        }
      }

      result.nextUID = lastProcessedUID;

      // Update inbox with new lastSeenUID + timestamp
      await db.emailInbox.update({
        where: { id: inboxId },
        data: {
          lastSeenUID: lastProcessedUID,
          lastScannedAt: new Date(),
          lastScanError: null,
        },
      });
    } finally {
      lock.release();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown IMAP error';
    result.error = message;
    // Save error to inbox for display in settings
    await db.emailInbox.update({
      where: { id: inboxId },
      data: {
        lastScannedAt: new Date(),
        lastScanError: message.slice(0, 500),
      },
    }).catch(() => {});
  } finally {
    if (client) {
      try { await client.logout(); } catch { /* ignore */ }
    }
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

interface AttachmentInfo {
  part: string;
  filename: string;
  mimeType: string;
}

/**
 * Walk the MIME body structure to find the first PDF/image attachment.
 * Returns null if no usable attachment is found.
 */
function findAttachment(structure: unknown): AttachmentInfo | null {
  if (!structure || typeof structure !== 'object') return null;
  const node = structure as Record<string, unknown>;

  // If this is a leaf node with a content type, check it
  if (typeof node.type === 'string') {
    const mimeType = node.type.toLowerCase();
    const disposition = (node.disposition as string | undefined)?.toLowerCase() ?? '';
    const params = node.parameters as Record<string, unknown> | undefined;
    const filename =
      (node.filename as string | undefined) ??
      (params?.filename as string | undefined) ??
      'attachment';

    // Check by MIME type
    if (ALLOWED_ATTACHMENT_TYPES.has(mimeType) && disposition !== 'inline') {
      // Skip inline images (usually email signatures / logos)
      return {
        part: String(node.partNumber ?? ''),
        filename,
        mimeType,
      };
    }
  }

  // If this node has child parts (multipart), recurse
  if (Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) {
      const found = findAttachment(child);
      if (found) return found;
    }
  }

  // Some servers nest structure differently
  if (Array.isArray(node.parts)) {
    for (const child of node.parts) {
      const found = findAttachment(child);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Test IMAP connection without saving anything. Used by the "Test connection"
 * button in the inbox config UI.
 */
export async function testImapConnection(
  host: string,
  port: number,
  username: string,
  password: string,
): Promise<{ ok: boolean; mailboxCount?: number; error?: string }> {
  let client: ImapFlow | null = null;
  try {
    client = new ImapFlow({
      host,
      port,
      secure: port === 993,
      auth: { user: username, pass: password },
      logger: false,
    });
    await client.connect();

    // Get mailbox status
    const status = await client.status('INBOX', { messages: true, unseen: true });
    return {
      ok: true,
      mailboxCount: status.messages ?? 0,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown connection error',
    };
  } finally {
    if (client) {
      try { await client.logout(); } catch { /* ignore */ }
    }
  }
}
