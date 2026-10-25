'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  type Language,
  LANGUAGES,
  DEFAULT_LANGUAGE,
  detectBrowserLanguage,
  translate,
} from './translations';

// ─── Language Context ───────────────────────────────────────────────────────
//
// Lightweight i18n provider. Persists the user's language choice in:
//   1. localStorage key `op_lang` (client-side preference survives reload)
//   2. document.cookie `op_lang=...;max-age=31536000;path=/;SameSite=Lax`
//      (so server-rendered pages can read it via Cookie header — used for
//      setting <html lang> properly on subsequent navigations)
//
// On first load (no localStorage), we use detectBrowserLanguage() which
// checks navigator.languages. This means a Czech visitor's first page load
// will already be in Czech — no flashing English first.
//
// USAGE:
//   const { t, lang, setLang } = useI18n();
//   <p>{t('navbar.features')}</p>
//   <button onClick={() => setLang('cz')}>Czech</button>

interface I18nContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'op_lang';
const COOKIE_KEY = 'op_lang';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function I18nProvider({ children }: { children: ReactNode }) {
  // SSR-safe default — must match the server's default to avoid hydration
  // mismatch. The client-side effect will swap in the user's saved
  // language after hydration.
  const [lang, setLangState] = useState<Language>(DEFAULT_LANGUAGE);

  // On mount: load saved language or detect from browser
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored === 'en' || stored === 'cz') {
        setLangState(stored);
        return;
      }
      // No saved preference → detect from browser
      const detected = detectBrowserLanguage();
      if (detected !== DEFAULT_LANGUAGE) {
        setLangState(detected);
      }
    } catch {
      // localStorage may be unavailable (incognito, SSR) — keep default
    }
  }, []);

  // Sync <html lang> attribute + cookie whenever language changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'cz' ? 'cs' : 'en';
      document.cookie = `${COOKIE_KEY}=${lang};max-age=${COOKIE_MAX_AGE};path=/;SameSite=Lax`;
    }
  }, [lang]);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore — localStorage may be unavailable
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Graceful fallback if useI18n is called outside the provider — should
    // not happen in normal usage (layout wraps everything in I18nProvider)
    return {
      lang: DEFAULT_LANGUAGE,
      setLang: () => {},
      t: (key: string) => key,
    };
  }
  return ctx;
}

// Export types + helpers for non-component use (e.g. server components,
// API routes that need to translate strings)
export { translate, detectBrowserLanguage, DEFAULT_LANGUAGE, LANGUAGES };
export type { Language };
