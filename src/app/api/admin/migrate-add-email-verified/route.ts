import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/admin/migrate-add-email-verified?key=CRON_SECRET
//
// One-time migration: adds the `emailVerified` column to the User table.
// Idempotent — safe to call multiple times.
//
// Existing users get emailVerified = NULL (treated as "grandfathered" — see
// isEmailVerified() in src/lib/auth.ts). New users start with NULL and must
// click the verification link in their email.
//
// This endpoint exists because:
// 1. We can't run `prisma migrate deploy` from the Vercel build environment
//    (no shell access in serverless functions)
// 2. Supabase connection string is in DATABASE_URL env var which is only
//    available at runtime, not build time
// 3. We want to apply the migration without taking the app offline
//
// SECURITY: This endpoint checks CRON_SECRET to prevent randoms from triggering it.

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET;

  if (!expectedKey) {
    return NextResponse.json(
      { error: 'CRON_SECRET env var is not set. Set it in Vercel project settings.' },
      { status: 500 },
    );
  }
  if (key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if column already exists (Postgres metadata query)
    const columnCheck = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'User'
        AND column_name = 'emailVerified'
    `;

    if (columnCheck.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'emailVerified column already exists. No action needed.',
        alreadyExists: true,
      });
    }

    // Add the column. NULL by default — existing users are grandfathered.
    await db.$executeRaw`
      ALTER TABLE "User"
      ADD COLUMN "emailVerified" TIMESTAMP(3) NULL
    `;

    return NextResponse.json({
      success: true,
      message: 'emailVerified column added to User table. Existing users are grandfathered. New users will need to verify their email.',
      alreadyExists: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown migration error';
    console.error('[migration] add-email-verified failed:', message);
    return NextResponse.json(
      { error: 'Migration failed', detail: message },
      { status: 500 },
    );
  }
}
