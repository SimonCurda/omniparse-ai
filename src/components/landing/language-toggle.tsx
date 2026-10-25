'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, Globe } from 'lucide-react';
import { useI18n, LANGUAGES, type Language } from '@/lib/i18n';

// ─── Language toggle ─────────────────────────────────────────────────────────
//
// Pill-style button shown in the navbar. Clicking it opens a small dropdown
// with the available languages. The active language is shown with a checkmark.
//
// VISIBILITY GATE:
// The toggle is hidden by default (admin FeatureFlag `show_language_toggle`
// is OFF). Translations are work-in-progress and most browsers have Google
// Translate built-in, so the toggle is opt-in. The admin flips it ON from
// the admin panel when translations are ready for prime time.
//
// Why a dropdown instead of a binary toggle: future languages can be added
// to LANGUAGES in translations.ts and they'll automatically appear here —
// no component change needed.

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch the public feature flag on mount. We don't block render — we
  // start hidden (default OFF) and reveal only once the API confirms the
  // flag is ON. This avoids flashing the toggle on landing page load.
  useEffect(() => {
    fetch('/api/feature-flags/public', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && data.show_language_toggle === true) {
          setVisible(true);
        }
      })
      .catch(() => {
        // Network/SSR error — keep hidden (default OFF)
      });
  }, []);

  // Hidden by default — admin must opt-in via the admin panel.
  // IMPORTANT: this return is AFTER all hooks so React's rules-of-hooks
  // aren't violated.
  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  if (!visible) return null;

  const current = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Change language"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Globe className="h-4 w-4" />
        <span className="text-xs font-medium uppercase">{current.code}</span>
      </button>

      {open && (
        <>
          {/* invisible backdrop to capture clicks on mobile */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="listbox"
            className="absolute right-0 mt-1 z-50 w-44 rounded-lg border border-border bg-card shadow-lg overflow-hidden"
          >
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                role="option"
                aria-selected={l.code === lang}
                type="button"
                onClick={() => {
                  setLang(l.code as Language);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${
                  l.code === lang
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium'
                    : 'hover:bg-accent text-foreground'
                }`}
              >
                <span className="text-base">{l.flag}</span>
                <span className="flex-1">{l.label}</span>
                {l.code === lang && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
