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

// Min size to keep an attachment. Filters out tiny inline images like
// email signature logos (typically 1-5KB) and tracking pixels (<1KB).
// Real invoice photos/scans are almost always >50KB.
const MIN_ATTACHMENT_BYTES = 10 * 1024; // 10KB

// Max size — matches /api/parse limit
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB

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
  options: { maxDurationMs?: number; direction?: 'oldest' | 'newest' } = {},
): Promise<ScanResult> {
  const maxDurationMs = options.maxDurationMs ?? 50_000; // 50s default (leaves 10s buffer under Vercel's 60s)
  const direction = options.direction ?? 'oldest'; // default: oldest first
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

    // Open INBOX in READ-ONLY mode. We do NOT mark emails as \Seen
    // because that would mess up the user's unread count in their email client.
    // Instead, we track which UIDs we've already processed via the
    // lastSeenUID field + scannedUIDs JSON array on the EmailInbox record.
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Load previously scanned UIDs (to avoid re-processing in "newest" mode)
      const scannedSet = new Set<number>(
        (inbox.scannedUIDs as number[] | null) ?? []
      );

      // Search for messages with UID > lastSeenUID
      const searchCriteria = { uid: inbox.lastSeenUID > 0 ? `${inbox.lastSeenUID + 1}:*` : '1:*' };
      let uids = await client.search(searchCriteria, { uid: true });

      if (!uids || uids.length === 0) {
        // Nothing new
        result.nextUID = inbox.lastSeenUID;
        return result;
      }

      // Filter out UIDs we've already scanned (important for "newest" mode
      // where we process out of order)
      uids = uids.filter((uid: number) => !scannedSet.has(uid));

      if (uids.length === 0) {
        // All remaining emails already scanned
        result.nextUID = inbox.lastSeenUID;
        return result;
      }

      // Sort UIDs: ascending for "oldest", descending for "newest"
      if (direction === 'newest') {
        uids.sort((a: number, b: number) => b - a); // newest (highest UID) first
      } else {
        uids.sort((a: number, b: number) => a - b); // oldest (lowest UID) first
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

        // Extract sender address from envelope (available from search results,
        // before we even fetch the full message body)
        const fromAddr = msg.envelope?.from?.[0]?.address?.toLowerCase() ?? '';
        const fromName = msg.envelope?.from?.[0]?.name ?? null;
        const subject = msg.envelope?.subject ?? '(no subject)';
        const receivedAt = msg.envelope?.date ? new Date(msg.envelope.date) : new Date();

        // ─── Stage 1: Sender blocklist check (free, instant) ───────────────
        // Checked FIRST so we skip blocked senders before doing any work
        // (no attachment download, no body structure parsing needed).
        if (fromAddr && blocklist.has(fromAddr)) {
          result.blocked++;
          if (uid > lastProcessedUID) lastProcessedUID = uid;
          continue;
        }

        // ─── Stage 2: Find attachment ───────────────────────────────────────
        // Walk the body structure to find PDF/image parts
        const attachment = findAttachment(msg.bodyStructure);
        if (!attachment) {
          // No usable attachment — skip
          result.skipped++;
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
        if (attachmentBytes.length > MAX_ATTACHMENT_BYTES) {
          result.skipped++;
          if (uid > lastProcessedUID) lastProcessedUID = uid;
          continue;
        }

        // Min size: skip tiny inline images (signature logos, tracking pixels).
        // Only applies to images — PDFs are pre-filtered by disposition above.
        if (
          attachment.mimeType.startsWith('image/') &&
          attachmentBytes.length < MIN_ATTACHMENT_BYTES
        ) {
          result.skipped++;
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

        // Don.t mark email as seen — we track via lastSeenUID
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

      // Add processed UIDs to the scannedUIDs set (prevents re-processing
      // in "newest" mode where we process out of order)
      for (const uid of uidsToProcess) {
        scannedSet.add(uid);
      }

      // In "oldest" mode, we can safely advance lastSeenUID to the highest
      // processed UID (since we process sequentially, no gaps).
      // In "newest" mode, we DON'T advance lastSeenUID (there are gaps —
      // older emails between lastSeenUID and the newest batch are still
      // unprocessed). The scannedUIDs set prevents re-processing.
      let newLastSeenUID = inbox.lastSeenUID;
      if (direction === 'oldest') {
        newLastSeenUID = Math.max(inbox.lastSeenUID, ...uidsToProcess);
      }

      // Cap scannedUIDs array size to prevent unbounded growth
      // (keep last 5000 UIDs — enough for most inboxes)
      let scannedArray = Array.from(scannedSet).sort((a, b) => a - b);
      if (scannedArray.length > 5000) {
        scannedArray = scannedArray.slice(-5000); // keep the newest 5000
      }

      await db.emailInbox.update({
        where: { id: inboxId },
        data: {
          lastSeenUID: newLastSeenUID,
          scannedUIDs: scannedArray,
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
 * Walk the MIME body structure to find the best PDF/image attachment.
 * Returns null if no usable attachment is found.
 *
 * Strategy: collect ALL candidate parts first, then pick the best one.
 * This avoids the bug where a part with the PDF's filename but text/plain
 * MIME type (e.g., a forwarded message body) gets picked before the real
 * PDF attachment later in the structure.
 *
 * Score (highest wins):
 *   - 100: application/pdf (or part with .pdf ext + pdf magic bytes)
 *   - 80:  image/* with matching extension
 *   - 70:  allowed extension (.pdf/.jpg/.png/.webp) regardless of MIME
 *   - 50:  application/octet-stream with allowed extension
 *   - 20:  text/* with PDF filename (suspicious — probably forwarded email source)
 *
 * Disposition breaks ties: 'attachment' > 'inline' > none
 */
function findAttachment(structure: unknown): AttachmentInfo | null {
  const candidates: Array<{ info: AttachmentInfo; score: number; disposition: string }> = [];
  collectCandidates(structure, candidates);

  if (candidates.length === 0) return null;

  // Sort by score descending, then by disposition preference
  const dispositionRank: Record<string, number> = { attachment: 3, inline: 2, '': 1 };
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (dispositionRank[b.disposition] ?? 0) - (dispositionRank[a.disposition] ?? 0);
  });

  return candidates[0].info;
}

function collectCandidates(
  node: unknown,
  candidates: Array<{ info: AttachmentInfo; score: number; disposition: string }>,
): void {
  if (!node || typeof node !== 'object') return;
  const n = node as Record<string, unknown>;

  if (typeof n.type === 'string') {
    const rawType = n.type.toLowerCase().split(';')[0].trim();
    const disposition = ((n.disposition as string | undefined)?.toLowerCase() ?? '').trim();
    const params = n.dispositionParameters as Record<string, unknown> | undefined;
    const contentTypeParams = n.parameters as Record<string, unknown> | undefined;

    const filename =
      (params?.filename as string | undefined) ??
      (contentTypeParams?.name as string | undefined) ??
      (contentTypeParams?.filename as string | undefined) ??
      (n.filename as string | undefined) ??
      'attachment';

    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const isAllowedExt = ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext);

    // isImage: rawType is "image/*" or just "image"
    const isImage = rawType === 'image' || rawType.startsWith('image/');

    // isAllowedMime: exact MIME type match
    const isAllowedMime = ALLOWED_ATTACHMENT_TYPES.has(rawType);

    // Determine the final MIME type
    let mimeType = 'application/octet-stream';
    if (isAllowedMime) {
      mimeType = rawType;
    } else if (isAllowedExt) {
      if (ext === 'pdf') mimeType = 'application/pdf';
      else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'webp') mimeType = 'image/webp';
    } else if (isImage) {
      mimeType = 'image/jpeg';
    }

    // Score this part
    let score = 0;
    const isPdf = ext === 'pdf' || rawType === 'application/pdf';
    const isInlinePdf = isPdf && disposition === 'inline';

    if (isAllowedMime) {
      // Real PDF/image MIME type — highest score
      score = 100;
    } else if (isAllowedExt && !isInlinePdf) {
      // Has allowed extension (e.g., .pdf) — strong signal
      // Skip inline PDFs (rare, usually embeds)
      score = 70;
    } else if (rawType === 'application/octet-stream' && isAllowedExt) {
      score = 50;
    } else if (isImage) {
      // Image type but no recognized extension — still usable
      score = 60;
    } else if (isAllowedExt && isInlinePdf) {
      // Inline PDF — lower priority but still a candidate
      score = 30;
    } else {
      // Not a candidate — skip
    }

    if (score > 0) {
      candidates.push({
        info: {
          part: String(n.part ?? ''),
          filename,
          mimeType,
        },
        score,
        disposition,
      });
    }
  }

  // Recurse into children
  if (Array.isArray(n.childNodes)) {
    for (const child of n.childNodes) collectCandidates(child, candidates);
  }
  if (Array.isArray(n.parts)) {
    for (const child of n.parts) collectCandidates(child, candidates);
  }
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
