-- ─── Migration: add documentLanguage field to Invoice ──────────────────────
--
-- Adds a nullable `documentLanguage` column to the Invoice table. The column
-- stores the ISO 639-1 language code detected by the AI at parse time
-- (e.g. 'cs', 'en', 'de', 'pl', 'sk', 'hu').
--
-- Existing invoices get NULL (treated as 'unknown' by the UI). No data
-- migration is needed because the field is purely informational at this
-- stage.
--
-- Run: bunx prisma db push (or bunx prisma migrate deploy)

ALTER TABLE "Invoice" ADD COLUMN "documentLanguage" TEXT;
