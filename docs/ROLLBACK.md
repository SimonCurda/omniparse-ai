# OmniParse AI — Rollback Playbook

This document describes the procedures for rolling back changes, restoring data,
and recovering from outages. Keep this updated as the system evolves.

**Last updated:** September 2026

---

## Quick Reference

| Scenario | Recovery time | Procedure |
|----------|--------------|-----------|
| Bad code deploy | 2-5 min | [Section 1](#1-bad-code-deploy) |
| Database corruption | 1-4 hours | [Section 2](#2-database-corruption--restore-from-backup) |
| Single user data corruption | 15-30 min | [Section 3](#3-single-user-data-corruption) |
| Complete Vercel outage | Wait for Vercel | [Section 4](#4-complete-vercel-outage) |
| Complete Supabase outage | Wait for Supabase | [Section 5](#5-complete-supabase-outage) |
| AI provider outage (all 4) | Wait for provider | [Section 6](#6-ai-provider-outage-all-4-providers) |
| Security incident | Variable | [Section 7](#7-security-incident-response) |

---

## 1. Bad Code Deploy

Vercel auto-deploys from `main` branch. If a commit breaks production, you have
~45 seconds between the merge and prod being live. Recovery is fast.

### Detection

- User reports broken feature
- Vercel deployment shows ERROR state instead of READY
- Monitor Vercel function logs manually (no Sentry yet)

### Recovery (3 methods, easiest first)

#### Method A: Vercel Dashboard (recommended)

1. Go to https://vercel.com/simoncurdas-projects/omniparse-ai/deployments
2. Find the last deployment that was working (READY state, older timestamp)
3. Click the ⋯ menu on that deployment
4. Select "Promote to Production"
5. Wait ~30 seconds for the promotion to complete
6. Verify at https://omniparse-ai.vercel.app

#### Method B: Vercel API

```bash
# Get the deployment ID of the last known-good deploy
VERCEL_TOKEN="your_vercel_token"
curl "https://api.vercel.com/v6/deployments?projectId=omniparse-ai&limit=5&target=production" \
  -H "Authorization: Bearer $VERCEL_TOKEN"

# Promote that deployment to production
curl -X POST "https://api.vercel.com/v13/deployments" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deploymentId": "dpl_LAST_KNOWN_GOOD_ID",
    "target": "production",
    "name": "omniparse-ai"
  }'
```

#### Method C: Git revert

```bash
cd omniparse-ai
git log --oneline -5  # find the bad commit
git revert <bad_commit_hash>
git push origin main
# Vercel auto-deploys the revert in ~45s
```

**Note:** Method C is slower than A/B because it requires a full rebuild, but
it leaves a clean commit history.

### Prevention

- Test changes locally before pushing: `npm run build && npm run start`
- Use a branch + PR for non-trivial changes (don't push directly to main)
- The CI/CD doesn't have automated tests yet — manual testing is required

---

## 2. Database Corruption / Restore from Backup

Supabase free tier does NOT include automatic backups. You must run
`scripts/backup-db.sh` periodically (recommended: weekly via cron).

### Detection

- API returns 500 errors on read operations
- Prisma throws "relation does not exist" or similar schema errors
- Queries return fewer rows than expected (silent data loss)
- Supabase dashboard shows database in "unhealthy" state

### Recovery from a local backup

```bash
# 1. Get the most recent backup file
ls -lh backups/

# 2. Set DATABASE_URL (get from Vercel env vars or Supabase dashboard)
export DATABASE_URL="postgresql://user:pass@db.xxxx.supabase.co:5432/postgres"

# 3. Decompress and restore
gunzip -c backups/omniparse-backup-YYYYMMDD-HHMMSS.sql.gz | psql "$DATABASE_URL"

# 4. Verify by counting rows in key tables
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"User\";"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"Invoice\";"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"PendingReview\";"
```

### Recovery if no backup exists

If you don't have a backup, your options are limited:

1. **Supabase dashboard** → Database → Backups (free tier: manual dumps only,
   Pro plan: 7 daily automatic backups)
2. **Accept data loss** — recreate schema from `prisma/schema.prisma` via
   `prisma migrate deploy`, notify users

### Prevention

- Run `scripts/backup-db.sh` weekly via cron
- Upload backups to offsite storage (Google Drive, private GitHub repo)
- Consider upgrading to Supabase Pro ($25/mo) for automatic daily backups + PITR

---

## 3. Single User Data Corruption

A single user's data is corrupted (e.g., a bad invoice record with null fields
that crashes the UI, or a pending review that won't approve).

### Recovery

1. Identify the corrupted record via Vercel function logs (look for the failing
   request URL containing the record ID)
2. Connect to Supabase via psql:
   ```bash
   psql "$DATABASE_URL"
   ```
3. Inspect the record:
   ```sql
   SELECT * FROM "Invoice" WHERE id = 'problematic_id';
   ```
4. Fix the data:
   ```sql
   -- Option A: delete the record
   DELETE FROM "Invoice" WHERE id = 'problematic_id';

   -- Option B: update specific fields
   UPDATE "Invoice" SET vendor = 'Unknown' WHERE id = 'problematic_id' AND vendor IS NULL;
   ```
5. Verify the user can now access their data

### Prevention

- Use Prisma's type system to prevent null where it shouldn't be (already done)
- Validate inputs at API layer (already done via Zod schemas)
- Add database constraints for critical fields (TODO)

---

## 4. Complete Vercel Outage

If Vercel itself is down, your app is unreachable. There's nothing to do but wait.

### Detection

- https://omniparse-ai.vercel.app returns 5xx or doesn't load
- Vercel status page (https://www.vercelstatus.com) shows incidents

### Communication

- Email affected users: "OmniParse AI is currently experiencing an outage
  due to our hosting provider (Vercel). We're monitoring the situation and
  will restore service as soon as Vercel resolves the issue."

### Recovery

- Wait for Vercel to resolve the incident
- After recovery, verify all features work end-to-end

### Prevention

- Consider a multi-region or multi-provider deployment for high-availability
  (not currently implemented; would require moving off Vercel)

---

## 5. Complete Supabase Outage

If Supabase (your Postgres + storage) is down, all data operations fail.

### Detection

- API returns 500 errors on all endpoints
- Supabase status page (https://status.supabase.com) shows incidents

### Communication

Same as Vercel outage — email affected users.

### Recovery

- Wait for Supabase to resolve
- After recovery, verify no data was lost (count rows in key tables)
- If data was lost, restore from most recent backup (see Section 2)

### Prevention

- Regular backups (Section 2)
- Consider a read replica or alternative DB for high-availability

---

## 6. AI Provider Outage (all 4 providers)

If Mistral, OpenRouter, Groq, and Google are all down simultaneously,
extraction fails with "All vision models are temporarily unavailable."

### Detection

- Users report "AI temporarily busy" errors
- Vercel function logs show `[gemini] Mistral ... failed`, then OpenRouter
  failures, then Groq failures, then Gemini failures

### Recovery

- Wait for at least one provider to come back online
- The cascade will automatically use whichever provider is available

### Communication

- Banner in dashboard: "AI features are temporarily unavailable due to
  upstream provider issues. We're monitoring and will restore as soon as
  possible."
- Email users who were mid-extraction: their pending items remain in the
  queue and can be retried once AI is back

### Prevention

- Already mitigated: 4-provider cascade means a single provider outage
  doesn't affect users
- For higher availability, add more providers (Together AI, Hugging Face
  Inference API) — see roadmap

---

## 7. Security Incident Response

### If you suspect a breach (data leak, account compromise, etc.)

1. **Immediate action (within 1 hour):**
   - Rotate all API keys (Groq, OpenRouter, Google Gemini, Mistral, Stripe,
     Resend, JWT_SECRET in Vercel env vars)
   - Force-logout all users by changing JWT_SECRET (everyone will need to
     log in again)
   - Check Vercel function logs for unusual activity (high request volume
     from single IP, etc.)

2. **Investigation (within 24 hours):**
   - Identify what data was accessed (check audit logs):
     ```sql
     SELECT * FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 100;
     ```
   - Identify affected users
   - Document the timeline

3. **Notification (within 72 hours — GDPR Art. 33 requirement):**
   - Notify affected users via email
   - Notify ÚOOÚ (Czech Data Protection Authority) if personal data was
     breached: https://www.uoou.cz
   - Email: posta@uoou.cz
   - Phone: +420 234 665 111

4. **Post-incident:**
   - Write a post-mortem documenting what happened, what was affected,
     what was done to fix it, what will be done to prevent recurrence
   - Update security measures
   - Communicate transparently with users

### GDPR breach notification requirements

Under GDPR Art. 33:
- Notify supervisory authority within 72 hours of becoming aware of the breach
- If breach poses high risk to individuals, also notify affected individuals
  without undue delay (Art. 34)

Failure to notify within 72 hours can result in fines up to €10M or 2% of
global turnover.

---

## Maintenance Windows

There are no scheduled maintenance windows currently. All deploys are
zero-downtime (Vercel handles the switchover automatically).

If a maintenance window becomes necessary:

1. Email users at least 7 days in advance
2. Choose off-peak hours (02:00-04:00 CET, Sunday)
3. Display a banner in the dashboard 24 hours before
4. Estimated downtime: <30 minutes

---

## Contact

- **Operator:** Simon Curda
- **Email:** damr58h@gmail.com
- **Supervisory authority:** ÚOOÚ (Czech Data Protection Authority)
  - Web: https://www.uoou.cz
  - Email: posta@uoou.cz
  - Phone: +420 234 665 111

---

## Backup Status

Check the `backups/` directory (gitignored) for recent backups. If you
haven't run `scripts/backup-db.sh` recently, do it now:

```bash
cd omniparse-ai
export DATABASE_URL="..."  # from Vercel env vars
./scripts/backup-db.sh
```

Recommended cadence: weekly (Sundays at 03:00 CET via cron).
