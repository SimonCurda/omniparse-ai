#!/usr/bin/env bash
#
# OmniParse AI — Database Backup Script
#
# Connects to your Supabase Postgres database via the DATABASE_URL env var,
# runs pg_dump, compresses the output, and stores the backup file locally
# + optionally uploads to a GitHub release for offsite backup.
#
# USAGE:
#   1. Set DATABASE_URL in your environment (same value as Vercel env var)
#   2. Run: ./scripts/backup-db.sh
#
# AUTOMATION (recommended):
#   - Set up a weekly cron on your local machine (or any always-on server):
#     0 3 * * 0 /path/to/omniparse-ai/scripts/backup-db.sh
#   - Or use cron-job.org to hit the script weekly
#
# OFFSITE BACKUP (optional):
#   - The script creates a backup file in /backups/
#   - For offsite backup, manually upload to a private GitHub repo, Google
#     Drive, Dropbox, etc.
#   - Or use rclone: https://rclone.org (free, supports many backends)
#
# PREREQUISITES:
#   - PostgreSQL client tools installed (pg_dump). On macOS: brew install postgresql.
#     On Ubuntu: sudo apt install postgresql-client.
#   - DATABASE_URL env var set (copy from Vercel project settings → env vars)
#
# RETENTION:
#   - Backups older than 30 days are auto-deleted (configurable below)
#   - If you need longer retention, adjust RETENTION_DAYS

set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────
RETENTION_DAYS=30
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/omniparse-backup-${TIMESTAMP}.sql.gz"

# ─── Validate DATABASE_URL ─────────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set."
  echo ""
  echo "Get it from Vercel project settings → Environment Variables → DATABASE_URL"
  echo "(the same value the production app uses)"
  exit 1
fi

# ─── Check pg_dump is available ────────────────────────────────────────
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "❌ ERROR: pg_dump not found."
  echo ""
  echo "Install PostgreSQL client tools:"
  echo "  macOS:  brew install postgresql"
  echo "  Ubuntu: sudo apt install postgresql-client"
  exit 1
fi

# ─── Create backup directory ──────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting OmniParse database backup..."
echo "   Destination: $BACKUP_FILE"
echo ""

# ─── Run pg_dump ──────────────────────────────────────────────────────
# --no-owner: skip ownership commands (makes restore easier on different DBs)
# --no-privileges: skip GRANT/REVOKE (same reason)
# --clean: include DROP statements (so restore overwrites existing tables)
# --if-exists: use IF EXISTS in DROPs (no errors if table doesn't exist)
# Piped through gzip for compression — typical 50MB DB compresses to ~5MB
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --format=plain \
  | gzip -9 > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# ─── Cleanup old backups ───────────────────────────────────────────────
DELETED_COUNT=$(find "$BACKUP_DIR" -name "omniparse-backup-*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [ "$DELETED_COUNT" -gt 0 ]; then
  echo "🧹 Deleted $DELETED_COUNT backup(s) older than $RETENTION_DAYS days"
fi

# ─── Show all backups ──────────────────────────────────────────────────
echo ""
echo "📦 All backups in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR"/omniparse-backup-*.sql.gz 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}' || echo "   (none)"

echo ""
echo "💡 To restore a backup:"
echo "   gunzip -c $BACKUP_FILE | psql \$DATABASE_URL"
echo ""
echo "💡 For offsite backup, manually upload to:"
echo "   - A private GitHub repo (GitHub Releases supports large files)"
echo "   - Google Drive / Dropbox / OneDrive"
echo "   - AWS S3 / Cloudflare R2 (use rclone: https://rclone.org)"
