import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ⚠️ TEMPORARY MIGRATION ENDPOINT — DELETE AFTER USE
//
// This endpoint runs raw SQL to create the email capture tables
// (EmailInbox, PendingReview, EmailBlocklist) that the new feature needs.
//
// Usage: GET /api/migrate-email-tables?key=YOUR_JWT_SECRET
// After success, delete this file and redeploy.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  const expectedKey = process.env.JWT_SECRET;

  if (!expectedKey) {
    return NextResponse.json({ error: 'JWT_SECRET not set' }, { status: 500 });
  }
  if (key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Array<{ table: string; status: string }> = [];

  try {
    // Create EmailInbox table
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "EmailInbox" (
        id                  TEXT NOT NULL,
        "userId"            TEXT NOT NULL,
        label               TEXT NOT NULL,
        "emailAddress"      TEXT NOT NULL,
        "imapHost"          TEXT NOT NULL,
        "imapPort"          INTEGER NOT NULL DEFAULT 993,
        username            TEXT NOT NULL,
        "encryptedPassword" TEXT NOT NULL,
        "lastSeenUID"        INTEGER NOT NULL DEFAULT 0,
        "scanMode"          TEXT NOT NULL DEFAULT 'manual',
        "trustedSenders"    JSONB,
        active              BOOLEAN NOT NULL DEFAULT true,
        "lastScannedAt"     TIMESTAMP(3),
        "lastScanError"     TEXT,
        "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"          TIMESTAMP(3) NOT NULL,
        CONSTRAINT "EmailInbox_pkey" PRIMARY KEY (id)
      );
    `;
    results.push({ table: 'EmailInbox', status: 'created' });

    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "EmailInbox_userId_idx" ON "EmailInbox"("userId");`;
    results.push({ table: 'EmailInbox_userId_idx', status: 'created' });

    // Create PendingReview table
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "PendingReview" (
        id                  TEXT NOT NULL,
        "userId"            TEXT NOT NULL,
        "inboxId"           TEXT NOT NULL,
        "fromAddress"       TEXT NOT NULL,
        "fromName"          TEXT,
        subject             TEXT NOT NULL,
        "receivedAt"        TIMESTAMP(3) NOT NULL,
        "attachmentFilename" TEXT NOT NULL,
        "attachmentMime"    TEXT NOT NULL,
        "attachmentData"    TEXT NOT NULL,
        classification      TEXT NOT NULL,
        "extractedData"     JSONB,
        status              TEXT NOT NULL DEFAULT 'pending',
        "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"         TIMESTAMP(3) NOT NULL,
        CONSTRAINT "PendingReview_pkey" PRIMARY KEY (id)
      );
    `;
    results.push({ table: 'PendingReview', status: 'created' });

    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "PendingReview_userId_idx" ON "PendingReview"("userId");`;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "PendingReview_inboxId_idx" ON "PendingReview"("inboxId");`;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "PendingReview_status_idx" ON "PendingReview"("status");`;
    results.push({ table: 'PendingReview_indexes', status: 'created' });

    // Add foreign key constraints (separate so they don't fail if already exist)
    try {
      await db.$executeRaw`
        ALTER TABLE "PendingReview"
        ADD CONSTRAINT "PendingReview_inboxId_fkey"
        FOREIGN KEY ("inboxId") REFERENCES "EmailInbox"(id) ON DELETE CASCADE;
      `;
      results.push({ table: 'PendingReview_inbox_fk', status: 'created' });
    } catch {
      results.push({ table: 'PendingReview_inbox_fk', status: 'already_exists' });
    }

    try {
      await db.$executeRaw`
        ALTER TABLE "PendingReview"
        ADD CONSTRAINT "PendingReview_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
      `;
      results.push({ table: 'PendingReview_user_fk', status: 'created' });
    } catch {
      results.push({ table: 'PendingReview_user_fk', status: 'already_exists' });
    }

    try {
      await db.$executeRaw`
        ALTER TABLE "EmailInbox"
        ADD CONSTRAINT "EmailInbox_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
      `;
      results.push({ table: 'EmailInbox_user_fk', status: 'created' });
    } catch {
      results.push({ table: 'EmailInbox_user_fk', status: 'already_exists' });
    }

    // Create EmailBlocklist table
    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "EmailBlocklist" (
        id          TEXT NOT NULL,
        "userId"    TEXT NOT NULL,
        address     TEXT NOT NULL,
        reason      TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "EmailBlocklist_pkey" PRIMARY KEY (id),
        CONSTRAINT "EmailBlocklist_userId_address_key" UNIQUE ("userId", address)
      );
    `;
    results.push({ table: 'EmailBlocklist', status: 'created' });

    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "EmailBlocklist_userId_idx" ON "EmailBlocklist"("userId");`;
    results.push({ table: 'EmailBlocklist_userId_idx', status: 'created' });

    try {
      await db.$executeRaw`
        ALTER TABLE "EmailBlocklist"
        ADD CONSTRAINT "EmailBlocklist_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
      `;
      results.push({ table: 'EmailBlocklist_user_fk', status: 'created' });
    } catch {
      results.push({ table: 'EmailBlocklist_user_fk', status: 'already_exists' });
    }

    return NextResponse.json({
      success: true,
      message: 'Email capture tables created successfully. DELETE this file and redeploy.',
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: message, partialResults: results },
      { status: 500 },
    );
  }
}
