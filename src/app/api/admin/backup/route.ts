import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/backup?key=CRON_SECRET
//
// Manual database backup endpoint. Exports the full database (minus a few
// sensitive / oversized fields) as a downloadable JSON file.
//
// SECURITY: Protected by CRON_SECRET env var. Never expose without it.
//
// Excluded fields (intentionally NOT in the dump):
//   - User.password, User.googleId, User.githubId — auth secrets
//   - EmailInbox.encryptedPassword — IMAP credentials (AES blob)
//   - Invoice.fileData — base64 PDF blobs (can be huge; bloats the dump)
//   - PendingReview.attachmentData — base64 attachment blobs
//   - Invoice.rawExtraction — can be very large for complex invoices
//
// Everything else is included verbatim so the dump is a faithful snapshot
// of the database state at the time of the request.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET;

  if (!expectedKey) {
    return NextResponse.json(
      { error: 'CRON_SECRET env var is not set.' },
      { status: 500 },
    );
  }
  if (key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const iso = now.toISOString();

    // Fetch each table in parallel. Selections deliberately omit sensitive
    // fields and large binary blobs (see header comment).
    const [
      users,
      labels,
      entities,
      exportTemplates,
      customStatuses,
      invoices,
      invoiceLabels,
      approvalRules,
      customRules,
      auditLogs,
      chatSessions,
      chatMessages,
      emailInboxes,
      pendingReviews,
      emailBlocklist,
      adminDeletionLogs,
      aiProviderConfigs,
      stripeEvents,
      parseDebugLogs,
      modelHealthLogs,
      featureFlags,
    ] = await Promise.all([
      db.user.findMany({
        // Omit auth secrets — passwords and OAuth provider IDs.
        // fileData on invoices is excluded separately below.
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          stripePriceId: true,
          stripeCurrentPeriodEnd: true,
          settings: true,
          retentionDays: true,
          activeEntityId: true,
          termsAcceptedAt: true,
          ageConfirmedAt: true,
          withdrawalAcknowledgedAt: true,
          emailVerified: true,
          withdrawnAt: true,
          lastTosEmailSentAt: true,
          active: true,
          frozenReason: true,
          frozenAt: true,
          hidden: true,
          starred: true,
          debugEnabled: true,
          monthlyParseCount: true,
          parseCountResetAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.label.findMany(),
      db.entity.findMany(),
      db.exportTemplate.findMany(),
      db.customStatus.findMany(),
      db.invoice.findMany({
        // Omit fileData (base64 PDF, can be huge) and rawExtraction (large).
        select: {
          id: true,
          userId: true,
          entityId: true,
          filename: true,
          vendor: true,
          invNumber: true,
          invDate: true,
          dueDate: true,
          amount: true,
          vatAmount: true,
          total: true,
          currency: true,
          status: true,
          isDuplicate: true,
          confidence: true,
          fieldConfidence: true,
          lineItems: true,
          errorMessage: true,
          validationResults: true,
          validationStatus: true,
          normalizedVendor: true,
          normalizedInvDate: true,
          normalizedDueDate: true,
          normalizedAmount: true,
          normalizedTotal: true,
          normalizedCurrency: true,
          pdfMetadata: true,
          processingTime: true,
          customFields: true,
          fileType: true,
          fileDataExpiresAt: true,
          approvalStatus: true,
          approvalRuleId: true,
          approvedBy: true,
          approvedAt: true,
          approvalNote: true,
          lifecycleStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.invoiceLabel.findMany(),
      db.approvalRule.findMany(),
      db.customRule.findMany(),
      db.auditLog.findMany(),
      db.chatSession.findMany(),
      db.chatMessage.findMany(),
      db.emailInbox.findMany({
        // Omit encryptedPassword — IMAP credentials (AES blob).
        select: {
          id: true,
          userId: true,
          label: true,
          emailAddress: true,
          imapHost: true,
          imapPort: true,
          username: true,
          lastSeenUID: true,
          scannedUIDs: true,
          scanMode: true,
          trustedSenders: true,
          active: true,
          lastScannedAt: true,
          lastScanError: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.pendingReview.findMany({
        // Omit attachmentData (base64 attachment blob).
        select: {
          id: true,
          userId: true,
          inboxId: true,
          fromAddress: true,
          fromName: true,
          subject: true,
          receivedAt: true,
          attachmentFilename: true,
          attachmentMime: true,
          classification: true,
          extractedData: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.emailBlocklist.findMany(),
      db.adminDeletionLog.findMany(),
      db.aiProviderConfig.findMany(),
      db.stripeEvent.findMany(),
      db.parseDebugLog.findMany(),
      db.modelHealthLog.findMany(),
      db.featureFlag.findMany(),
    ]);

    const dump = {
      _meta: {
        exportedAt: iso,
        exporter: 'admin-manual-backup',
        schema: 'omniparse-ai',
        counts: {
          users: users.length,
          labels: labels.length,
          entities: entities.length,
          exportTemplates: exportTemplates.length,
          customStatuses: customStatuses.length,
          invoices: invoices.length,
          invoiceLabels: invoiceLabels.length,
          approvalRules: approvalRules.length,
          customRules: customRules.length,
          auditLogs: auditLogs.length,
          chatSessions: chatSessions.length,
          chatMessages: chatMessages.length,
          emailInboxes: emailInboxes.length,
          pendingReviews: pendingReviews.length,
          emailBlocklist: emailBlocklist.length,
          adminDeletionLogs: adminDeletionLogs.length,
          aiProviderConfigs: aiProviderConfigs.length,
          stripeEvents: stripeEvents.length,
          parseDebugLogs: parseDebugLogs.length,
          modelHealthLogs: modelHealthLogs.length,
          featureFlags: featureFlags.length,
        },
      },
      users,
      labels,
      entities,
      exportTemplates,
      customStatuses,
      invoices,
      invoiceLabels,
      approvalRules,
      customRules,
      auditLogs,
      chatSessions,
      chatMessages,
      emailInboxes,
      pendingReviews,
      emailBlocklist,
      adminDeletionLogs,
      aiProviderConfigs,
      stripeEvents,
      parseDebugLogs,
      modelHealthLogs,
      featureFlags,
    };

    const body = JSON.stringify(dump, null, 2);
    const filename = `omniparse-backup-${now.toISOString().replace(/[:.]/g, '-')}.json`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    console.error('[admin/backup] Error:', err);
    return NextResponse.json(
      { error: 'Failed to generate backup', details: String(err) },
      { status: 500 },
    );
  }
}
