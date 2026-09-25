import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

/**
 * POST /api/auth/withdraw
 *
 * EU Consumer Right of Withdrawal — Directive (EU) 2023/2673 (effective 19 June 2026)
 * mandates a one-click withdrawal button for online distance contracts.
 *
 * Behavior:
 * 1. Marks the user as withdrawn (sets `withdrawnAt` timestamp).
 * 2. Cancels any active Stripe subscription (prevents future billing).
 * 3. Issues a refund via Stripe if the user paid within the last 14 days AND
 *    has not used AI features (otherwise the §1837(j) waiver applies — no refund).
 * 4. Does NOT delete the account — the user can still log in to view past data,
 *    download exports, etc. Account deletion is a separate action.
 *
 * Withdrawal vs Deletion:
 * - Withdrawal = consumer-protection action; terminates the contract; refund if eligible.
 * - Deletion = GDPR Art. 17 erasure; removes all personal data.
 *
 * Idempotent: if called twice, returns 200 with `alreadyWithdrawn: true`.
 */
export async function POST(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        plan: true,
        stripeSubscriptionId: true,
        stripeCustomerId: true,
        stripeCurrentPeriodEnd: true,
        termsAcceptedAt: true,
        withdrawalAcknowledgedAt: true,
        withdrawnAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Idempotency: if already withdrawn, return success with flag
    if (user.withdrawnAt) {
      return NextResponse.json({
        message: 'Account already withdrawn',
        alreadyWithdrawn: true,
        withdrawnAt: user.withdrawnAt,
      });
    }

    // Check if AI features have been used. If so, the §1837(j) waiver applies
    // and the right of withdrawal was already forfeited at signup. We still
    // process the withdrawal (cancel future billing) but no refund is owed.
    const invoiceCount = await db.invoice.count({ where: { userId: user.id } });
    const chatSessionCount = await db.chatSession.count({ where: { userId: user.id } });
    const hasUsedAiFeatures = invoiceCount > 0 || chatSessionCount > 0;

    let stripeRefundId: string | null = null;
    let subscriptionCancelled = false;
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const isWithin14Days = user.termsAcceptedAt
      ? user.termsAcceptedAt > fourteenDaysAgo
      : user.createdAt > fourteenDaysAgo;
    const eligibleForRefund = !hasUsedAiFeatures && isWithin14Days && user.plan !== 'free';

    // Cancel Stripe subscription if present
    if (user.stripeSubscriptionId) {
      try {
        const Stripe = (await import('stripe')).default;
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        if (stripeSecretKey) {
          const stripe = new Stripe(stripeSecretKey);
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
          subscriptionCancelled = true;
          console.warn(
            `[withdraw] Cancelled Stripe subscription ${user.stripeSubscriptionId} for user ${user.id}`
          );

          // Issue refund if eligible (within 14 days, no AI usage, paid plan)
          if (eligibleForRefund) {
            // Find the most recent payment for this subscription
            const invoices = await stripe.invoices.list({
              subscription: user.stripeSubscriptionId,
              limit: 1,
            });
            const latestInvoice = invoices.data[0];
            if (latestInvoice?.charge && typeof latestInvoice.charge === 'string') {
              const refund = await stripe.refunds.create({
                charge: latestInvoice.charge,
                reason: 'requested_by_customer',
              });
              stripeRefundId = refund.id;
              console.warn(
                `[withdraw] Issued refund ${refund.id} for user ${user.id} (€${refund.amount / 100})`
              );
            }
          }
        }
      } catch (stripeErr) {
        // Log but don't block withdrawal — user wants out
        console.error(
          `[withdraw] Stripe operation failed for user ${user.id}:`,
          stripeErr instanceof Error ? stripeErr.message : String(stripeErr)
        );
      }
    }

    // Mark user as withdrawn. We do NOT delete the account — the user may want
    // to log in to download past data. Account deletion is a separate action.
    await db.user.update({
      where: { id: user.id },
      data: { withdrawnAt: new Date() },
    });

    console.warn(
      `[withdraw] User ${user.id} (${user.email}) withdrew. ` +
        `AI used: ${hasUsedAiFeatures}, refund issued: ${!!stripeRefundId}, ` +
        `subscription cancelled: ${subscriptionCancelled}`
    );

    return NextResponse.json({
      message: 'Withdrawal processed',
      alreadyWithdrawn: false,
      withdrawnAt: new Date().toISOString(),
      hasUsedAiFeatures,
      eligibleForRefund,
      stripeRefundId,
      subscriptionCancelled,
      refundNotice: eligibleForRefund
        ? 'A refund will be issued to your original payment method within 14 days.'
        : hasUsedAiFeatures
          ? 'No refund owed — the right of withdrawal was forfeited at signup per § 1837(j) Czech Civil Code because AI features were used.'
          : 'No refund applicable (free tier or outside 14-day window).',
    });
  } catch (error) {
    console.error('[withdraw] Failed:', error);
    return NextResponse.json(
      { error: 'Failed to process withdrawal. Please try again or contact damr58h@gmail.com.' },
      { status: 500 }
    );
  }
}
