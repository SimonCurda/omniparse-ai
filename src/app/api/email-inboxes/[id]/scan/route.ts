import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { scanInbox } from '@/lib/email-scanner';

// POST /api/email-inboxes/[id]/scan — manually scan an inbox for new invoices
//
// Vercel Hobby tier caps function duration at 60s. We set maxDuration = 60
// and the scanner internally stops at ~50s to leave buffer for response.
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const inbox = await db.emailInbox.findFirst({ where: { id, userId: auth.userId } });
  if (!inbox) {
    return NextResponse.json({ error: 'Inbox not found' }, { status: 404 });
  }
  if (!inbox.active) {
    return NextResponse.json({ error: 'Inbox is paused. Activate it in Settings first.' }, { status: 400 });
  }

  const result = await scanInbox(id, auth.userId, { maxDurationMs: 50_000 });

  return NextResponse.json(result);
}
