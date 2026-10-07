-- AlterTable: add apiKey column to User
--
-- REST API key for programmatic access. Nullable because existing users
-- won't have one until they generate it from Settings → API Access.
-- Unique constraint prevents two users from sharing the same key.
ALTER TABLE "User" ADD COLUMN "apiKey" TEXT;
CREATE UNIQUE INDEX "User_apiKey_key" ON "User"("apiKey") WHERE "apiKey" IS NOT NULL;
