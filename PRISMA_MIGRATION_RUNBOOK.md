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

---

## v3.2 Migration — Required Before Deploy (September 18, 2026)

The legal deep-dive added three new columns to the `User` model:

- `withdrawalAcknowledgedAt DateTime?` — set at signup when user acknowledges losing the 14-day EU withdrawal right (Czech CC §1837(j), Dir 2011/83/EU Art. 16(m))
- `withdrawnAt DateTime?` — set when user exercises the one-click withdrawal button (Directive (EU) 2023/2673, effective 19 June 2026)
- `lastTosEmailSentAt DateTime?` — set when user is emailed about a material ToS change (GDPR Art. 12, Czech CC §1752)

### Steps

Same process as above (`bunx prisma generate && bunx prisma db push`), then verify:

```sql
SELECT email, "termsAcceptedAt", "ageConfirmedAt", "withdrawalAcknowledgedAt", "withdrawnAt", "lastTosEmailSentAt"
FROM "User" ORDER BY "createdAt" DESC LIMIT 5;
```

### Smoke tests after deploy

1. **Signup** — Create a fresh account; verify all three checkboxes (Terms, Age, Withdrawal) are required to submit, and that `withdrawalAcknowledgedAt` is populated for the new user.
2. **Withdrawal button** — In Settings → Data & Privacy, the "Withdraw from Service (EU Consumers)" button should open a confirmation dialog. Clicking "Confirm Withdrawal" hits `/api/auth/withdraw` and sets `withdrawnAt`.
3. **Cookie banner** — Visit the site in an incognito window; verify the "Manage preferences" button opens per-category toggles. Also verify the new "Cookie Settings" link in the footer re-opens the banner.
4. **ToS change email** (optional, requires `RESEND_API_KEY` set) — Call the new cron endpoint:
   ```bash
   curl -X POST https://omniparse-ai.vercel.app/api/cron/notify-tos-change \
     -H "Authorization: Bearer $CRON_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"lastUpdated":"September 18, 2026","effectiveDate":"October 18, 2026","summary":"v3.2 legal deep-dive — added Force Majeure, Notices, withdrawal button, granular cookie consent, AI literacy statement."}'
   ```
   Should return `{"notifiedCount": N, "failureCount": 0, ...}` and update `lastTosEmailSentAt` for each notified user.
