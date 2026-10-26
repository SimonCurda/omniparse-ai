import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { lookupByPriceId, type Plan, type Interval } from '@/lib/stripe-prices';
import { sendDunningEmail } from '@/lib/email-service';

// ─── Stripe Webhook ──────────────────────────────────────────────────────────
//
// Receives subscription + invoice + charge events from Stripe. ALL billing
// state changes flow through here — checkout completion, plan upgrades /
// downgrades, monthly↔annual switches via the Portal, renewals, cancellations,
// payment failures (dunning), refunds.
//
// SECURITY (defence in depth, multiple layers):
//   1. Signature verification via Stripe SDK (HMAC-SHA256 over the raw body).
//   2. Idempotency: every event ID is persisted in StripeEvent BEFORE
//      processing. Replays are no-ops (Prisma P2002 unique constraint).
//   3. Errors are caught per-event-handler; never echo raw Stripe errors back.
//   4. Plan is derived from the price ID in the subscription line items, NOT
//      from metadata (Stripe doesn't propagate our metadata on Portal-initiated
//      changes — the line-item price ID is the single source of truth).
//   5. Payment ledger (PaymentRecord) is itself idempotent on stripeInvoiceId —
//      a second insert for the same invoice is a no-op. Belt and braces.
//
// v3 CHANGES (this rewrite — annual-billing + OSS/VAT + dunning):
//   - `invoice.payment_succeeded` now INSERTS into PaymentRecord (was a no-op).
//     This is the seller-side ledger needed for OSS/VAT quarterly returns
//     (mandatory once EU cross-border B2C digital revenue > €10k/yr) and for
//     chargeback dispute evidence.
//   - `invoice.payment_failed` now SENDS A DUNNING EMAIL via Resend, deduped
//     by the PaymentRecord ledger (one email per invoice, not per retry).
//   - `checkout.session.async_payment_succeeded` + `async_payment_failed`
//     handlers added — these fire for SEPA debit / Klarna / iDEAL async payment
//     methods, which EU customers use heavily. Previously only the synchronous
//     `checkout.session.completed` path was covered.
//   - `charge.refunded` handler added — flips the PaymentRecord to 'refunded'
//     so the OSS return for the original sale period can be amended.
//   - `stripeStatus` (live subscription status) now persisted on every
//     customer.subscription.* event — the UI uses it to surface "Past due"
//     badges and run grace-period downgrade logic.
//
// EVENTS WE DON'T HANDLE (intentional):
//   - customer.subscription.trial_will_end  (no trial flow yet — add when we do)
//   - invoice.created / invoice.finalized    (we react to settlement, not creation)
//   - customer.updated / customer.source.*   (not billing-relevant)

