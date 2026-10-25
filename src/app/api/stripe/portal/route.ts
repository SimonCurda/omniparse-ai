import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// ─── Stripe Customer Portal ──────────────────────────────────────────────────
//
// POST /api/stripe/portal
//
// WHAT THIS DOES
// ==============
// Creates a Stripe Billing Portal session for the logged-in user so they can:
//   - Cancel their subscription (EU consumer right — Czech Consumer
//     Protection Act § 1829(o))
//   - Change card / payment method
//   - Switch between monthly and annual
//   - Download past invoices (Stripe issues these for every payment — these
//     are VAT-compliant receipts the user can use for accounting)
//   - Update billing email / address
//
// PREREQUISITES
// =============
// 1. User must have `stripeCustomerId` set (otherwise no portal possible).
// 2. You must create a Portal Configuration in the Stripe Dashboard
//    (https://dashboard.stripe.com/settings/billing/portal) and either:
//      a) Set it as the default portal configuration, OR
//      b) Set the STRIPE_PORTAL_CONFIG_ID env var to its ID (bpc_xxx)
//         so this route can pass it explicitly.
//
// Recommended Portal Configuration settings:
//   - Customer information: email + address editable
//   - Business features: invoice history = ON, cancellation = ON
//   - Subscription cancellation: allow cancellation immediately + at period end
//   - Subscription update: allow switching between the monthly/annual
//     variants of the same plan, with prorations enabled

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Stripe not configured.' }, { status: 503 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  try {
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { stripeCustomerId: true, plan: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!user.stripeCustomerId) {
      // Free users / never-subscribed users don't have a Stripe Customer
      return NextResponse.json({
        error: 'No active subscription to manage. Upgrade first to access billing management.',
      }, { status: 400 });
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecretKey);

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/?billing=managed`,
      // Optional: pin to a specific Portal configuration (bpc_xxx).
      // If unset, Stripe uses the default Portal configuration.
      ...(process.env.STRIPE_PORTAL_CONFIG_ID
        ? { configuration: process.env.STRIPE_PORTAL_CONFIG_ID }
        : {}),
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/portal] failed:', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: 'Failed to open billing portal. Please try again or contact support.' },
      { status: 500 }
    );
  }
}
