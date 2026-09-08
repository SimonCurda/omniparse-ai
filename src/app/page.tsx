'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/app-store';
import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { FeaturesSection } from '@/components/landing/features-section';
import { PricingSection } from '@/components/landing/pricing-section';
import { ComparisonSection } from '@/components/landing/comparison-section';
import { FaqSection } from '@/components/landing/faq-section';
import { CtaSection } from '@/components/landing/cta-section';
import { Footer } from '@/components/landing/footer';
import { AuthView } from '@/components/landing/auth-view';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { LegalDrawer } from '@/components/landing/legal-drawer';
import { CookieBanner } from '@/components/landing/cookie-banner';

export default function Home() {
  const view = useAppStore((s) => s.view);
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const setView = useAppStore((s) => s.setView);
  const setLoading = useAppStore((s) => s.setLoading);
  const setInvoices = useAppStore((s) => s.setInvoices);
  const legalPage = useAppStore((s) => s.legalPage);
  const setLegalPage = useAppStore((s) => s.setLegalPage);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('op_token');
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
        .then((r) => r.json())
        .then((data) => {
          if (data.user) {
            setUser({
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              plan: data.user.plan,
              createdAt: data.user.createdAt,
            });
          }
        })
        .catch(() => {});
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'dashboard') {
      const token = localStorage.getItem('op_token');
      if (token) {
        fetch('/api/invoices', { headers: { Authorization: 'Bearer ' + token } })
          .then((r) => (r.ok ? r.json() : []))
          .then((data) =>
            setInvoices(
              data.map((inv: Record<string, unknown>) => ({
                id: inv.id, filename: inv.filename, vendor: inv.vendor,
                invNumber: inv.invNumber, invDate: inv.invDate, dueDate: inv.dueDate,
                amount: inv.amount, vatAmount: inv.vatAmount, total: inv.total,
                currency: inv.currency, status: inv.status,
                isDuplicate: Boolean(inv.isDuplicate), confidence: inv.confidence,
                fieldConfidence: inv.fieldConfidence, createdAt: inv.createdAt,
                validationResults: inv.validationResults, validationStatus: inv.validationStatus,
                normalizedVendor: inv.normalizedVendor, normalizedInvDate: inv.normalizedInvDate,
                normalizedDueDate: inv.normalizedDueDate, normalizedAmount: inv.normalizedAmount,
                normalizedTotal: inv.normalizedTotal, normalizedCurrency: inv.normalizedCurrency,
                processingTime: inv.processingTime, customFields: inv.customFields,
                approvalStatus: inv.approvalStatus, lifecycleStatus: inv.lifecycleStatus,
                entityId: inv.entityId,
              }))
            )
          )
          .catch(() => {});
      }
    }
  }, [view]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center animate-pulse">
          <span className="text-white font-bold text-sm">OP</span>
        </div>
      </div>
    );
  }

  if (view === 'dashboard' && user) {
    return <DashboardShell />;
  }

  if (view === 'auth') {
    return (
      <>
        <AuthView mode={authMode} onSwitch={setAuthMode} onBack={() => setView('landing')} />
        <LegalDrawer page={legalPage || ''} onClose={() => setLegalPage(null)} />
      </>
    );
  }

  const handleAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setView('auth');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar onAuth={handleAuth} />
      <main id="main-content" className="flex-1">
        <Hero onAuth={handleAuth} />
        <FeaturesSection />
        <PricingSection onAuth={handleAuth} />
        <ComparisonSection />
        <FaqSection />
        <CtaSection onAuth={handleAuth} />
      </main>
      <Footer />
      <CookieBanner />
      <LegalDrawer page={legalPage || ''} onClose={() => setLegalPage(null)} />
    </div>
  );
}
