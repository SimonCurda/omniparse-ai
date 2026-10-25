import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { lookupByPriceId, type Plan, type Interval } from '@/lib/stripe-prices';

// ─── Stripe Webhook ──────────────────────────────────────────────────────────
//
// Receives subscription events from Stripe. ALL state changes flow through
// here — checkout completion, plan upgrades, plan downgrades, mid-cycle plan
// switches via the Portal, subscription cancellations, payment failures, etc.
//
// SECURITY HARDENING (already in place from v1):
//   1. Signature verification via Stripe SDK (HMAC-SHA256 over raw body).
//   2. Idempotency: every event ID is persisted in StripeEvent BEFORE
//      processing. Replays are no-ops (Prisma P2002 unique constraint).
//   3. Errors are caught per-event-handler; never echo raw Stripe errors.
//
// v2 CHANGES (this rewrite):
//   4. Plan is derived from the price ID in the subscription line items,
//      NOT from metadata. This is the Stripe-recommended pattern. Metadata
//      is kept only for forensic/debugging. (Why this matters: when a user
//      upgrades Pro → Plus via the Customer Portal, the resulting
//      customer.subscription.updated event arrives WITHOUT our metadata —
//      the line items are the only reliable source of truth.)
//   5. Interval (monthly/annual) is persisted too — needed by the UI to show
//      "Pro (annual)" vs "Pro (monthly)" and to suppress the monthly/annual
//      toggle for the active plan.
//   6. New event handlers:
//        - customer.subscription.paused          → mark user as free (Stripe
//          "paused" = no charge, no access)
//        - invoice.payment_succeeded            → record successful payment
//          (used for OSS/VAT reporting; no plan change)
//        - customer.subscription.created         → no-op (just log)
//
// EVENTS WE DON'T HANDLE (intentional):
//   - checkout.session.async_payment_succeeded  (only fires for async payment
//     methods like SEPA debit / Klarna — the regular checkout.session.completed
//     handler covers this via subscription.created later)
//   - customer.subscription.trial_will_end       (no trial flow yet)
//   - invoice.created                            (we use payment_succeeded only)

