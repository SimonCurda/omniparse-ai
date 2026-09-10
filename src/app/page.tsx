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
import { toast } from 'sonner';

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

  // OAuth callback redirect pickup.
  // The OAuth callback routes redirect to /?token=<jwt> or /?oauth_error=<provider>.
  // On mount we detect those query params, persist the token (or show a toast
  // for an error), and strip the param from the URL with history.replaceState
  // so users don't accidentally re-share the token in their address bar.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const oauthError = params.get('oauth_error');

    if (token) {
      localStorage.setItem('op_token', token);
      // Strip the token from the URL but preserve any other params (e.g. hash).
      params.delete('token');
      const remaining = params.toString();
      const newSearch = remaining ? `?${remaining}` : '';
      window.history.replaceState(null, '', `${window.location.pathname}${newSearch}${window.location.hash}`);

      // Fetch the user profile using the freshly-stored token and switch
      // straight to the dashboard.
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
            setInvoices([]);
            setView('dashboard');
            toast.success(`Welcome, ${data.user.name}`);
          } else {
            // Token didn't validate — clear it so the user isn't stuck in
            // a half-logged-in state.
            localStorage.removeItem('op_token');
            toast.error('Sign-in failed. Please try again.');
          }
        })
        .catch(() => {
          toast.error('Network error. Please try again.');
        });
      return;
    }

    if (oauthError) {
      const messages: Record<string, string> = {
        google: 'Google sign-in failed. Please try again.',
        github: 'GitHub sign-in failed. Please try again.',
      };
      toast.error(messages[oauthError] || 'Authentication failed. Please try again.');
      params.delete('oauth_error');
      const remaining = params.toString();
      const newSearch = remaining ? `?${remaining}` : '';
      window.history.replaceState(null, '', `${window.location.pathname}${newSearch}${window.location.hash}`);
    }
  }, []);

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
