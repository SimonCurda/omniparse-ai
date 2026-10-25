// ─── Stripe Price → Plan mapping (single source of truth) ─────────────────────
//
// WHY THIS EXISTS
// ===============
// The webhook handler MUST be able to derive the user's plan + billing interval
// from a Stripe price ID alone — without trusting metadata (which can be
// tampered with by a malicious user, and is fragile when Stripe updates
// subscription line items via the Customer Portal).
//
// Reading metadata for the plan was the original implementation; that breaks
// the moment a customer upgrades Pro → Plus via the Portal, because the
// `customer.subscription.updated` event arrives without our metadata and the
// plan field never updates. Looking up the price ID in this map fixes that.
//
// HOW TO USE
// ==========
// 1. In the Stripe Dashboard, create 8 Prices:
//      - 4 products × 2 intervals (monthly + annual)
//      - Currency: USD (Stripe Checkout localises the displayed amount per
//        the customer's card country; the charge is in USD)
//      - Recurring: monthly → `interval: month, interval_count: 1`
//                   annual  → `interval: year,  interval_count: 1`
//
// 2. Set the 8 env vars below in Vercel (see .env.example).
//
// 3. This file reads them at module load. If any are missing, the relevant
//    plan/interval is silently unavailable — the checkout route will return
//    400 "not configured" instead of creating a half-broken session.

export type Plan = 'pro' | 'plus' | 'business' | 'enterprise';
export type Interval = 'monthly' | 'annual';

interface PriceConfig {
  plan: Plan;
  interval: Interval;
  envVar: string;
}

// Order matters for the upgrade picker UI (Pro → Plus → Business → Enterprise).
const PRICE_CONFIGS: PriceConfig[] = [
  { plan: 'pro',        interval: 'monthly', envVar: 'STRIPE_PRICE_ID_MONTHLY_PRO' },
  { plan: 'pro',        interval: 'annual',  envVar: 'STRIPE_PRICE_ID_ANNUAL_PRO' },
  { plan: 'plus',       interval: 'monthly', envVar: 'STRIPE_PRICE_ID_MONTHLY_PLUS' },
  { plan: 'plus',       interval: 'annual',  envVar: 'STRIPE_PRICE_ID_ANNUAL_PLUS' },
  { plan: 'business',   interval: 'monthly', envVar: 'STRIPE_PRICE_ID_MONTHLY_BUSINESS' },
  { plan: 'business',   interval: 'annual',  envVar: 'STRIPE_PRICE_ID_ANNUAL_BUSINESS' },
  { plan: 'enterprise', interval: 'monthly', envVar: 'STRIPE_PRICE_ID_MONTHLY_ENTERPRISE' },
  { plan: 'enterprise', interval: 'annual',  envVar: 'STRIPE_PRICE_ID_ANNUAL_ENTERPRISE' },
];

// Built once at module load. Each entry maps a Stripe price ID → { plan, interval }.
const PRICE_ID_TO_PLAN: Map<string, { plan: Plan; interval: Interval }> = (() => {
  const map = new Map<string, { plan: Plan; interval: Interval }>();
  for (const cfg of PRICE_CONFIGS) {
    const id = process.env[cfg.envVar];
    if (id) {
      map.set(id, { plan: cfg.plan, interval: cfg.interval });
    }
  }
  return map;
})();

/**
 * Look up a Stripe price ID and return the corresponding plan + interval.
 * Returns null if the price ID isn't in our map (e.g. legacy prices,
 * test prices, or prices from a different product family).
 */
export function lookupByPriceId(priceId: string | undefined | null): { plan: Plan; interval: Interval } | null {
  if (!priceId) return null;
  return PRICE_ID_TO_PLAN.get(priceId) ?? null;
}

/**
 * Look up the Stripe price ID for a given plan + interval.
 * Returns null if the corresponding env var isn't set.
 */
export function getPriceId(plan: Plan, interval: Interval): string | null {
  const cfg = PRICE_CONFIGS.find(c => c.plan === plan && c.interval === interval);
  if (!cfg) return null;
  return process.env[cfg.envVar] ?? null;
}

/**
 * Returns the list of plans that have AT LEAST ONE price ID configured.
 * Used by the Settings UI to show only plans the operator has set up in Stripe.
 */
export function availablePlans(): Plan[] {
  const plans = new Set<Plan>();
  for (const cfg of PRICE_CONFIGS) {
    if (process.env[cfg.envVar]) plans.add(cfg.plan);
  }
  return (['pro', 'plus', 'business', 'enterprise'] as Plan[]).filter(p => plans.has(p));
}

/**
 * Returns true if at least one monthly price is configured.
 * Used to decide whether to show the monthly/annual toggle.
 */
export function hasMonthlyAndAnnual(): boolean {
  const hasMonthly = PRICE_CONFIGS.some(c => c.interval === 'monthly' && process.env[c.envVar]);
  const hasAnnual  = PRICE_CONFIGS.some(c => c.interval === 'annual'  && process.env[c.envVar]);
  return hasMonthly && hasAnnual;
}

/**
 * Plan display metadata — used by both landing page and Settings UI.
 * USD pricing, kept in sync with src/components/landing/pricing-section.tsx.
 */
export const PLAN_DISPLAY: Record<Plan, { name: string; monthly: number; annual: number; description: string }> = {
  pro:        { name: 'Pro',        monthly: 49,  annual: 39,  description: 'Best for growing teams processing invoices regularly.' },
  plus:       { name: 'Plus',       monthly: 99,  annual: 79,  description: 'For teams doing real invoice processing.' },
  business:   { name: 'Business',   monthly: 199, annual: 159, description: 'Mid-market teams & enterprises.' },
  enterprise: { name: 'Enterprise', monthly: 499, annual: 399, description: 'Large enterprises with unlimited needs.' },
};

export const PLAN_ORDER: Plan[] = ['pro', 'plus', 'business', 'enterprise'];

/**
 * True if Stripe is fully configured (secret + webhook + at least one price).
 * Used by the Settings UI to decide whether to show the upgrade flow
 * or a "Billing not yet configured" notice.
 */
export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    PRICE_ID_TO_PLAN.size > 0
  );
}
