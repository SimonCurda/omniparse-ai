import { db } from '@/lib/db';

// Builds a serializable JSON snapshot of every table in the database.
// Shared by:
//   - GET /api/admin/backup        (downloads the dump as a .json file)
//   - POST /api/admin/backup/github (pushes the dump to a GitHub repo)
//
// Sensitive and oversized fields are deliberately omitted — see the
// comments inline. The dump is a faithful snapshot of *structural* state,
// not a binary blob repository.
//
// Returns `{ dump, filename, iso }` so callers can either stream the body
// to the client (download) or POST it to the GitHub Contents API (push).

export interface BackupDump {
  dump: unknown;
  filename: string;
  iso: string;
  body: string;
  bytes: number;
}

export async function buildBackupDump(): Promise<BackupDump> {
  const now = new Date();
  const iso = now.toISOString();

  // Fetch each table in parallel. Selections deliberately omit sensitive
  // fields and large binary blobs (see comment block above each select).
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
    adminLinks,
  ] = await Promise.all([
    db.user.findMany({
      // Omit auth secrets — passwords and OAuth provider IDs.
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
    // AdminLink — user-added shortcuts in the admin Links tab.
    // No sensitive data; included verbatim.
    db.adminLink.findMany(),
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
        adminLinks: adminLinks.length,
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
    adminLinks,
  };

  const body = JSON.stringify(dump, null, 2);
  const filename = `omniparse-backup-${now.toISOString().replace(/[:.]/g, '-')}.json`;

  return {
    dump,
    filename,
    iso,
    body,
    bytes: Buffer.byteLength(body, 'utf8'),
  };
}

// Push a JSON dump to the configured GitHub repo via the Contents API.
// Uses three env vars:
//   GITHUB_BACKUP_TOKEN  — personal access token (classic or fine-grained)
//                          with `repo:contents:write` scope on the target repo
//   GITHUB_BACKUP_OWNER  — repo owner (user or org login)
//   GITHUB_BACKUP_REPO   — repo name
//
// The dump is written to `backups/<filename>` and also overwrites
// `backups/latest.json` so consumers can fetch a stable URL.
//
// Returns `{ ok: true, url }` on success or `{ ok: false, error }` on failure.
export async function pushBackupToGitHub(
  backup: BackupDump,
): Promise<{ ok: true; url: string; latestUrl: string } | { ok: false; error: string }> {
  const token = process.env.GITHUB_BACKUP_TOKEN;
  const owner = process.env.GITHUB_BACKUP_OWNER;
  const repo = process.env.GITHUB_BACKUP_REPO;

  if (!token || !owner || !repo) {
    return {
      ok: false,
      error:
        'GitHub backup env vars not set. Configure GITHUB_BACKUP_TOKEN, GITHUB_BACKUP_OWNER, and GITHUB_BACKUP_REPO.',
    };
  }

  // Base64-encode the JSON body for the GitHub Contents API.
  // The API expects the `content` field to be base64-encoded UTF-8.
  const contentBase64 = Buffer.from(backup.body, 'utf8').toString('base64');

  // The Contents API requires us to PUT to:
  //   https://api.github.com/repos/{owner}/{repo}/contents/{path}
  // For a file that doesn't exist yet, omit `sha`. For `latest.json` we
  // need to GET first to find the existing blob's SHA, then PUT to overwrite.
  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/backups`;

  // 1. Push the timestamped file (new file every time — no SHA needed).
  const timestampedRes = await fetch(`${apiBase}/${encodeURIComponent(backup.filename)}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'omniparse-ai-backup',
    },
    body: JSON.stringify({
      message: `chore(backup): ${backup.filename}`,
      content: contentBase64,
    }),
  });

  if (!timestampedRes.ok) {
    const errText = await timestampedRes.text();
    let errorDetail = errText.slice(0, 500);
    try {
      const errJson = JSON.parse(errText);
      errorDetail = errJson.message || errJson.error || errorDetail;
    } catch {
      // response wasn't JSON — use the raw text
    }
    return {
      ok: false,
      error: `GitHub API rejected backup (HTTP ${timestampedRes.status}): ${errorDetail}`,
    };
  }

  const timestampedJson = (await timestampedRes.json()) as { content?: { html_url?: string } };
  const url = timestampedJson.content?.html_url || `https://github.com/${owner}/${repo}/blob/main/backups/${backup.filename}`;

  // 2. Overwrite `latest.json` so consumers can fetch a stable URL.
  //    GET first to find the existing file's SHA (required for overwrite).
  let latestSha: string | undefined;
  try {
    const latestGet = await fetch(`${apiBase}/latest.json`, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'omniparse-ai-backup',
      },
    });
    if (latestGet.ok) {
      const latestJson = (await latestGet.json()) as { sha?: string };
      latestSha = latestJson.sha;
    }
    // 404 = file doesn't exist yet — leave latestSha undefined.
  } catch {
    // Network blip — proceed without SHA; the PUT will fail loudly if needed.
  }

  const latestRes = await fetch(`${apiBase}/latest.json`, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'omniparse-ai-backup',
    },
    body: JSON.stringify({
      message: 'chore(backup): latest.json',
      content: contentBase64,
      sha: latestSha,
    }),
  });

  if (!latestRes.ok) {
    // The timestamped file already succeeded — latest.json failure is non-fatal.
    // Log the error for debugging but don't fail the whole operation.
    const errText = await latestRes.text();
    console.warn('[admin-backup] latest.json overwrite failed (non-fatal):', latestRes.status, errText.slice(0, 300));
    return {
      ok: true,
      url,
      latestUrl: `https://github.com/${owner}/${repo}/blob/main/backups/latest.json`,
    };
  }

  const latestJson = (await latestRes.json()) as { content?: { html_url?: string } };
  const latestUrl = latestJson.content?.html_url || `https://github.com/${owner}/${repo}/blob/main/backups/latest.json`;

  return { ok: true, url, latestUrl };
}
