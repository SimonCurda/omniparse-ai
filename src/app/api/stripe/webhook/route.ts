import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Stripe webhook endpoint — receives subscription events
// Requires STRIPE_WEBHOOK_SECRET env var

export async function POST(req: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ error: 'Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET environment variables.' }, { status: 503 });
  }

  try {
    const body = await req.text();
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecretKey);

    const sig = req.headers.get('stripe-signature');
    if (!sig) {
      return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as { metadata?: { userId?: string; plan?: string } };
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        if (userId && plan) {
          await db.user.update({
            where: { id: userId },
            data: { plan },
          });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as { customer: string; status: string; current_period_end?: number; id?: string; price?: { id?: string } };
        const user = await db.user.findFirst({ where: { stripeCustomerId: sub.customer } });
        if (user) {
          if (sub.status === 'active') {
            await db.user.update({
              where: { id: user.id },
              data: {
                stripeSubscriptionId: sub.id || null,
                stripeCurrentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
              },
            });
          } else if (sub.status === 'canceled' || sub.status === 'unpaid') {
            await db.user.update({
              where: { id: user.id },
              data: { plan: 'free', stripeCurrentPeriodEnd: null },
            });
          }
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as { customer: string };
        const user = await db.user.findFirst({ where: { stripeCustomerId: invoice.customer } });
        if (user) {
          await db.user.update({
            where: { id: user.id },
            data: { plan: 'free' },
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
