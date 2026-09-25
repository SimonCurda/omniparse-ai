-- OmniParse v3.2 Legal Compliance Migration
-- Generated: September 18, 2026
-- Purpose: Add 3 new columns to User table for EU compliance requirements
--
-- Columns added:
--   withdrawalAcknowledgedAt — Czech CC §1837(j) / Dir 2011/83/EU Art. 16(m)
--                              (user acknowledged losing 14-day withdrawal right at signup)
--   withdrawnAt              — Directive (EU) 2023/2673 (one-click withdrawal button)
--                              (user exercised withdrawal via Settings)
--   lastTosEmailSentAt       — GDPR Art. 12 + Czech CC §1752
--                              (user was notified of material ToS change)
--
-- All columns are nullable — no data loss, no backfill needed.
-- Existing users will have NULL values; only new users / future actions populate them.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastTosEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "withdrawalAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);
