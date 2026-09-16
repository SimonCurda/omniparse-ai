# Prisma Migration Runbook — Required Before Deploy

## Why this is needed

The audit found that the production Supabase database is out of sync with the Prisma schema. Specifically, the `Invoice.fileDataExpiresAt` column is missing, causing the `/api/cron/purge-files` endpoint to fail with:

```
The column `Invoice.fileDataExpiresAt` does not exist in the current database.
```

The latest fixes (Task ID D) also add two new fields to the `User` model:
- `termsAcceptedAt DateTime?`
- `ageConfirmedAt DateTime?`

These MUST be migrated to the production database before the new code deploys, otherwise:
1. `/api/parse` (invoice upload) will crash on the DB write
2. `/api/auth/register` (signup with Terms checkbox) will crash on the DB write
3. The cron job keeps failing

## Steps to run the migration

Run this from your local machine (you need `bun` installed):

```bash
# 1. Pull the latest code (after the audit fixes are merged)
git clone https://github.com/SimonCurda/omniparse-ai.git
cd omniparse-ai
git pull origin main
bun install

# 2. Set DATABASE_URL to your Supabase connection string
# Get this from: Supabase Dashboard → Project Settings → Database → Connection string → URI
# It looks like: postgresql://postgres.<ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
export DATABASE_URL="postgresql://postgres.<your-ref>:<your-password>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

# 3. Generate the Prisma client (picks up the new schema)
bunx prisma generate

# 4. Push the schema to Supabase (applies the missing columns)
# Use --accept-data-loss because the columns are nullable (no data loss actually happens)
bunx prisma db push

# 5. Verify the migration worked
bunx prisma db pull   # reads the DB schema back to confirm
# Open prisma/schema.prisma and confirm it matches what you pushed
```

## After the migration

1. Trigger a Vercel redeploy (Deployments → latest → "..." → Redeploy)
2. Verify the cron endpoint works:
   ```bash
   curl -X POST https://omniparse-ai.vercel.app/api/cron/purge-files \
     -H "Authorization: Bearer <your-new-CRON_SECRET>"
   ```
   Should return: `{"purged":0,"message":"No expired file data found"}`
3. Verify signup works:
   - Sign up a fresh test account with the new Terms checkbox
   - Check that `termsAcceptedAt` and `ageConfirmedAt` are populated in the User table (via Supabase SQL editor):
     ```sql
     SELECT email, "termsAcceptedAt", "ageConfirmedAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 5;
     ```

## If `prisma db push` fails

The most common failure is "drift detected" — Prisma notices the DB has objects not in the schema (e.g. extensions, indexes added by Supabase). In that case:

1. **Reset to match schema:** `bunx prisma db push --force-reset` (⚠️ destructive — wipes ALL data, including the audit test accounts and your own account. Don't do this on production.)
2. **Better approach:** Use `bunx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma --script` to generate a SQL migration. Run it manually in Supabase SQL editor. This preserves existing data.

If you're unsure, contact me (the AI that wrote this runbook) and paste the exact error.
