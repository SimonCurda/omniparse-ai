import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, verifyPassword } from '@/lib/auth';

export async function DELETE(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, password: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 });
  }

  // Password verification:
  // - Password users (user.password != null) must supply a valid password.
  // - OAuth-only users (user.password == null) skip the check — they are
  //   already authenticated via the JWT in the Authorization header, which
  //   is the only credential they have.
  if (user.password !== null) {
    if (!body.password) {
      return NextResponse.json(
        { error: 'Current password is required to delete your account' },
        { status: 400 }
      );
    }
    const isValid = await verifyPassword(body.password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }
  }

  try {
    // Cancel Stripe subscription if user has one (prevents ongoing charges for deleted account)
    const userWithStripe = await db.user.findUnique({
      where: { id: auth.userId },
      select: { stripeSubscriptionId: true },
    });

    if (userWithStripe?.stripeSubscriptionId) {
      try {
        const Stripe = (await import('stripe')).default;
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        if (stripeSecretKey) {
          const stripe = new Stripe(stripeSecretKey);
          await stripe.subscriptions.cancel(userWithStripe.stripeSubscriptionId);
          console.warn(`[delete-account] Cancelled Stripe subscription ${userWithStripe.stripeSubscriptionId} for user ${auth.userId}`);
        }
      } catch (stripeErr) {
        // Log but don't block deletion — user still wants their account gone
        console.error(`[delete-account] Failed to cancel Stripe subscription ${userWithStripe.stripeSubscriptionId}:`, stripeErr instanceof Error ? stripeErr.message : String(stripeErr));
      }
    }

    // Document the erasure request in server logs.
    // Note: AuditLog entries have onDelete: Cascade on userId, so writing one here would
    // be cascade-deleted with the user below. The user explicitly requested full erasure
    // (GDPR-correct), so this console.warn is the audit trail instead.
    console.warn(`[delete-account] Erasing account ${auth.userId} and all associated data (chat sessions, invoices, audit logs)`);

    await db.$transaction([
      db.chatSession.deleteMany({ where: { userId: auth.userId } }),
      db.invoice.deleteMany({ where: { userId: auth.userId } }),
      db.user.delete({ where: { id: auth.userId } }),
    ]);

    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Failed to delete account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account. Please try again.' },
      { status: 500 }
    );
  }
}
