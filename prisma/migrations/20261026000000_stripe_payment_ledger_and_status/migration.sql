-- ─────────────────────────────────────────────────────────────────────────────
-- Stripe Payment Ledger + Subscription Status
--
-- Additive, non-breaking migration that gives the webhook handler a place to
-- record the outcome of every Stripe invoice event (paid / failed / refunded)
-- and persists the live subscription status on the User.
--
-- WHY THIS EXISTS
-- ==============
-- 1. EU VAT / OSS reporting — the seller (OmniParse, Czech-established) must
--    file quarterly OSS returns once EU cross-border B2C digital revenue
--    exceeds €10k/yr. Stripe Tax *calculates* the VAT, but the actual filing
--    is a manual obligation; this table is the source-of-truth ledger that the
--    /api/export/oss CSV is generated from.
-- 2. Chargeback defense — a row here is forensic evidence that a payment was
--    collected via a verified Stripe webhook (signed + idempotent).
-- 3. Dunning dedupe — `invoice.payment_failed` fires on every Stripe retry.
--    Without a ledger row keyed on the Stripe invoice ID, we'd email the user
--    on every retry. The UNIQUE constraint on stripeInvoiceId makes the second
--    insert a no-op (Prisma P2002).
-- 4. Refund tracking — `charge.refunded` updates the row to 'refunded' so the
--    OSS return for the original sale period can be amended.
--
-- IDEMPOTENCY
-- ===========
-- stripeInvoiceId is UNIQUE. The webhook uses create + catch(P2002) so that
-- Stripe's guaranteed at-least-once delivery is a safe no-op on replay.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Persist the live Stripe subscription status on the User.
--    Values mirror Stripe's subscription.status: 'incomplete' | 'incomplete_expired'
--    | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused'.
--    Null for free / never-subscribed users. NOT derivable from the price ID —
--    the UI uses this to surface "Past due — update your card" badges and to
--    run grace-period downgrade logic (past_due for >N days → free).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeStatus" TEXT;

-- 2. Payment ledger — one row per Stripe invoice outcome.
CREATE TABLE "PaymentRecord" (
    "id"                    TEXT             NOT NULL,
    "userId"                TEXT             NOT NULL,
    -- Stripe identifiers (for reconciliation + Portal deeplinks)
    "stripeInvoiceId"       TEXT             NOT NULL,
    "stripeCustomerId"      TEXT,
    "stripeSubscriptionId"  TEXT,
    "stripeChargeId"        TEXT,
    -- Amounts in minor units (cents). Stripe stores everything in minor units.
    "amountTotal"           INTEGER          NOT NULL,
    "currency"              TEXT             NOT NULL,
    "amountPaid"            INTEGER          NOT NULL DEFAULT 0,
    "tax"                   INTEGER          NOT NULL DEFAULT 0,
    -- Derived at webhook time from the line-item price ID via the price map.
    -- 'monthly' | 'annual' | 'one_time' (for proration-only or one-off charges).
    "interval"              TEXT,
    "plan"                  TEXT,
    -- Lifecycle of this invoice's payment: 'paid' | 'failed' | 'refunded' | 'partial_refund'
    "status"                TEXT             NOT NULL DEFAULT 'paid',
    -- Stripe-hosted artefacts (VAT-compliant receipt + downloadable PDF)
    "invoicePdfUrl"         TEXT,
    "hostedInvoiceUrl"      TEXT,
    "paidAt"                TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"             TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- One row per Stripe invoice — idempotent on webhook replay.
CREATE UNIQUE INDEX "PaymentRecord_stripeInvoiceId_key" ON "PaymentRecord"("stripeInvoiceId");

-- Query patterns: "show me a user's payment history", "OSS return for period X",
-- "users with failed payments", "revenue by month".
CREATE INDEX "PaymentRecord_userId_idx"    ON "PaymentRecord"("userId");
CREATE INDEX "PaymentRecord_paidAt_idx"     ON "PaymentRecord"("paidAt");
CREATE INDEX "PaymentRecord_status_idx"     ON "PaymentRecord"("status");
CREATE INDEX "PaymentRecord_plan_idx"      ON "PaymentRecord"("plan");

-- FK: when a user is deleted, their payment ledger goes with them.
-- (Admin deletion already snapshots summary stats into AdminDeletionLog
-- before the cascade, so no financial audit trail is lost.)
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
