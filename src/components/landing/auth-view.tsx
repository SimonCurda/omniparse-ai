'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Check, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { useAppStore, type UserProfile } from '@/stores/app-store';
import { toast } from 'sonner';

export function AuthView({ mode, onSwitch, onBack }: { mode: 'login' | 'signup'; onSwitch: (m: 'login' | 'signup') => void; onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const setUser = useAppStore((s) => s.setUser);
  const setView = useAppStore((s) => s.setView);
  const setInvoices = useAppStore((s) => s.setInvoices);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');

    // Client-side password validation
    if (password.length < 8) {
      setApiError('Password must be at least 8 characters.');
      return;
    }

    if (mode === 'signup' && !name.trim()) {
      setApiError('Name is required.');
      return;
    }

    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body: Record<string, string> = { email, password };
      if (mode === 'signup') body.name = name;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setApiError(data.error || 'Something went wrong. Please try again.');
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
      };

      setUser(userProfile);
      setInvoices([]);
      setView('dashboard');

      if (mode === 'signup') {
        toast.success('Account created successfully');
      } else {
        toast.success(`Welcome back, ${data.user.name}`);
      }
    } catch {
      setApiError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-md border-border/50">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">OP</span>
            </div>
            <span className="font-semibold text-lg">OmniParse</span>
          </div>
          <CardTitle className="text-2xl">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </CardTitle>
          <CardDescription>
            Your data is stored securely. AI processes documents in real-time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete={mode === 'login' ? 'email' : 'email'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="........"
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
              const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
              const bgColors = ['', 'bg-red-500', 'bg-amber-500', 'bg-yellow-500', 'bg-emerald-500'];
              const textColors = ['', 'text-red-500', 'text-amber-500', 'text-yellow-500', 'text-emerald-500'];
              const reqs = [
                { label: 'At least 8 characters', met: password.length >= 8 },
                { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
                { label: 'One number', met: /[0-9]/.test(password) },
                { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
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

            {apiError && (
              <p className="text-sm text-destructive font-medium">{apiError}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  className="text-amber-500 hover:underline font-medium"
                  onClick={() => { setApiError(''); onSwitch('signup'); }}
                  disabled={loading}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  className="text-amber-500 hover:underline font-medium"
                  onClick={() => { setApiError(''); onSwitch('login'); }}
                  disabled={loading}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
          <div className="mt-3 text-center">
            <Button variant="ghost" size="sm" onClick={onBack} disabled={loading}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
