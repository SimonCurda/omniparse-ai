import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';

// POST /api/pending-review/bulk — bulk action on multiple pending items
//
// Body:
//   { action: 'approve' | 'skip' | 'block', ids: string[], addToTrustedSenders?: boolean }
//
// For 'approve', each item is processed sequentially (calls /api/parse internally
// for each one). This can be slow for large batches — we cap at 25 per call.
export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, ids, addToTrustedSenders = false } = body;

  if (!action || !['approve', 'skip', 'block'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action. Must be approve, skip, or block.' }, { status: 400 });
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
  }
  if (ids.length > 25) {
    return NextResponse.json({ error: 'Maximum 25 items per bulk action' }, { status: 400 });
  }

  // Verify all items belong to the user
  const items = await db.pendingReview.findMany({
    where: { id: { in: ids }, userId: auth.userId, status: 'pending' },
    select: {
      id: true, inboxId: true, fromAddress: true, fromName: true, subject: true,
      receivedAt: true, attachmentFilename: true, attachmentMime: true,
      attachmentData: true, classification: true,
    },
  });

  if (items.length === 0) {
    return NextResponse.json({ error: 'No matching pending items found' }, { status: 404 });
  }

  const results = {
    approved: 0,
    skipped: 0,
    blocked: 0,
    errors: [] as Array<{ id: string; error: string }>,
  };

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  const origin = req.headers.get('origin');
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const baseUrl = origin || (host ? `${protocol}://${host}` : 'http://localhost:3000');

  for (const item of items) {
    try {
      if (action === 'skip') {
        await db.pendingReview.update({
          where: { id: item.id },
          data: { status: 'skipped', attachmentData: '' },
        });
        results.skipped++;
      } else if (action === 'block') {
        // Add sender to blocklist
        if (item.fromAddress) {
          await db.emailBlocklist.upsert({
            where: { userId_address: { userId: auth.userId, address: item.fromAddress.toLowerCase() } },
            update: {},
            create: { userId: auth.userId, address: item.fromAddress.toLowerCase() },
          });
        }
        await db.pendingReview.update({
          where: { id: item.id },
          data: { status: 'blocked', attachmentData: '' },
        });
        results.blocked++;
      } else if (action === 'approve') {
        // Run the full extraction by calling /api/parse internally
        const fileBuffer = Buffer.from(item.attachmentData, 'base64');
        const formData = new FormData();
        const blob = new Blob([fileBuffer], { type: item.attachmentMime });
        formData.append('file', blob, item.attachmentFilename);

        const parseResponse = await fetch(`${baseUrl}/api/parse`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cookie': req.headers.get('cookie') || '',
          },
          body: formData,
        });

        if (parseResponse.ok) {
          const parseResult = await parseResponse.json();
          await db.pendingReview.update({
            where: { id: item.id },
            data: {
              status: 'approved',
              attachmentData: '',
              extractedData: parseResult,
            },
          });

          // Optionally add to trusted senders
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
                  data: { trustedSenders: [...existing, item.fromAddress.toLowerCase()] },
                });
              }
            }
          }

          results.approved++;
        } else {
          const errData = await parseResponse.json().catch(() => ({}));
          results.errors.push({ id: item.id, error: errData.error || 'Extraction failed' });
        }
      }
    } catch (err) {
      results.errors.push({ id: item.id, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return NextResponse.json({ success: true, results });
}
