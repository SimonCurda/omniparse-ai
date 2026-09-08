import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// Stripe integration — requires STRIPE_SECRET_KEY and STRIPE_PRICE_ID env vars
// This route creates a Stripe Checkout Session for plan upgrades

const STRIPE_PRICES: Record<string, string> = {
  pro: process.env.STRIPE_PRO_PRICE_ID || '',
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
};

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { plan } = await req.json();
  if (!plan || !STRIPE_PRICES[plan]) {
    return NextResponse.json({
      error: 'Invalid plan. Available: ' + Object.keys(STRIPE_PRICES).join(', '),
    }, { status: 400 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({
      error: 'Set STRIPE_SECRET_KEY and STRIPE_PRO_PRICE_ID environment variables to enable billing.',
    }, { status: 503 });
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecretKey);

    const user = await db.user.findUnique({ where: { id: auth.userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await db.user.update({ where: { id: auth.userId }, data: { stripeCustomerId: customerId } });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICES[plan], quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/?checkout=cancelled`,
      metadata: { userId: auth.userId, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
