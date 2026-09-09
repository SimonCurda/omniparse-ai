'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Cookie, X } from 'lucide-react';

const CONSENT_KEY = 'omniparse_cookie_consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(CONSENT_KEY);
    if (!saved) {
      setVisible(true);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ essential: true, analytics: true, date: new Date().toISOString() }));
    setVisible(false);
  };

  const rejectOptional = () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ essential: true, analytics: false, date: new Date().toISOString() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[90] p-4 animate-in slide-in-from-bottom duration-300" role="dialog" aria-label="Cookie consent" aria-live="polite">
      <div className="max-w-3xl mx-auto bg-card border border-border rounded-xl p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Cookie className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground flex-1">
          We use local storage for your preferences and authentication. No tracking cookies are active by default. See our{' '}
          <Link href="/cookie-policy" className="text-amber-500 hover:underline font-medium" target="_blank" rel="noopener">
            Cookie Policy
          </Link>{' '}
          for details.
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={rejectOptional}>Essential only</Button>
          <Button size="sm" onClick={acceptAll}>Accept all</Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 absolute top-2 right-2 sm:hidden"
          onClick={rejectOptional}
          aria-label="Dismiss cookie banner"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
