'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Check, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { useAppStore, type UserProfile } from '@/stores/app-store';
import { toast } from 'sonner';
import { GlassCardProvider } from '@/components/shared/glass-card-provider';
import { useI18n } from '@/lib/i18n';

export function AuthView({ mode, onSwitch, onBack }: { mode: 'login' | 'signup'; onSwitch: (m: 'login' | 'signup') => void; onBack: () => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [withdrawalAcknowledged, setWithdrawalAcknowledged] = useState(false);
  const [emailOwnershipConfirmed, setEmailOwnershipConfirmed] = useState(false);

  const setUser = useAppStore((s) => s.setUser);
  const setView = useAppStore((s) => s.setView);
  const setInvoices = useAppStore((s) => s.setInvoices);

  // In signup mode, submit is disabled until all four consent checkboxes are checked
  // (Terms + Age + EU Withdrawal acknowledgment + Email-ownership confirmation).
  const submitDisabled =
    loading ||
    (mode === 'signup' && (!termsAccepted || !ageConfirmed || !withdrawalAcknowledged || !emailOwnershipConfirmed));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');

    // Client-side password validation
    if (password.length < 8) {
      setApiError(t('auth.error.passwordTooShort'));
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setApiError(t('auth.error.nameRequired'));
      return;
    }

    // Client-side consent validation (defense-in-depth even though submit is disabled)
    if (mode === 'signup' && !termsAccepted) {
      setApiError(t('auth.error.termsRequired'));
      return;
    }
    if (mode === 'signup' && !ageConfirmed) {
      setApiError(t('auth.error.ageRequired'));
      return;
    }
    if (mode === 'signup' && !withdrawalAcknowledged) {
      setApiError(t('auth.error.withdrawalRequired'));
      return;
    }
    if (mode === 'signup' && !emailOwnershipConfirmed) {
      setApiError(t('auth.error.emailOwnershipRequired'));
      return;
    }

    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body: Record<string, string | boolean> = { email, password };
      if (mode === 'signup') {
        body.name = name;
        body.termsAccepted = true;
        body.ageConfirmed = true;
        body.withdrawalAcknowledged = true;
        body.emailOwnershipConfirmed = true;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setApiError(data.error || t('auth.error.generic'));
        return;
      }

      // Email-enumeration prevention: server may return a generic `message` (no
      // user/token) when the email was already registered. Show the message and
      // do NOT attempt to log in.
      if (mode === 'signup' && data.message && !data.user) {
        setApiError(data.message);
        return;
      }

      // Store token
      localStorage.setItem('op_token', data.token);

      // Map API user to UserProfile (ensure createdAt is string)
      const userProfile: UserProfile = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        plan: data.user.plan,
        createdAt: data.user.createdAt,
        debugEnabled: data.user.debugEnabled,
      };

      setUser(userProfile);
      setInvoices([]);
      setView('dashboard');

      if (mode === 'signup') {
        toast.success(t('auth.success.accountCreated'));
      } else {
        toast.success(t('auth.success.welcomeBack', { name: data.user.name }));
      }
    } catch {
      setApiError(t('auth.error.network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <GlassCardProvider />
      <Card data-glow data-glow-border-only className="glass-card w-full max-w-md border-border/50">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">OP</span>
            </div>
            <span className="font-semibold text-lg">OmniParse</span>
          </div>
          <CardTitle className="text-2xl">
            {mode === 'login' ? t('auth.title.signin') : t('auth.title.signup')}
          </CardTitle>
          <CardDescription>
            {t('auth.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="name">{t('auth.label.fullName')}</Label>
                <Input
                  id="name"
                  placeholder={t('auth.placeholder.name')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.label.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.placeholder.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete={mode === 'login' ? 'email' : 'email'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.label.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder={t('auth.placeholder.password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPw(!showPw)}
                  tabIndex={-1}
                  disabled={loading}
                  aria-label={showPw ? t('common.close') : t('common.edit')}
                  aria-pressed={showPw}
                >
                  {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {mode === 'signup' && password.length > 0 && (() => {
              const strength = (() => {
                let score = 0;
                if (password.length >= 8) score++;
                if (/[A-Z]/.test(password)) score++;
                if (/[0-9]/.test(password)) score++;
                if (/[^A-Za-z0-9]/.test(password)) score++;
                return score;
              })();
              const labels = ['', t('auth.strength.weak'), t('auth.strength.fair'), t('auth.strength.good'), t('auth.strength.strong')];
              const bgColors = ['', 'bg-red-500', 'bg-amber-500', 'bg-yellow-500', 'bg-emerald-500'];
              const textColors = ['', 'text-red-500', 'text-amber-500', 'text-yellow-500', 'text-emerald-500'];
              const reqs = [
                { label: t('auth.req.minLength'), met: password.length >= 8 },
                { label: t('auth.req.uppercase'), met: /[A-Z]/.test(password) },
                { label: t('auth.req.number'), met: /[0-9]/.test(password) },
                { label: t('auth.req.special'), met: /[^A-Za-z0-9]/.test(password) },
              ];
              return (
                <div className="space-y-1 mt-1">
                  <div className="flex gap-1">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all ${i < strength ? bgColors[strength] : 'bg-muted'}`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs mt-1 ${textColors[strength]}`}>{labels[strength]}</p>
                  <div className="space-y-0.5 mt-1">
                    {reqs.map((req) => (
                      <div key={req.label} className="flex items-center gap-1.5">
                        {req.met ? (
                          <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                        ) : (
                          <X className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                        )}
                        <span className="text-xs text-muted-foreground">{req.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* OAuth providers — placed below the password field, above the
                submit button. A divider separates the OAuth row from the
                email/password form. Anchors (not buttons) because these are
                full-page redirects to the provider consent screens. */}
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-2 text-xs uppercase tracking-wide text-muted-foreground">
                  {t('auth.or')}
                </span>
              </div>
            </div>

            {/*
              Google OAuth — hidden until branding verification is approved by Google.
              Backend code + env vars are in place. To re-enable:
              1. Wait for Google branding verification to pass
              2. Uncomment the block below
            */}
            {/*
            <a
              href="/api/auth/oauth/google"
              className="inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-md text-sm font-medium h-10 w-full border border-input bg-background shadow-xs transition-all hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
              data-oauth="google"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>{mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}</span>
            </a>
            */}

            <a
              href="/api/auth/oauth/github"
              className="inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-md text-sm font-medium h-10 w-full border border-input bg-background shadow-xs transition-all hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
              data-oauth="github"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" className="shrink-0">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.535-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12z" />
              </svg>
              <span>{mode === 'login' ? t('auth.button.signinGithub') : t('auth.button.signupGithub')}</span>
            </a>

            {mode === 'signup' && (
              <div className="space-y-3 pt-1">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => {
                      setTermsAccepted(checked === true);
                      setAgeConfirmed(checked === true);
                      setEmailOwnershipConfirmed(checked === true);
                    }}
                    disabled={loading}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="terms"
                    className="text-xs text-muted-foreground font-normal leading-relaxed cursor-pointer"
                  >
                    {(() => {
                      // The terms acceptance text contains {termsLink} and
                      // {privacyLink} placeholders. Split + render as links.
                      const text = t('auth.terms.accept');
                      const parts = text.split(/\{(termsLink|privacyLink)\}/);
                      return (
                        <>
                          {parts.map((part, i) => {
                            if (part === 'termsLink') {
                              return (
                                <a key="terms-link" href="/terms-of-service" target="_blank" rel="noopener" className="text-amber-600 hover:underline">
                                  {t('auth.terms.termsLink')}
                                </a>
                              );
                            }
                            if (part === 'privacyLink') {
                              return (
                                <a key="privacy-link" href="/privacy-policy" target="_blank" rel="noopener" className="text-amber-600 hover:underline">
                                  {t('auth.terms.privacyLink')}
                                </a>
                              );
                            }
                            return <span key={i}>{part}</span>;
                          })}
                        </>
                      );
                    })()}
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="withdrawal"
                    checked={withdrawalAcknowledged}
                    onCheckedChange={(checked) => setWithdrawalAcknowledged(checked === true)}
                    disabled={loading}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="withdrawal"
                    className="text-xs text-muted-foreground font-normal leading-relaxed cursor-pointer"
                  >
                    {t('auth.withdrawal.accept')}{' '}
                    <a href="/terms-of-service#right-of-withdrawal" target="_blank" rel="noopener" className="text-amber-600 hover:underline">{t('auth.withdrawal.learnMore')}</a>
                  </Label>
                </div>
              </div>
            )}

            {apiError && (
              <p className="text-sm text-destructive font-medium">{apiError}</p>
            )}

            <Button type="submit" className="w-full" disabled={submitDisabled}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'login' ? t('auth.button.signin') : t('auth.button.signup')}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'login' ? (
              <>
                {t('auth.link.noAccountSignup')}{' '}
                <button
                  className="text-amber-600 hover:underline font-medium"
                  onClick={() => { setApiError(''); onSwitch('signup'); }}
                  disabled={loading}
                >
                  {t('auth.link.noAccountSignupCta')}
                </button>
              </>
            ) : (
              <>
                {t('auth.link.hasAccountSignin')}{' '}
                <button
                  className="text-amber-600 hover:underline font-medium"
                  onClick={() => { setApiError(''); onSwitch('login'); }}
                  disabled={loading}
                >
                  {t('auth.link.hasAccountSigninCta')}
                </button>
              </>
            )}
          </div>
          <div className="mt-3 text-center">
            <Button variant="ghost" size="sm" onClick={onBack} disabled={loading}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> {t('auth.button.backHome')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
