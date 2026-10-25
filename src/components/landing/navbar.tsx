'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { GdprBanner } from './gdpr-banner';
import { LanguageToggle } from './language-toggle';
import { useI18n } from '@/lib/i18n';

export function Navbar({ onAuth }: { onAuth: (v: 'login' | 'signup') => void }) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  const close = () => setMobileOpen(false);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="fixed top-0 inset-x-0 z-50">
      <nav className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button onClick={scrollToTop} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">OP</span>
            </div>
            <span className="font-semibold text-lg tracking-tight">OmniParse</span>
          </button>

          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t('navbar.features')}</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">{t('navbar.pricing')}</a>
          <a href="#comparison" className="hover:text-foreground transition-colors">{t('navbar.compare')}</a>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <LanguageToggle />
          <Button variant="ghost" size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAuth('login')}>{t('navbar.login')}</Button>
          <Button size="sm" onClick={() => onAuth('signup')}>{t('navbar.signup')}</Button>
        </div>

        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation menu" aria-expanded={mobileOpen} aria-controls="mobile-nav-menu">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div id="mobile-nav-menu" className="md:hidden border-t border-border bg-background px-4 pb-4 pt-2 space-y-3">
          <a href="#features" className="block text-sm text-muted-foreground hover:text-foreground" onClick={close}>{t('navbar.features')}</a>
          <a href="#pricing" className="block text-sm text-muted-foreground hover:text-foreground" onClick={close}>{t('navbar.pricing')}</a>
          <a href="#comparison" className="block text-sm text-muted-foreground hover:text-foreground" onClick={close}>{t('navbar.compare')}</a>
          <div className="flex items-center gap-2">
            <LanguageToggle />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => { onAuth('login'); close(); }}>{t('navbar.login')}</Button>
            <Button size="sm" className="flex-1" onClick={() => { onAuth('signup'); close(); }}>{t('navbar.signup')}</Button>
          </div>
        </div>
      )}
      </nav>
      {/* GDPR banner sits BELOW the navbar — inside the same fixed wrapper so both stay visible at top */}
      <GdprBanner />
    </div>
  );
}