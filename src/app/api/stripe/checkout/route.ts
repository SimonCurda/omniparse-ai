import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { getPriceId, type Plan, type Interval, isStripeConfigured } from '@/lib/stripe-prices';

// ─── Stripe Checkout ─────────────────────────────────────────────────────────
//
// POST /api/stripe/checkout
// Body: { plan: 'pro' | 'plus' | 'business' | 'enterprise', interval: 'monthly' | 'annual' }
//
// WHAT THIS DOES
// ==============
// 1. Auth-checks the user (must be logged in).
// 2. Looks up the Stripe price ID for the chosen plan + interval (single source
//    of truth: src/lib/stripe-prices.ts).
// 3. Finds an existing Stripe Customer by email — prevents duplicate customers
//    when a user churns and re-subscribes.
// 4. Creates a Checkout Session with:
//      - consent_collection: { terms: 'auto' }   → records ToS acceptance at
//        checkout (chargeback defense — Stripe keeps the acceptance record)
//      - billing_address_collection: 'auto'      → needed for Stripe Tax +
//        OSS country evidence
//      - automatic_tax: { enabled: true }       → EU VAT on B2C digital
//        services (mandatory since 1 July 2021 / Dir 2017/2451)
//      - allow_promotion_codes: true            → enable launch promos +
//        partnership codes
//      - subscription_data.metadata              → userId + plan + interval
//        (kept for forensic use; the webhook never trusts this — it derives
//        the plan from the price ID instead)
// 5. Returns { url } — the frontend redirects to it.

export async function POST(req: NextRequest) {
  // 1. Auth
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse + validate body
  let body: { plan?: string; interval?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const plan = body.plan as Plan;
  const interval = (body.interval as Interval) || 'monthly';
  if (!plan || !['pro', 'plus', 'business', 'enterprise'].includes(plan)) {
    return NextResponse.json({
      error: "Invalid 'plan'. Must be one of: pro, plus, business, enterprise.",
    }, { status: 400 });
  }
  if (!['monthly', 'annual'].includes(interval)) {
    return NextResponse.json({
      error: "Invalid 'interval'. Must be 'monthly' or 'annual'.",
    }, { status: 400 });
  }

  // 3. Config check
  if (!isStripeConfigured()) {
    return NextResponse.json({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and the 8 STRIPE_PRICE_ID_* env vars.',
    }, { status: 503 });
  }

  const priceId = getPriceId(plan, interval);
  if (!priceId) {
    return NextResponse.json({
      error: `No Stripe price configured for plan=${plan} interval=${interval}. Set the corresponding env var (see .env.example).`,
    }, { status: 503 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecretKey);

    // 4. Load user (need email + name for customer create)
    const user = await db.user.findUnique({ where: { id: auth.userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // 5. Find existing customer by ID, then by email
    //    ============================================================
    //    WHY: If a user previously subscribed, churned, and resubscribes,
    //    we want to attach the new subscription to the SAME Stripe Customer
    //    record. This preserves their billing history, prevents the user
    //    from seeing two customer records in the Portal, and makes
    //    support/refunds much easier.
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      // Try to find by email first — Stripe allows customers.list({ email })
      const existing = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name || undefined,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
      }
      // Persist the customer ID so next time we skip the lookup
      await db.user.update({
        where: { id: auth.userId },
        data: { stripeCustomerId: customerId },
      });
    } else {
      // Verify the customer still exists in Stripe (could have been deleted
      // from the Stripe side). If 404, recreate.
      try {
        await stripe.customers.retrieve(customerId);
      } catch {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name || undefined,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        await db.user.update({
          where: { id: auth.userId },
          data: { stripeCustomerId: customerId },
        });
      }
    }

    // 6. Create Checkout Session
    //    ============================================================
    //    NOTE on automatic_tax: requires the Stripe product to have a tax
    //    code set, AND requires the customer's address (which we collect via
    //    billing_address_collection: 'auto'). On test mode it's free; on live
    //    mode Stripe Tax has a 1,000 calculation/mo free tier, then $50/mo
    //    base + $0.01 per calc above the free tier.
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],

      // EU consumer protection + chargeback defense
      // Stripe records the customer's ToS acceptance at checkout — useful
      // evidence in case of a chargeback dispute. SDK field is `terms_of_service`
      // (Stripe SDK 22.x renamed from `terms`).
      consent_collection: { terms_of_service: 'auto' },

      // Needed for Stripe Tax + OSS country-of-consumption evidence
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
        // Stripe SDK 22.x doesn't support `email` here — we set the customer
        // email at customer creation time and don't allow Checkout to
        // overwrite it.
      },

      // EU VAT on B2C digital services — Stripe calculates + collects + remits
      // via OSS (One-Stop Shop) automatically.
      automatic_tax: { enabled: true },

      // ── EU B2B REVERSE-CHARGE — collect the customer's VAT ID ─────────────
      // CRITICAL for EU billing: if a Czech/German/French BUSINESS buys a
      // subscription and provides a valid EU VAT ID, Stripe Tax applies the
      // REVERSE-CHARGE mechanism (no VAT charged; the buyer self-accounts for
      // VAT in their own MS). Without this field, every EU B2B customer is
      // incorrectly charged VAT — they'll dispute it and you'll have to refund
      // + amend OSS returns. Stripe validates the VAT ID against VIES live.
      tax_id_collection: { enabled: true },

      // Allow promo codes (for launch + partnerships)
      allow_promotion_codes: true,

      // Persist metadata for forensic use (webhook doesn't trust this)
      metadata: {
        userId: auth.userId,
        plan,
        interval,
      },
      subscription_data: {
        metadata: {
          userId: auth.userId,
          plan,
          interval,
        },
        // Default proration: when a customer upgrades mid-cycle, the unused
        // portion of the old plan is credited and the new plan is prorated.
        // 'always_invoice' = immediate invoice for the difference (recommended
        // for SaaS — avoids surprise big charges at renewal).
        // User can change this in the Portal config later if they prefer
        // 'create_prorations' (deferred to next renewal).
        // (Note: proration_behavior is set on the Portal configuration, not here.)
      },

      success_url: `${appUrl}/?checkout=success&plan=${plan}&interval=${interval}`,
      cancel_url:  `${appUrl}/?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Never echo raw Stripe error text — can leak secret values
    console.error('[stripe/checkout] failed:', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: 'Failed to create checkout session. Please try again or contact support.' },
      { status: 500 }
    );
  }
}
