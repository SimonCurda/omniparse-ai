'use client';

import { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Sparkles, Zap, Star, Building2, Crown, Pencil, FileDown, TrendingUp, Shield, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface PlanFeature {
  text: string;
  included?: boolean;
  isNew?: boolean;
  isLimit?: boolean;
}

interface Plan {
  name: string;
  icon: React.ElementType;
  monthlyPrice: number;
  annualPrice: number;
  annualDiscount: number;
  description: string;
  badge?: string;
  badgeColor?: string;
  features: PlanFeature[];
  cta: string;
  highlighted: boolean;
  highlightedColor?: string;
  hasAnnual: boolean;
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    icon: Sparkles,
    monthlyPrice: 0,
    annualPrice: 0,
    annualDiscount: 0,
    description: 'Get started with AI-powered invoice parsing.',
    features: [
      { text: '15 invoices / month (hard limit)', isLimit: true },
      { text: '25 AI chat messages / month', isLimit: true },
      { text: '8 built-in validation rules', isLimit: true },
      { text: 'AI extraction with confidence scores' },
      { text: '3-layer tampering detection (metadata, heuristics, VLM)' },
      { text: 'Invoices table with search & filter' },
      { text: 'Invoice detail view (read-only)' },
      { text: 'CSV export' },
      { text: 'Basic analytics dashboard' },
      { text: 'Invoice status tracking (pending → approved → exported)' },
      { text: 'Invoice editing', included: false },
      { text: 'JSON & Excel export', included: false },
      { text: 'Duplicate detection', included: false },
      { text: 'Batch upload', included: false },
    ],
    cta: 'Get Started Free',
    highlighted: false,
    hasAnnual: false,
  },
  {
    name: 'Pro',
    icon: Zap,
    monthlyPrice: 49,
    annualPrice: 39,
    annualDiscount: 20,
    description: 'Best for growing teams processing invoices regularly.',
    badge: 'Best for growing teams',
    badgeColor: 'bg-emerald-500',
    features: [
      { text: 'Everything in Free, plus:' },
      { text: '500 invoices / month', isLimit: true },
      { text: 'Unlimited AI chat', isLimit: true },
      { text: 'Invoice editing — fix AI mistakes, re-validate' },
      { text: 'Duplicate detection (90-day window)' },
      { text: 'Batch upload up to 5 files' },
      { text: 'CSV, JSON & Excel export' },
      { text: '3 custom validation rules' },
      { text: 'Approval workflows', included: false },
      { text: 'Custom export templates', included: false },
    ],
    cta: 'Start Pro',
    highlighted: true,
    highlightedColor: 'emerald',
    hasAnnual: true,
  },
  {
    name: 'Plus',
    icon: Star,
    monthlyPrice: 99,
    annualPrice: 79,
    annualDiscount: 20,
    description: 'For teams doing real invoice processing.',
    features: [
      { text: 'Everything in Pro, plus:' },
      { text: '2,000 invoices / month', isLimit: true },
      { text: 'Up to 20 custom validation rules', isLimit: true },
      { text: 'Approval workflows (auto-approve/flag/block by amount)' },
      { text: 'Line item extraction & duplicate detection' },
      { text: 'Custom validation rules builder' },
      { text: 'Vendor risk scoring (0-100, daily)' },
      { text: 'Advanced analytics (volume, confidence, anomalies)' },
      { text: 'Audit trail (every action, exportable)' },
      { text: 'Bulk operations (export, status, delete, re-validate)' },
      { text: 'Custom export templates — match your GL codes' },
      { text: 'Custom invoice statuses — define your workflow' },
      { text: 'Data retention control (90d / 1yr / forever)' },
      { text: 'Multi-entity support', included: false },
      { text: 'Price change alerts', included: false },
    ],
    cta: 'Start Plus',
    highlighted: false,
    hasAnnual: true,
  },
  {
    name: 'Business',
    icon: Building2,
    monthlyPrice: 199,
    annualPrice: 159,
    annualDiscount: 20,
    description: 'Mid-market teams & enterprises.',
    features: [
      { text: 'Everything in Plus, plus:' },
      { text: '10,000 invoices / month', isLimit: true },
      { text: 'Up to 30 approval rules, multi-step workflows', isLimit: true },
      { text: 'Up to 5 subsidiaries', isLimit: true },
      { text: 'Multi-entity support (up to 5 subsidiaries)' },
      { text: 'Advanced approval workflows (30+ rules, multi-step)' },
      { text: 'Executive dashboard (KPIs, MoM trends)' },
      { text: 'Cost optimization — auto-detect vendor price hikes' },
      { text: 'Vendor performance scorecard (reliability, trends)' },
      { text: 'Unlimited rules', included: false },
      { text: 'Advanced audit logs (immutable export)', included: false },
    ],
    cta: 'Start Business',
    highlighted: false,
    hasAnnual: true,
  },
  {
    name: 'Enterprise',
    icon: Crown,
    monthlyPrice: 499,
    annualPrice: 399,
    annualDiscount: 20,
    description: 'Large enterprises with unlimited needs.',
    features: [
      { text: 'Everything in Business, plus:' },
      { text: 'Unlimited invoices / month', isLimit: true },
      { text: 'Unlimited everything (rules, entities, exports)', isLimit: true },
      { text: 'Unlimited custom rules (100+, nested conditions)' },
      { text: 'Advanced audit logs (immutable, exportable as PDF/CSV)' },
      { text: 'Unlimited subsidiaries' },
    ],
    cta: 'Start Enterprise',
    highlighted: false,
    hasAnnual: true,
  },
];