export async function POST(req: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 });
  }

  // Stripe signs the raw request body — must read as text, not JSON.
  // Next.js `req.json()` would re-serialize and break the signature.
  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 });
  }

  // Construct + verify the event. Throws on signature mismatch — we return 400
  // so Stripe does NOT retry (a bad signature is unrecoverable).
  let event;
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-08-27.basil' as never,
    });
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[stripe/webhook] signature verification failed:', detail);
    return NextResponse.json({ error: 'Signature verification failed.' }, { status: 400 });
  }

  // ─── Idempotency: persist the event ID BEFORE processing ──────────────────
  // If Stripe retries the event (network blip), or a malicious actor replays
  // a captured payload, the second create throws P2002 — we catch and return
  // 200 immediately so Stripe stops retrying.
  let eventId: string | null = null;
  try {
    const created = await db.stripeEvent.create({
      data: {
        eventId: event.id,
        eventType: event.type,
        status: 'processing',
        payload: event.data.object as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    eventId = created.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Already processed — idempotent no-op. 200 stops Stripe retries.
      return NextResponse.json({ received: true, replay: true });
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[stripe/webhook] failed to persist event id:', detail);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }

  // Process the event — failures are caught and recorded as 'failed'.
  let userId: string | null = null;
  try {
    userId = await processEvent(event);
    await db.stripeEvent.update({
      where: { id: eventId },
      data: { status: 'processed', userId },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[stripe/webhook] event ${event.id} (${event.type}) failed:`, detail);
    await db.stripeEvent.update({
      where: { id: eventId },
      data: { status: 'failed', userId, error: detail.slice(0, 500) },
    }).catch(() => {});
    // Return 500 so Stripe retries the event — handlers are written to be
    // idempotent (the StripeEvent row above prevents duplicate application).
    return NextResponse.json({ error: 'Processing failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ─── Event processor ─────────────────────────────────────────────────────────
//
// Each case returns the userId it affected (for forensic logging) or null if
// no user was affected (e.g. event for a customer we don't have).
//
// IMPORTANT: every DB write here MUST be idempotent. If Stripe retries the
// event after we've already applied it, we must NOT double-apply the effect.
// The StripeEvent table enforces this at the event level; PaymentRecord's
// UNIQUE(stripeInvoiceId) enforces it at the invoice level; the subscription
// updates are idempotent by construction (we set absolute values, not deltas).
//
// `data.object` is typed `unknown` (not the full Stripe.Event type) because we
// lazy-load the Stripe SDK inside the handler — pulling in the SDK types at
// module load would slow cold starts. Each case narrows it with `as` to a
// minimal local interface (StripeSubShape / StripeInvoiceShape / etc.).

async function processEvent(event: { id: string; type: string; data: { object: unknown } }): Promise<string | null> {
  switch (event.type) {
    // ─── 1. checkout.session.completed (synchronous payment methods) ───────
    // Fires when the user finishes entering their card on Stripe Checkout.
    // The subscription has been created but might still be `incomplete` until
    // the first payment settles (handled by subscription.*).
    // We update the customer link here as the optimistic path; the authoritative
    // plan derivation happens in the subscription.* events below.
    case 'checkout.session.completed': {
      const session = event.data.object as {
        metadata?: { userId?: string; plan?: string; interval?: string };
        customer?: string;
        subscription?: string;
      };
      const userId = session.metadata?.userId;
      const customer = session.customer as string | undefined;
      const subscriptionId = session.subscription as string | undefined;
      if (userId && customer) {
        await db.user.update({
          where: { id: userId },
          data: {
            stripeCustomerId: customer,
            ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
          },
        });
        return userId;
      }
      return null;
    }

    // ─── 1b. checkout.session.async_payment_succeeded ──────────────────────
    // Fires for ASYNC payment methods (SEPA debit, Klarna, iDEAL, Bancontact,
    // ACH debit) AFTER the payment actually settles. The synchronous
    // `checkout.session.completed` fires earlier with the subscription in
    // `incomplete` status; this event confirms the payment and flips the
    // subscription to active (a customer.subscription.updated event follows).
    //
    // EU customers will hit this path a lot — SEPA is the dominant European
    // payment rail and Stripe treats it as async (settlement takes 1–14 days).
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as {
        metadata?: { userId?: string };
        customer?: string;
        subscription?: string;
      };
      const userId = session.metadata?.userId;
      const customer = session.customer as string | undefined;
      const subscriptionId = session.subscription as string | undefined;
      if (userId && customer) {
        // Idempotent link — the .completed handler already did this, but if the
        // async path runs first (race), we cover the gap.
        await db.user.update({
          where: { id: userId },
          data: {
            stripeCustomerId: customer,
            ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
          },
        });
        return userId;
      }
      return null;
    }

    // ─── 1c. checkout.session.async_payment_failed ─────────────────────────
    // Fires when an async payment method (SEPA/Klarna) FAILS — the subscription
    // transitions to `incomplete_expired`. We don't downgrade here (user was
    // never upgraded); we just notify so they can retry with a different method.
    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as {
        metadata?: { userId?: string };
        customer?: string;
      };
      const userId = session.metadata?.userId;
      if (userId) {
        // TODO: send a "your payment didn't go through" email. For now, log it
        // so the operator can manually follow up. The subscription.* events
        // will handle the eventual status transition cleanly.
        console.warn(`[stripe/webhook] async payment failed for user ${userId}`);
      }
      return userId ?? null;
    }

    // ─── 2. customer.subscription.created ─────────────────────────────────
    // Fires immediately after a new subscription is created (Checkout or Portal).
    // Usually followed by .updated / .active. We just persist the sub ID + status.
    case 'customer.subscription.created': {
      const sub = event.data.object as StripeSubShape;
      const user = await db.user.findFirst({ where: { stripeCustomerId: sub.customer } });
      if (!user) return null;
      await db.user.update({
        where: { id: user.id },
        data: {
          stripeSubscriptionId: sub.id,
          stripeStatus: sub.status,
        },
      });
      return user.id;
    }

    // ─── 3. customer.subscription.updated (THE BIG ONE) ─────────────────────
    // Fires for:
    //   - Initial subscription activation (after the first payment settles)
    //   - Mid-cycle plan upgrade (Pro → Plus via Portal)
    //   - Mid-cycle plan downgrade
    //   - Monthly → annual switch (and vice versa)
    //   - Renewal (status stays active, period_end advances)
    //   - Dunning transitions (active → past_due, past_due → active on recovery)
    //
    // WE DERIVE THE PLAN FROM THE PRICE ID, NOT FROM METADATA.
    // ============================================================
    // Stripe updates the line items on the subscription when the user changes
    // plan via the Portal — our checkout metadata is NOT propagated. The
    // `sub.items.data[0].price.id` is the single source of truth.
    case 'customer.subscription.updated': {
      const sub = event.data.object as StripeSubShape;
      const user = await db.user.findFirst({ where: { stripeCustomerId: sub.customer } });
      if (!user) return null;

      // Statuses we treat as "active": active, trialing (no trial flow yet but
      // defensive), past_due (grace period — keep access until unpaid).
      const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

      if (ACTIVE_STATUSES.includes(sub.status)) {
        const firstItem = sub.items?.data?.[0];
        const priceId = firstItem?.price?.id;
        const lookup = lookupByPriceId(priceId);

        if (lookup) {
          // Apply plan + status derived from the price ID. interval is read
          // at request time via lookupByPriceId (see /api/auth/me), so we don't
          // persist a separate column — one source of truth (the price map).
          await db.user.update({
            where: { id: user.id },
            data: {
              plan: lookup.plan as Plan,
              stripeSubscriptionId: sub.id,
              stripePriceId: priceId ?? null,
              stripeStatus: sub.status,
              stripeCurrentPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000)
                : null,
            },
          });
        } else {
          // Price ID not in our map — could be a legacy price or a manual
          // override from the Stripe Dashboard. Don't change the plan, but
          // persist sub id + status + period end so the UI still renders.
          await db.user.update({
            where: { id: user.id },
            data: {
              stripeSubscriptionId: sub.id,
              stripePriceId: priceId ?? null,
              stripeStatus: sub.status,
              stripeCurrentPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000)
                : null,
            },
          });
          console.warn(`[stripe/webhook] sub.updated: price ${priceId} not in price→plan map; plan left at ${user.plan}`);
        }
      } else if (sub.status === 'canceled' || sub.status === 'unpaid' || sub.status === 'incomplete_expired') {
        // Subscription went terminal — drop to free, clear billing artefacts.
        await db.user.update({
          where: { id: user.id },
          data: {
            plan: 'free',
            stripeStatus: sub.status,
            stripeCurrentPeriodEnd: null,
            stripePriceId: null,
          },
        });
      } else {
        // 'incomplete' or any unknown — just persist the status, leave plan
        // untouched (the .created or subsequent .updated will resolve it).
        await db.user.update({
          where: { id: user.id },
          data: { stripeStatus: sub.status },
        });
      }
      // 'paused' status is handled by the dedicated .paused event below.
      return user.id;
    }

    // ─── 4. customer.subscription.paused ───────────────────────────────────
    // Stripe "pause" = user suspends billing (no charges, no access).
    // We treat paused as free for entitlement purposes — the user can still
    // log in and see their old invoices, but AI features are blocked.
    case 'customer.subscription.paused': {
      const sub = event.data.object as StripeSubShape;
      const user = await db.user.findFirst({ where: { stripeCustomerId: sub.customer } });
      if (!user) return null;
      await db.user.update({
        where: { id: user.id },
        data: {
          plan: 'free',
          stripeStatus: 'paused',
          // Keep subscriptionId + priceId so we can resume correctly on un-pause
          stripeCurrentPeriodEnd: null,
        },
      });
      return user.id;
    }

    // ─── 5. customer.subscription.deleted ──────────────────────────────────
    // Final state — subscription is gone. Fires for voluntary cancellations
    // AND for involuntary (dunning failure → cancellation after retries).
    case 'customer.subscription.deleted': {
      const sub = event.data.object as StripeSubShape;
      const user = await db.user.findFirst({ where: { stripeCustomerId: sub.customer } });
      if (!user) return null;
      await db.user.update({
        where: { id: user.id },
        data: {
          plan: 'free',
          stripeStatus: 'canceled',
          stripeSubscriptionId: null,
          stripeCurrentPeriodEnd: null,
          stripePriceId: null,
        },
      });
      return user.id;
    }

    // ─── 6. invoice.payment_succeeded ──────────────────────────────────────
    // Fires every time Stripe collects a payment: initial subscription charge,
    // renewals (monthly every month, annual every year), prorations on plan
    // change, and one-off invoice top-ups. We don't update the plan here —
    // that's handled by sub.updated. We RECORD the payment for OSS/VAT
    // reporting + reconciliation + chargeback defense.
    //
    // IDEMPOTENT: PaymentRecord.stripeInvoiceId is UNIQUE — a replay of this
    // event (Stripe retry) hits P2002 and we treat it as a no-op.
    case 'invoice.payment_succeeded': {
      const inv = event.data.object as StripeInvoiceShape;
      const user = await db.user.findFirst({
        where: { stripeCustomerId: inv.customer ?? '' },
        select: { id: true },
      });
      if (!user) return null;

      // Derive plan + interval from the first line item's price (same logic as
      // sub.updated — single source of truth is the price map).
      const firstLine = inv.lines?.data?.[0];
      const priceId = firstLine?.price?.id;
      const lookup = lookupByPriceId(priceId);
      const interval: Interval | null = lookup?.interval ?? null;
      const plan: Plan | null = lookup?.plan ?? null;

      // Upsert: if a row exists (e.g. payment_failed recorded a 'failed' row,
      // and now this same invoice settled on retry), flip it to 'paid'.
      // The UNIQUE(stripeInvoiceId) constraint guarantees one row per invoice.
      try {
        await db.paymentRecord.upsert({
          where: { stripeInvoiceId: inv.id },
          create: {
            userId: user.id,
            stripeInvoiceId: inv.id,
            stripeCustomerId: inv.customer ?? null,
            stripeSubscriptionId: inv.subscription ?? null,
            stripeChargeId: inv.charge ?? null,
            amountTotal: inv.total ?? 0,
            currency: inv.currency ?? 'usd',
            amountPaid: inv.amount_paid ?? inv.total ?? 0,
            tax: inv.tax ?? 0,
            interval,
            plan,
            status: 'paid',
            invoicePdfUrl: inv.invoice_pdf ?? null,
            hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
            paidAt: new Date(),
          },
          update: {
            // Transition failed → paid, refresh the artefact URLs in case
            // Stripe regenerated them (rare but possible).
            status: 'paid',
            amountPaid: inv.amount_paid ?? inv.total ?? 0,
            tax: inv.tax ?? 0,
            stripeChargeId: inv.charge ?? null,
            invoicePdfUrl: inv.invoice_pdf ?? null,
            hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
            paidAt: new Date(),
          },
        });
      } catch (err) {
        // P2002 on stripeInvoiceId shouldn't happen with upsert, but if it does
        // (race between two concurrent deliveries), treat as idempotent no-op.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err;
        }
      }
      return user.id;
    }

    // ─── 7. invoice.payment_failed ─────────────────────────────────────────
    // Fires when a payment fails. Stripe will retry per the subscription's
    // dunning settings; we keep the user's plan active until the subscription
    // itself transitions to unpaid/canceled (handled by sub.updated).
    //
    // DUNNING EMAIL: we send ONE email per invoice (not per retry). Dedupe via
    // PaymentRecord — if a row already exists for this stripeInvoiceId, the
    // second create throws P2002 and we skip the email. This prevents spamming
    // the user on every Stripe retry (which can be 4+ times over 2 weeks).
    case 'invoice.payment_failed': {
      const inv = event.data.object as StripeInvoiceShape;
      const user = await db.user.findFirst({
        where: { stripeCustomerId: inv.customer ?? '' },
        select: { id: true, email: true },
      });
      if (!user) return null;

      const firstLine = inv.lines?.data?.[0];
      const priceId = firstLine?.price?.id;
      const lookup = lookupByPriceId(priceId);

      // Attempt to insert a 'failed' ledger row. P2002 means we already
      // recorded a failure for this invoice → don't re-send the dunning email.
      let shouldSendDunning = true;
      try {
        await db.paymentRecord.create({
          data: {
            userId: user.id,
            stripeInvoiceId: inv.id,
            stripeCustomerId: inv.customer ?? null,
            stripeSubscriptionId: inv.subscription ?? null,
            amountTotal: inv.total ?? 0,
            currency: inv.currency ?? 'usd',
            amountPaid: 0,
            tax: inv.tax ?? 0,
            interval: lookup?.interval ?? null,
            plan: lookup?.plan ?? null,
            status: 'failed',
            invoicePdfUrl: inv.invoice_pdf ?? null,
            hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
            paidAt: new Date(),
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          // Already failed before (Stripe retry) — don't spam the user.
          shouldSendDunning = false;
        } else {
          throw err;
        }
      }

      if (shouldSendDunning) {
        // Fire-and-forget — don't block the webhook response on email delivery.
        // Stripe expects a 200 within a tight timeout. If Resend isn't
        // configured, sendDunningEmail logs + returns false (no crash).
        const amountFormatted = formatMoney(inv.total ?? 0, inv.currency);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        void sendDunningEmail(user.email, {
          amount: amountFormatted,
          invoiceUrl: inv.hosted_invoice_url ?? undefined,
          manageBillingUrl: appUrl || undefined,
        }).catch((e) => {
          console.error('[stripe/webhook] dunning email failed:', e instanceof Error ? e.message : String(e));
        });
      }
      return user.id;
    }

    // ─── 8. charge.refunded ─────────────────────────────────────────────────
    // Fires when a charge is fully or partially refunded (via Stripe Dashboard
    // or API). We flip the matching PaymentRecord to 'refunded' (or
    // 'partial_refund') so the OSS return for the original sale period can be
    // amended. Note: refunds create a Stripe Credit Note, not a new invoice,
    // so we look up the PaymentRecord by the charge ID recorded at payment time.
    case 'charge.refunded': {
      const charge = event.data.object as {
        id: string;
        amount_refunded: number;
        amount: number;
        currency: string;
      };
      const isFullRefund = charge.amount_refunded >= charge.amount;

      // Find the PaymentRecord we created in invoice.payment_succeeded by the
      // charge ID we stored at the time.
      const record = await db.paymentRecord.findFirst({
        where: { stripeChargeId: charge.id },
        select: { id: true },
      });
      if (!record) {
        // Charge we don't have a ledger row for (e.g. test charge, manual
        // Dashboard charge not tied to a subscription). Nothing to update.
        return null;
      }
      await db.paymentRecord.update({
        where: { id: record.id },
        data: { status: isFullRefund ? 'refunded' : 'partial_refund' },
      });
      // We don't have the userId on the charge object directly, but the
      // PaymentRecord does — fetch for forensic logging.
      const owned = await db.paymentRecord.findUnique({
        where: { id: record.id },
        select: { userId: true },
      });
      return owned?.userId ?? null;
    }

    default:
      // Unknown event type — log it for awareness, no-op.
      console.warn(`[stripe/webhook] unhandled event type: ${event.type}`);
      return null;
  }
}

// ─── Stripe subscription shape (typed subset) ─────────────────────────────────
// We only destructure a small slice of the Stripe API subscription object;
// this type captures just those fields. Using `stripe.Stripe.Subscription`
// would require importing the SDK at module load (which we don't want — we
// lazy-load it inside the handler so cold starts are fast).
interface StripeSubShape {
  id: string;
  customer: string;
  status: string;  // incomplete, incomplete_expired, trialing, active, past_due, canceled, unpaid, paused
  current_period_end?: number;
  items?: {
    data: Array<{
      price?: { id?: string };
    }>;
  };
}

// ─── Stripe invoice shape (typed subset) ─────────────────────────────────────
// Same philosophy as StripeSubShape — just the fields we read.
interface StripeInvoiceShape {
  id: string;            // in_...
  customer?: string;
  subscription?: string;
  charge?: string | null; // ch_... (legacy) or pi_... (PaymentIntent era)
  total?: number;         // cents
  amount_paid?: number;   // cents (may differ from total on partial payments)
  tax?: number;           // cents
  currency?: string;      // 'usd', 'eur', etc.
  invoice_pdf?: string | null;
  hosted_invoice_url?: string | null;
  lines?: {
    data: Array<{
      price?: { id?: string };
    }>;
  };
}

// ─── Money formatting (cents + ISO currency → human string) ──────────────────
// Lightweight — we don't pull in Intl with full locale data here to keep cold
// starts fast. Good enough for a dunning email ("$49.00", "€49.00").
function formatMoney(cents: number, currency: string | undefined): string {
  const c = (currency || 'usd').toLowerCase();
  const value = (cents / 100).toFixed(2);
  const symbol = c === 'eur' ? '€' : c === 'gbp' ? '£' : c === 'czk' ? 'Kč ' : '$';
  return c === 'czk' ? `${symbol}${value}` : `${symbol}${value}`;
}
