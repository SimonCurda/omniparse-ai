# Stripe Setup Runbook — OmniParse AI

End-to-end guide for taking Stripe from "empty Dashboard" to "live annual +
monthly subscriptions with webhooks, EU VAT, and dunning". Work top to bottom.

> **Status after the v3 Stripe work:** the CODE is complete (checkout, portal,
> webhook, payment ledger, dunning, SEPA async paths, EU B2B reverse-charge).
> What remains is **Dashboard configuration** + **env vars** + a **test run**.
> This runbook covers all three.

---

## 0. Prerequisites checklist

- [ ] Stripe account created (https://dashboard.stripe.com/register)
- [ ] Stripe account country = **Czech Republic** (your residency) or the EU
      country where you have a permanent establishment. This determines which
      VAT regime applies and where you file OSS.
- [ ] Business details filled in (legal name, address, VAT ID if registered)
- [ ] Bank account added (for payouts) — optional in test mode
- [ ] `RESEND_API_KEY` set (needed for the dunning email on `invoice.payment_failed`)
- [ ] `NEXT_PUBLIC_APP_URL` set to your Vercel URL (e.g. `https://omniparse-ai.vercel.app`)

---

## 1. Create the 4 Products and 8 Prices

In the Stripe Dashboard → **Products** (https://dashboard.stripe.com/products):

Create **4 products**, one per plan. For each product, create **2 recurring
prices** (monthly + annual).

| Product   | Monthly price | Annual price | Annual = X% off monthly |
|-----------|---------------|--------------|--------------------------|
| Pro       | $49           | $390 (=$39/mo×10, ~20% off) | 20% |
| Plus      | $99           | $790 (=$79/mo×10) | 20% |
| Business  | $199          | $1,590 (=$159/mo×10) | 20% |
| Enterprise| $499          | $3,990 (=$399/mo×10) | 20% |

> The annual prices above reflect the **annual-discount display** on the
> landing page (`pricing-section.tsx` shows "$39/mo when paid annually"). The
> actual Stripe annual price is the monthly × 10 (≈2 months free), which is
> what the ~20% saving represents.

**For every price:**
- **Currency:** USD (Stripe Checkout auto-localises the displayed amount per
  the customer's card country; the underlying charge is in USD — fine for a
  globally-priced SaaS).
- **Monthly price:** `recurring.interval = month`, `interval_count = 1`
- **Annual price:** `recurring.interval = year`, `interval_count = 1`
- **Nickname:** e.g. `Pro Monthly`, `Pro Annual` (makes the Portal + Dashboard
  human-readable).

**For every PRODUCT (not price):**
- Set the **tax code** to `Software / digital services` (`txcd_1010201`).
  This is REQUIRED for Stripe Tax to calculate EU VAT correctly on digital
  SaaS subscriptions. Without it, Stripe Tax silently skips VAT calculation.

After creating, copy each `price_xxx` ID into the env vars in step 4.

---

## 2. Enable Stripe Tax

1. Go to https://dashboard.stripe.com/tax → **Get started**.
2. Confirm your tax registrations:
   - **Czech Republic** (your country of establishment) — register for VAT
     here once your EU cross-border B2C digital revenue is on track to exceed
     **€10,000/yr** (the OSS threshold for EU-established sellers). Below the
     threshold, you can apply VAT per your local rules only.
   - If/when above the threshold: register for the **OSS (One Stop Shop)
     scheme** with the Czech finanční úřad. Then add the OSS registration in
     Stripe Tax → **Tax registrations** → Add → "OSS union" → country: your
     MS of establishment (Czech Republic). Stripe will then auto-calculate
     + collect the correct VAT for every EU MS based on the customer's
     billing address.
3. **Stripe Tax pricing (as of the time of writing):**
   - 1,000 calculations/month free (more than enough at launch).
   - $50/month base + $0.01 per calculation above the free tier.
4. Stripe Tax automatically:
   - Collects the customer's billing address at checkout (we already enabled
     `billing_address_collection: 'auto'`).
   - Validates EU VAT IDs against VIES live (we enabled
     `tax_id_collection: { enabled: true }` so EU B2B customers can supply
     their VAT ID → reverse-charge applies automatically).
   - Generates VAT-compliant invoices/receipts on every successful payment.

---

## 3. Configure the Customer Portal

1. Go to https://dashboard.stripe.com/settings/billing/portal.
2. Recommended configuration:

| Setting | Value | Why |
|---|---|---|
| Customer information | Email + address editable | EU consumers have a legal right to update their details (GDPR Art. 16) |
| Business features → Invoice history | ON | Required: EU businesses need VAT-compliant receipts for their accounting |
| Subscription cancellation | Allow immediate + at period end | EU right of withdrawal / Czech CC §1829 — let users self-cancel without emailing support |
| Subscription updates | Allow switching between the monthly + annual variants of the same plan | Lets users upgrade monthly→annual mid-cycle (the v3 webhook handles this via price-ID derivation) |
| Proration behavior | Enabled | Stripe's default — fair to both sides on mid-cycle changes |

3. (Optional) If you create a CUSTOM portal configuration (e.g. to hide plan
   downgrades for certain tiers), copy its `bpc_xxx` ID and set it as
   `STRIPE_PORTAL_CONFIG_ID`. If unset, the default config is used.

---

## 4. Set environment variables (Vercel)

In Vercel → your project → **Settings → Environment Variables**, set all of
the following (production + preview + development, or scope as needed):

```
# Core Stripe credentials
STRIPE_SECRET_KEY=sk_live_xxx                    # from https://dashboard.stripe.com/apikeys
STRIPE_WEBHOOK_SECRET=whsec_xxx                  # from step 5 below (AFTER you create the endpoint)

# 8 price IDs (one per plan × interval)
STRIPE_PRICE_ID_MONTHLY_PRO=price_xxx
STRIPE_PRICE_ID_ANNUAL_PRO=price_xxx
STRIPE_PRICE_ID_MONTHLY_PLUS=price_xxx
STRIPE_PRICE_ID_ANNUAL_PLUS=price_xxx
STRIPE_PRICE_ID_MONTHLY_BUSINESS=price_xxx
STRIPE_PRICE_ID_ANNUAL_BUSINESS=price_xxx
STRIPE_PRICE_ID_MONTHLY_ENTERPRISE=price_xxx
STRIPE_PRICE_ID_ANNUAL_ENTERPRISE=price_xxx

# Optional: pin to a custom Portal configuration
STRIPE_PORTAL_CONFIG_ID=bpc_xxx

# Already-set but required for Stripe to work end-to-end
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
RESEND_API_KEY=re_xxx                            # for the dunning email on payment_failed
```

> **Legacy `STRIPE_PRO_PRICE_ID` etc. vars:** these are read by old code paths
> for backward compatibility. New deployments should set the 8 vars above and
> can leave the legacy ones empty.

---

## 5. Register the webhook endpoint

1. Go to https://dashboard.stripe.com/webhooks → **Add endpoint**.
2. **Endpoint URL:** `https://your-app.vercel.app/api/stripe/webhook`
   (replace with your real Vercel URL).
3. **Description:** `OmniParse AI production webhook`.
4. **Events to send** (select exactly these — every event we handle, no more.
   Sending unneeded events wastes log space and adds latency):

   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.paused`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `charge.refunded`

5. **Show secret** → copy `whsec_xxx` → set as `STRIPE_WEBHOOK_SECRET` in
   Vercel env vars. **Redeploy** Vercel so the new env var takes effect.
6. After Vercel redeploys, Stripe Dashboard → webhook endpoint → **Send test
   webhook** → pick `checkout.session.completed`. The Dashboard should show
   a green "200 OK" within a second or two.

> **Idempotency note:** the webhook handler records every Stripe event ID in
> the `StripeEvent` table before processing. Replays (Stripe retries on
> network blips) and captured-payload replays (attack) are no-ops — the unique
> constraint on `eventId` makes the second delivery a 200 that does nothing.

---

## 6. Run the database migration

The v3 Stripe work adds two things to the schema:

1. **`User.stripeStatus`** — live subscription status (`active` / `past_due` /
   `canceled` / etc.) so the UI can surface "Past due — update your card" badges.
2. **`PaymentRecord`** — idempotent ledger of every Stripe invoice outcome
   (paid / failed / refunded). Source for OSS/VAT CSV export + chargeback
   evidence + dunning dedupe.

Both are **additive, non-breaking** (nullable columns + a new table). Run:

```bash
# From the repo root, against your Supabase production DB:
DATABASE_URL='postgresql://...' bunx prisma migrate deploy
```

(See `PRISMA_MIGRATION_RUNBOOK.md` for the project's full migration protocol
including the "test on a preview branch first" pattern.)

If you prefer to skip migration history and just sync schema:
```bash
bunx prisma db push
```
…but `migrate deploy` is recommended — it preserves the audit trail.

---

## 7. Test the full flow (Stripe test mode)

1. Set all env vars using your **test-mode** keys (`sk_test_...`,
   `whsec_...` from a test-mode webhook endpoint).
2. Use the Stripe CLI to forward webhooks to your local dev server (or to a
   Vercel preview deployment):

   ```bash
   stripe listen --forward-to https://your-preview.vercel.app/api/stripe/webhook
   # (or for local: http://localhost:3000/api/stripe/webhook)
   ```

   The CLI prints a `whsec_...` — use THIS as `STRIPE_WEBHOOK_SECRET` for
   local testing (it's different from the Dashboard endpoint's secret).

3. Walk through each scenario and verify the DB + email:

| Scenario | How to trigger | Expected DB state | Expected email |
|---|---|---|---|
| New monthly sub | Click "Start Pro" on pricing → pay with `4242 4242 4242 4242` | User: plan=pro, stripeStatus=active, stripePriceId=monthly. PaymentRecord: status=paid | — |
| New annual sub | Toggle "Annual" → click "Start Plus" → pay | User: plan=plus, stripeStatus=active, stripePriceId=annual. PaymentRecord: status=paid, interval=annual | — |
| Switch monthly→annual via Portal | Settings → Manage billing → switch plan → choose annual | User: stripePriceId updates to annual variant | — |
| Payment failure (dunning) | Use card `4000 0000 0000 0002` (declined) | PaymentRecord: status=failed. User: plan unchanged (grace period) | Dunning email sent ONCE |
| Dunning retry (no spam) | Wait for Stripe's retry (~1 day in test, or use the Stripe CLI `trigger invoice.payment_failed` again) | P2002 on PaymentRecord.stripeInvoiceId → no new row, no new email | — (deduped) |
| Refund | Dashboard → the test charge → Refund | PaymentRecord: status=refunded | — |
| Cancellation via Portal | Settings → Manage billing → cancel at period end | On period end: `subscription.deleted` fires → User: plan=free, stripeStatus=canceled | — |

4. Verify OSS export: hit `/api/export/oss` (admin) — should include the test
   PaymentRecords with the correct VAT split per consumer MS.

---

## 8. Go-live checklist

Before flipping to live mode:

- [ ] Test-mode scenarios in step 7 all pass.
- [ ] `STRIPE_SECRET_KEY` swapped from `sk_test_...` → `sk_live_...`.
- [ ] `STRIPE_WEBHOOK_SECRET` swapped to the **live** endpoint's secret.
- [ ] Webhook endpoint in Stripe Dashboard duplicated for **live mode** (test
      and live endpoints are separate; each has its own `whsec_`).
- [ ] Vercel redeployed so live env vars are active.
- [ ] Bank account on Stripe verified (for payouts).
- [ ] Stripe Tax registrations configured (Czech VAT + OSS union if above
      the €10k threshold).
- [ ] Customer Portal configuration saved.
- [ ] Products have tax code `txcd_1010201` (Software / digital services).
- [ ] Dunning email sending verified (Resend domain authenticated in prod,
      not `onboarding@resend.dev`).
- [ ] **OSS filing reminder** added to your calendar — quarterly deadlines:
      end of Q1 → 20 April, Q2 → 20 July, Q3 → 20 October, Q4 → 20 January.
      Even if Stripe Tax calculates VAT perfectly, **you** (the seller) must
      file the OSS return with the Czech finanční úřad. The
      `/api/export/oss` CSV is the input for that filing.
- [ ] VAT-compliant receipt spot-check: buy a test sub on yourself, download
      the Stripe-issued invoice, confirm it has issuer name + VAT ID,
      sequential number, tax base, VAT rate, VAT amount, date of supply
      (Czech VAT Act §35 content requirements).

---

## 9. What to do if a webhook fails

1. Stripe Dashboard → Webhooks → your endpoint → see the failed delivery +
   the response body (we return 500 on processing failure so Stripe retries).
2. The `StripeEvent` table records `status = 'failed'` + an `error` field.
   Query it in the admin panel to see the exact failure for each event ID.
3. Fix the root cause, then in the Stripe Dashboard click **Resend** on the
   failed event. The idempotency layer means a safe retry.
4. If a single event keeps failing, you can replay it manually against your
   dev environment using the Stripe CLI:
   ```bash
   stripe events resend evt_xxx
   ```

---

## 10. Annual-billing-specific notes

- **Annual renewal:** Stripe fires `invoice.payment_succeeded` once per year
  on renewal. The webhook records it as a `PaymentRecord` with
  `interval='annual'` — this is the row that goes on your OSS return for the
  consumption country (derived from the customer's billing address).
- **Mid-cycle monthly→annual switch:** the Customer Portal lets users switch.
  `customer.subscription.updated` fires with the new annual price ID; the
  webhook derives plan + interval from the price map and updates the User.
  Stripe generates a proration invoice for the difference —
  `invoice.payment_succeeded` records that proration charge too.
- **Annual + SEPA:** SEPA debit on an annual subscription settles 1–14 days
  after the charge. The subscription is `incomplete` between checkout and
  settlement; `checkout.session.async_payment_succeeded` flips it to active.
  The v3 webhook handles this async path (previously only the sync path was
  covered — EU SEPA users would have been stuck in `incomplete` forever).
- **Refunds on annual:** when an annual subscription is refunded, the
  PaymentRecord flips to `refunded`. You'll need to amend the OSS return for
  the quarter the original sale was reported in.
