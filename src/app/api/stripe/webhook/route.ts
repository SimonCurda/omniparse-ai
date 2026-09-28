import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

// Stripe webhook endpoint — receives subscription events.
//
// SECURITY HARDENING:
//   1. Signature verification via Stripe SDK (HMAC-SHA256 over raw body).
//   2. Idempotency: every event ID is persisted in StripeEvent BEFORE
//      processing. Replays are no-ops (Prisma P2002 unique constraint).
//   3. Error handling: never echo raw Stripe error text (could leak secrets).
//   4. Each event handler wrapped in its own try/catch.
//
// IMPORTANT: must read raw body via req.text() — Stripe signs the raw bytes.
export async function POST(req: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 });
  }

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

  // Idempotency: persist event ID BEFORE processing so a replay is a no-op.
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
      // Event already processed — idempotent no-op. Return 200 so Stripe stops retrying.
      return NextResponse.json({ received: true, replay: true });
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[stripe/webhook] failed to persist event id:', detail);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }

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
    return NextResponse.json({ error: 'Processing failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function processEvent(event: { id: string; type: string; data: { object: Record<string, unknown> } }): Promise<string | null> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as {
        metadata?: { userId?: string; plan?: string };
        customer?: string;
      };
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;
      if (userId && plan) {
        await db.user.update({ where: { id: userId }, data: { plan } });
        return userId;
      }
      return null;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as {
        customer: string;
        status: string;
        current_period_end?: number;
        id?: string;
        price?: { id?: string };
      };
      const user = await db.user.findFirst({ where: { stripeCustomerId: sub.customer } });
      if (!user) return null;
      if (sub.status === 'active') {
        await db.user.update({
          where: { id: user.id },
          data: {
            stripeSubscriptionId: sub.id || null,
            stripeCurrentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
            stripePriceId: sub.price?.id || null,
          },
        });
      } else if (sub.status === 'canceled' || sub.status === 'unpaid') {
        await db.user.update({
          where: { id: user.id },
          data: { plan: 'free', stripeCurrentPeriodEnd: null },
        });
      }
      return user.id;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as { customer: string; id?: string };
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

    case 'invoice.payment_failed': {
      const invoice = event.data.object as { customer: string };
      const user = await db.user.findFirst({ where: { stripeCustomerId: invoice.customer } });
      if (!user) return null;
      await db.user.update({ where: { id: user.id }, data: { plan: 'free' } });
      return user.id;
    }

    default:
      return null;
  }
}