/* Thin scroll-shadow component */
function ScrollShadow({ children, className }: { children: React.ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showBottom, setShowBottom] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => {
      setShowBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    // Re-check on resize in case content height changes
    window.addEventListener('resize', check);
    return () => {
      el.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  return (
    <div className={"relative " + (className || "")}>
      <div
        ref={containerRef}
        className="pricing-scroll overflow-y-auto pr-2"
        style={{ maxHeight: '320px', scrollbarGutter: 'stable' }}
      >
        {children}
      </div>
      {/* Bottom fade hint */}
      {showBottom && (
        <div className="absolute bottom-0 inset-x-0 h-10 pointer-events-none bg-gradient-to-t from-background via-background/80 to-transparent" />
      )}
    </div>
  );
}

export function PricingSection({ onAuth }: { onAuth: (v: 'login' | 'signup') => void }) {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Choose Your Plan</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free. Upgrade when you need more volume, editing, or team features.
          </p>

          {/* Annual / Monthly toggle */}
          <div className="mt-8 inline-flex items-center gap-3 bg-muted/60 rounded-full p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                !annual
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                annual
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Annual
              <span className="ml-1.5 text-xs font-semibold text-emerald-500">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Upgrade lever callouts */}
        <div className="mb-8">
          <h3 className="text-center text-base font-semibold mb-4">Most noticeable upgrades</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
              <div className="rounded-full bg-emerald-500/10 p-1.5 mt-0.5">
                <Pencil className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs font-medium">Free → Pro</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Fix AI extraction errors yourself</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
              <div className="rounded-full bg-amber-500/10 p-1.5 mt-0.5">
                <FileDown className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-medium">Pro → Plus</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Custom export templates for your GL codes</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
              <div className="rounded-full bg-red-500/10 p-1.5 mt-0.5">
                <TrendingUp className="h-3.5 w-3.5 text-red-500" />
              </div>
              <div>
                <p className="text-xs font-medium">Plus → Business</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Detect vendor price hikes automatically</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
              <div className="rounded-full bg-purple-500/10 p-1.5 mt-0.5">
                <Shield className="h-3.5 w-3.5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs font-medium">Business → Enterprise</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Immutable audit logs, unlimited everything</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {PLANS.map((plan) => {
            const price = annual && plan.hasAnnual ? plan.annualPrice : plan.monthlyPrice;
            const Icon = plan.icon;
            const colorClasses = plan.highlightedColor === 'emerald'
              ? 'border-emerald-500/70 shadow-lg shadow-emerald-500/10'
              : 'border-border';

            return (
              <Card
                key={plan.name}
                className={`relative flex flex-col ${colorClasses}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className={`${plan.badgeColor || 'bg-emerald-500'} text-white px-3 shadow-sm`}>Most Popular</Badge>
                  </div>
                )}
                {plan.badge && !plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="secondary" className="px-2 text-xs">{plan.badge}</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="flex items-center justify-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                  </div>
                  <div className="mt-3">
                    <span className="text-4xl font-bold">
                      {price === 0 ? '$0' : `$${price}`}
                    </span>
                    {price > 0 && (
                      <span className="text-muted-foreground text-sm ml-1">/month</span>
                    )}
                    {annual && plan.hasAnnual && plan.annualDiscount > 0 && (
                      <div className="text-xs text-emerald-500 font-medium mt-1">
                        Save ${((plan.monthlyPrice - plan.annualPrice) * 12).toFixed(0)}/year
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ScrollShadow className="flex-1">
                    <ul className="space-y-1.5">
                      {plan.features.map((f) => (
                        <li key={f.text} className="flex items-start gap-2 text-sm">
                          {f.included !== false ? (
                            <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
                          ) : (
                            <X className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/30" />
                          )}
                          <span
                            className={[
                              f.included !== false ? '' : 'text-muted-foreground/60',
                              f.isLimit && f.included !== false ? 'text-foreground font-medium' : '',
                            ].filter(Boolean).join(' ')}
                          >
                            {f.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </ScrollShadow>
                  <div className="mt-auto pt-3">
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? 'default' : 'outline'}
                      onClick={() => {
                        onAuth('signup');
                      }}
                    >
                      {plan.cta}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-8">
          All plans include data export, account deletion & audit logging. Built with GDPR, EU AI Act & PIPEDA principles. No credit card required for Free.
          <br className="hidden sm:block" />
          Prices shown in USD. Annual billing billed upfront.
        </p>
      </div>
    </section>
  );
}
