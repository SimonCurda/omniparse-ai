-- AlterTable: add currency and vendor columns to ApprovalRule
-- Both nullable — existing rules will have null (match any currency/vendor)
ALTER TABLE "ApprovalRule" ADD COLUMN "currency" TEXT;
ALTER TABLE "ApprovalRule" ADD COLUMN "vendor" TEXT;
