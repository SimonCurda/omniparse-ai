import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// DELETE /api/admin/accounts/[id]?key=CRON_SECRET
//
// Permanently deletes an account and all associated data.
// This is a hard delete with cascade — all invoices, chat sessions,
// email inboxes, pending reviews, audit logs, etc. are deleted.
//
// USE WITH CAUTION. This action is irreversible.
// Prefer freezing accounts first (preserves data for audit).

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET;

  if (!expectedKey || key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true,
        _count: {
          select: {
            invoices: true, chatSessions: true, emailInboxes: true,
            pendingReviews: true, auditLogs: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Log the deletion before cascade (since the audit log will also be deleted)
    console.warn(`[admin/delete] Deleting account ${user.email} (ID: ${user.id}) — ${user._count.invoices} invoices, ${user._count.chatSessions} chat sessions, ${user._count.emailInboxes} email inboxes`);

    // Hard delete with cascade
    await db.user.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Account ${user.email} permanently deleted with all associated data (${user._count.invoices} invoices, ${user._count.chatSessions} chat sessions, ${user._count.emailInboxes} email inboxes).`,
      deleted: {
        email: user.email,
        invoices: user._count.invoices,
        chatSessions: user._count.chatSessions,
        emailInboxes: user._count.emailInboxes,
        pendingReviews: user._count.pendingReviews,
        auditLogs: user._count.auditLogs,
      },
    });
  } catch (err) {
    console.error('[admin/delete] Error:', err);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