export async function POST(req: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 });
  }

  // Stripe signs the raw request body — must read as text, not JSON
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

  // Construct + verify the event
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

  // Idempotency: persist the event ID BEFORE processing.
  // ============================================================
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

  // Process the event — failures are caught and recorded as 'failed'
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
// The StripeEvent table at the top enforces this, but defence in depth
// means we also write idempotently (upserts, no increments, etc.).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processEvent(event: { id: string; type: string; data: { object: any } }): Promise<string | null> {
  switch (event.type) {
    // ─── 1. checkout.session.completed ──────────────────────────────────
    // Fires when the user finishes entering their card on Stripe Checkout.
    // The subscription has been created but might still be in `incomplete`
    // status until the first payment settles (handled by subscription.*).
    // We update the customer link + plan here as the optimistic path.
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
        // Persist the customer link (defence-in-depth; the checkout route
        // already saved it, but if the webhook runs first we cover the gap)
        await db.user.update({
          where: { id: userId },
          data: {
            stripeCustomerId: customer,
            ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
          },
        });
        // Plan derivation is done in the subscription.* events below — we
        // don't trust metadata.plan here because the Stripe checkout may
        // have been started with one price but the user changed something.
        return userId;
      }
      return null;
    }

    // ─── 2. customer.subscription.created ───────────────────────────────
    // Fires immediately after a new subscription is created (whether via
    // Checkout or Portal). Usually followed by updated / active.
    case 'customer.subscription.created': {
      const sub = event.data.object as StripeSubShape;
      const user = await db.user.findFirst({ where: { stripeCustomerId: sub.customer } });
      if (!user) return null;
      // Persist the sub ID; plan + period will be set by the .updated event
      await db.user.update({
        where: { id: user.id },
        data: { stripeSubscriptionId: sub.id },
      });
      return user.id;
    }

    // ─── 3. customer.subscription.updated (THE BIG ONE) ──────────────────
    // Fires for:
    //   - Initial subscription activation (after the first payment settles)
    //   - Mid-cycle plan upgrade (Pro → Plus via Portal)
    //   - Mid-cycle plan downgrade
    //   - Monthly → annual switch
    //   - Renewal (status stays active, period_end advances)
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

      // Statuses we treat as "active": active, trialing (no trial flow yet
      // but defensive), past_due (grace period — keep access until unpaid)
      const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

      if (ACTIVE_STATUSES.includes(sub.status)) {
        // Derive plan from the first line item's price
        const firstItem = sub.items?.data?.[0];
        const priceId = firstItem?.price?.id;
        const lookup = lookupByPriceId(priceId);

        if (lookup) {
          // Apply the plan derived from the price ID
          await db.user.update({
            where: { id: user.id },
            data: {
              plan: lookup.plan as Plan,
              stripeSubscriptionId: sub.id,
              stripePriceId: priceId ?? null,
              stripeCurrentPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000)
                : null,
            },
          });
        } else {
          // Price ID not in our map — could be a legacy price or a manual
          // override from the Stripe Dashboard. Don't change the plan, but
          // update the sub id + period end so the UI still shows the right
          // renewal date.
          await db.user.update({
            where: { id: user.id },
            data: {
              stripeSubscriptionId: sub.id,
              stripePriceId: priceId ?? null,
              stripeCurrentPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000)
                : null,
            },
          });
          console.warn(`[stripe/webhook] sub.updated: price ${priceId} not in price→plan map; plan left at ${user.plan}`);
        }
      } else if (sub.status === 'canceled' || sub.status === 'unpaid' || sub.status === 'incomplete_expired') {
        // Subscription went terminal — drop to free
        await db.user.update({
          where: { id: user.id },
          data: {
            plan: 'free',
            stripeCurrentPeriodEnd: null,
            stripePriceId: null,
          },
        });
      }
      // 'paused' status is handled by the dedicated .paused event below
      return user.id;
    }

    // ─── 4. customer.subscription.paused ─────────────────────────────────
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
          // Keep subscriptionId so we can resume if the user unpauses
          stripeCurrentPeriodEnd: null,
          stripePriceId: null,
        },
      });
      return user.id;
    }

    // ─── 5. customer.subscription.deleted ────────────────────────────────
    // Final state — subscription is gone. Stripe fires this for voluntary
    // cancellations AND for involuntary (dunning failure → cancellation).
    case 'customer.subscription.deleted': {
      const sub = event.data.object as StripeSubShape;
      const user = await db.user.findFirst({ where: { stripeCustomerId: sub.customer } });
      if (!user) return null;
      await db.user.update({
        where: { id: user.id },
        data: {
          plan: 'free',
          stripeSubscriptionId: null,
          stripeCurrentPeriodEnd: null,
          stripePriceId: null,
        },
      });
      return user.id;
    }

    // ─── 6. invoice.payment_succeeded ────────────────────────────────────
    // Fires every time Stripe collects a payment (initial + renewals + prorations).
    // We don't update the plan here — that's handled by sub.updated. We
    // record this for OSS/VAT reporting + reconciliation.
    case 'invoice.payment_succeeded': {
      const inv = event.data.object as {
        customer?: string;
        subscription?: string;
        total: number;
        currency: string;
        customer_email?: string;
      };
      const user = await db.user.findFirst({
        where: { stripeCustomerId: inv.customer ?? '' },
        select: { id: true },
      });
      return user?.id ?? null;
    }

    // ─── 7. invoice.payment_failed ──────────────────────────────────────
    // Fires when a payment fails. Stripe will retry per the subscription's
    // dunning settings; we keep the user's plan active until the subscription
    // itself transitions to unpaid/canceled (handled above).
    // We do NOT downgrade here — that causes unnecessary churn. Instead,
    // send an email (TODO) and let Stripe's dunning work.
    case 'invoice.payment_failed': {
      const inv = event.data.object as { customer?: string };
      const user = await db.user.findFirst({
        where: { stripeCustomerId: inv.customer ?? '' },
        select: { id: true },
      });
      // TODO: send a dunning email via Resend when RESEND_API_KEY is set
      return user?.id ?? null;
    }

    default:
      // Unknown event type — log it for awareness, no-op
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
