'use client';

import { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Sparkles, Zap, Star, Building2, Crown, Pencil, FileDown, TrendingUp, Shield, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

interface PlanFeature {
  text: string;        // English fallback (used when no translation key is set or key missing)
  key?: string;        // Translation key — when set, the UI calls t(key) and falls back to `text`
  included?: boolean;
  isNew?: boolean;
  isLimit?: boolean;
}

interface Plan {
  name: string;            // English fallback
  nameKey?: string;       // Translation key for the plan name
  icon: React.ElementType;
  monthlyPrice: number;
  annualPrice: number;
  annualDiscount: number;
  description: string;
  descriptionKey?: string;
  badge?: string;
  badgeKey?: string;
  badgeColor?: string;
  features: PlanFeature[];
  cta: string;
  ctaKey?: string;
  highlighted: boolean;
  highlightedColor?: string;
  hasAnnual: boolean;
}

// Each plan now has a `<field>Key` parallel to its English `<field>`.
// The render path calls t(key) and falls back to the English string when
// the key is missing or returns the key itself (i.e. untranslated).
const PLANS: Plan[] = [
  {
    name: 'Free',
    nameKey: 'pricing.plan.free.name',
    icon: Sparkles,
    monthlyPrice: 0,
    annualPrice: 0,
    annualDiscount: 0,
    description: 'Get started with AI-powered invoice parsing.',
    descriptionKey: 'pricing.plan.free.description',
    features: [
      { text: '15 invoices / month (hard limit)', key: 'pricing.feature.free.limit1', isLimit: true },
      { text: '10 AI chat messages / month', key: 'pricing.feature.free.limit2', isLimit: true },
      { text: '8 built-in validation rules', key: 'pricing.feature.free.limit3', isLimit: true },
      { text: 'AI extraction with confidence scores', key: 'pricing.feature.free.aiExtraction' },
      { text: '3-layer tampering detection (metadata, heuristics, VLM)', key: 'pricing.feature.free.tampering' },
      { text: 'Invoices table with search & filter', key: 'pricing.feature.free.table' },
      { text: 'Invoice detail view (read-only)', key: 'pricing.feature.free.detail' },
      { text: 'CSV export', key: 'pricing.feature.free.csv' },
      { text: 'Basic analytics dashboard', key: 'pricing.feature.free.analytics' },
      { text: 'Invoice status tracking (pending → approved → exported)', key: 'pricing.feature.free.status' },
      { text: 'REST API access (X-API-Key header)', key: 'pricing.feature.free.api' },
      { text: 'Invoice editing', included: false },
      { text: 'JSON & Excel export', included: false },
      { text: 'Duplicate detection', included: false },
      { text: 'Batch upload', included: false },
    ],
    cta: 'Get Started Free',
    ctaKey: 'pricing.plan.free.cta',
    highlighted: false,
    hasAnnual: false,
  },
  {
    name: 'Pro',
    nameKey: 'pricing.plan.pro.name',
    icon: Zap,
    monthlyPrice: 49,
    annualPrice: 39,
    annualDiscount: 20,
    description: 'Best for growing teams processing invoices regularly.',
    descriptionKey: 'pricing.plan.pro.description',
    badge: 'Best for growing teams',
    badgeKey: 'pricing.plan.pro.badge',
    badgeColor: 'bg-emerald-500',
    features: [
      { text: 'Everything in Free, plus:', key: 'pricing.feature.pro.everythingFree' },
      { text: '500 invoices / month (hard limit)', key: 'pricing.feature.pro.limit1', isLimit: true },
      { text: 'Unlimited AI chat', key: 'pricing.feature.pro.limit2', isLimit: true },
      { text: 'Invoice editing — fix AI mistakes, re-validate', key: 'pricing.feature.pro.editing' },
      { text: 'Line item extraction & duplicate detection', key: 'pricing.feature.pro.lineItems' },
      { text: 'Batch upload up to 5 files', key: 'pricing.feature.pro.batch' },
      { text: 'CSV, JSON & Excel export', key: 'pricing.feature.pro.exports' },
      { text: '3 custom validation rules', key: 'pricing.feature.pro.rules' },
      { text: 'Approval workflows', included: false },
      { text: 'Custom export templates', included: false },
    ],
    cta: 'Start Pro',
    ctaKey: 'pricing.plan.pro.cta',
    highlighted: true,
    highlightedColor: 'emerald',
    hasAnnual: true,
  },
  {
    name: 'Plus',
    nameKey: 'pricing.plan.plus.name',
    icon: Star,
    monthlyPrice: 99,
    annualPrice: 79,
    annualDiscount: 20,
    description: 'For teams doing real invoice processing.',
    descriptionKey: 'pricing.plan.plus.description',
    features: [
      { text: 'Everything in Pro, plus:', key: 'pricing.feature.plus.everythingPro' },
      { text: '2,000 invoices / month (hard limit)', key: 'pricing.feature.plus.limit1', isLimit: true },
      { text: 'Up to 20 custom validation rules', key: 'pricing.feature.plus.limit2', isLimit: true },
      { text: 'Approval workflows (auto-approve/flag/block by amount)', key: 'pricing.feature.plus.approvals' },
      { text: 'Custom validation rules builder', key: 'pricing.feature.plus.rulesBuilder' },
      { text: 'Vendor risk scoring (0-100, daily)', key: 'pricing.feature.plus.vendorRisk' },
      { text: 'Advanced analytics (volume, confidence, anomalies)', key: 'pricing.feature.plus.advancedAnalytics' },
      { text: 'Audit trail (every action, exportable)', key: 'pricing.feature.plus.audit' },
      { text: 'Bulk operations (export, status, delete, re-validate)', key: 'pricing.feature.plus.bulk' },
      { text: 'Custom export templates — match your GL codes', key: 'pricing.feature.plus.templates' },
      { text: 'Custom invoice statuses — define your workflow', key: 'pricing.feature.plus.statuses' },
      { text: 'Data retention control (90d / 1yr / forever)', key: 'pricing.feature.plus.retention' },
      { text: 'Multi-entity support', included: false },
      { text: 'Price change alerts', included: false },
    ],
    cta: 'Start Plus',
    ctaKey: 'pricing.plan.plus.cta',
    highlighted: false,
    hasAnnual: true,
  },
  {
    name: 'Business',
    nameKey: 'pricing.plan.business.name',
    icon: Building2,
    monthlyPrice: 199,
    annualPrice: 159,
    annualDiscount: 20,
    description: 'Mid-market teams & enterprises.',
    descriptionKey: 'pricing.plan.business.description',
    features: [
      { text: 'Everything in Plus, plus:', key: 'pricing.feature.business.everythingPlus' },
      { text: '10,000 invoices / month (hard limit)', key: 'pricing.feature.business.limit1', isLimit: true },
      { text: 'Advanced approval workflows (up to 30 rules, multi-step)', key: 'pricing.feature.business.limit2', isLimit: true },
      { text: 'Multi-entity support (up to 5 subsidiaries)', key: 'pricing.feature.business.multiEntity' },
      { text: 'Executive dashboard (KPIs, MoM trends)', key: 'pricing.feature.business.execDashboard' },
      { text: 'Cost optimization — auto-detect vendor price hikes', key: 'pricing.feature.business.costOpt' },
      { text: 'Vendor performance scorecard (reliability, trends)', key: 'pricing.feature.business.scorecard' },
      { text: 'Price change alerts', key: 'pricing.feature.business.priceAlerts' },
      { text: 'Unlimited rules', included: false },
      { text: 'Advanced audit logs (immutable export)', included: false },
    ],
    cta: 'Start Business',
    ctaKey: 'pricing.plan.business.cta',
    highlighted: false,
    hasAnnual: true,
  },
  {
    name: 'Enterprise',
    nameKey: 'pricing.plan.enterprise.name',
    icon: Crown,
    monthlyPrice: 499,
    annualPrice: 399,
    annualDiscount: 20,
    description: 'Large enterprises with unlimited needs.',
    descriptionKey: 'pricing.plan.enterprise.description',
    features: [
      { text: 'Everything in Business, plus:', key: 'pricing.feature.enterprise.everythingBusiness' },
      { text: 'Unlimited invoices / month', key: 'pricing.feature.enterprise.limit1', isLimit: true },
      { text: 'Unlimited rules, entities & exports', key: 'pricing.feature.enterprise.unlimited' },
      { text: 'Advanced audit logs (immutable, exportable as PDF/CSV)', key: 'pricing.feature.enterprise.auditLogs' },
      { text: 'Unlimited subsidiaries', key: 'pricing.feature.enterprise.subsidiaries' },
      { text: 'More enterprise features coming soon', key: 'pricing.feature.enterprise.comingSoon' },
    ],
    cta: 'Start Enterprise',
    ctaKey: 'pricing.plan.enterprise.cta',
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
  const { t } = useI18n();
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl 2xl:max-w-[1760px] mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{t('pricing.title')}</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('pricing.subtitle')}
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
              {t('pricing.monthly')}
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                annual
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('pricing.annual')}
              <span className="ml-1.5 text-xs font-semibold text-emerald-500">{t('pricing.save')}</span>
            </button>
          </div>
        </div>

        {/* Upgrade lever callouts */}
        <div className="mb-8">
          <h3 className="text-center text-base font-semibold mb-4">{t('pricing.upgrade.title')}</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5 gap-3 max-w-5xl 2xl:max-w-7xl mx-auto">
            <div data-glow className="glass-card flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
              <div className="rounded-full bg-emerald-500/10 p-1.5 mt-0.5">
                <Pencil className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs font-medium">{t('pricing.upgrade.freeToPro')}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t('pricing.upgrade.freeToPro.desc')}</p>
              </div>
            </div>
            <div data-glow className="glass-card flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
              <div className="rounded-full bg-amber-500/10 p-1.5 mt-0.5">
                <FileDown className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-medium">{t('pricing.upgrade.proToPlus')}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t('pricing.upgrade.proToPlus.desc')}</p>
              </div>
            </div>
            <div data-glow className="glass-card flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
              <div className="rounded-full bg-red-500/10 p-1.5 mt-0.5">
                <TrendingUp className="h-3.5 w-3.5 text-red-500" />
              </div>
              <div>
                <p className="text-xs font-medium">{t('pricing.upgrade.plusToBusiness')}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t('pricing.upgrade.plusToBusiness.desc')}</p>
              </div>
            </div>
            <div data-glow className="glass-card flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
              <div className="rounded-full bg-purple-500/10 p-1.5 mt-0.5">
                <Shield className="h-3.5 w-3.5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs font-medium">{t('pricing.upgrade.businessToEnterprise')}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t('pricing.upgrade.businessToEnterprise.desc')}</p>
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
                data-glow
                className={`glass-card relative flex flex-col overflow-hidden ${colorClasses}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className={`${plan.badgeColor || 'bg-emerald-500'} text-white px-3 shadow-sm`}>{t('pricing.badge.popular')}</Badge>
                  </div>
                )}
                {plan.badge && !plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="secondary" className="px-2 text-xs">{plan.badgeKey ? t(plan.badgeKey) : plan.badge}</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="flex items-center justify-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-xl">{plan.nameKey ? t(plan.nameKey) : plan.name}</CardTitle>
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
                        {t('pricing.saveCalc', { amount: `$${((plan.monthlyPrice - plan.annualPrice) * 12).toFixed(0)}` })}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.descriptionKey ? t(plan.descriptionKey) : plan.description}</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ScrollShadow className="flex-1">
                    <ul className="space-y-1.5">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
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
                            {f.key ? t(f.key) : f.text}
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
                      {plan.ctaKey ? t(plan.ctaKey) : plan.cta}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-8">
          {t('pricing.note')}
          <br className="hidden sm:block" />
          {t('pricing.note.pricing')}
        </p>
      </div>
    </section>
  );
}
