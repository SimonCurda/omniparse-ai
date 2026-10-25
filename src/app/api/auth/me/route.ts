import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, isEmailVerified } from '@/lib/auth';
import { lookupByPriceId } from '@/lib/stripe-prices';

export async function GET(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, name: true, plan: true, createdAt: true, googleId: true, githubId: true, password: true, emailVerified: true, debugEnabled: true, stripePriceId: true, stripeCurrentPeriodEnd: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Don't send the password hash to the client — just indicate whether the user has one
  const hasPassword = user.password !== null;
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      createdAt: user.createdAt,
      hasPassword,
      googleId: !!user.googleId,
      githubId: !!user.githubId,
      emailVerified: user.emailVerified,
      emailVerifiedRequired: !isEmailVerified(user.emailVerified, user.createdAt),
      debugEnabled: user.debugEnabled === true,
      // Stripe billing info — needed by Settings UI to show the current
      // interval (monthly vs annual) + next renewal date + "Manage billing"
      // button. The interval is derived server-side from the price ID via
      // the single source-of-truth map in src/lib/stripe-prices.ts, so the
      // client doesn't need to know individual price IDs.
      stripePriceId: user.stripePriceId,
      stripeCurrentPeriodEnd: user.stripeCurrentPeriodEnd,
      billingInterval: user.stripePriceId
        ? lookupByPriceId(user.stripePriceId)?.interval ?? null
        : null,
    },
  });
}
