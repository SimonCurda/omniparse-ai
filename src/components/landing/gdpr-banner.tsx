'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, ShieldCheck } from 'lucide-react';

/**
 * EU AI Processing Notice Banner
 *
 * Shown to all visitors on the landing page. Explains that AI features
 * involve transfer of personal data to AI providers — Mistral (EU-based,
 * primary) and US-based providers (OpenRouter, Groq, Google Gemini) as
 * fallback. EU users should not upload personal data of EU data subjects
 * unless Mistral is configured or they have a valid legal basis.
 *
 * Dismissable per-session (sessionStorage) so returning visitors don't
 * see it every time.
 */
export function GdprBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('op_gdpr_banner_dismissed');
      if (saved === 'true') setDismissed(true);
    } catch {
      // sessionStorage unavailable — show banner
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('op_gdpr_banner_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  if (dismissed) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10">
      <div className="max-w-6xl mx-auto px-4 py-2.5 sm:py-3 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-foreground leading-relaxed">
            <strong className="text-amber-700 dark:text-amber-500">EU users — AI processing notice.</strong>{' '}
            Documents are processed by AI providers. Mistral (Paris, EU) is used first;
            OpenRouter, Groq, and Google (US) are fallbacks. Until SCCs are signed with
            US providers, do not upload personal data of EU residents unless Mistral is
            configured or you have a valid legal basis.
          </p>
          <a
            href="/ai-act-notice"
            className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-500 hover:text-amber-800 dark:hover:text-amber-400 underline underline-offset-2"
          >
            Learn more →
          </a>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notice"
          className="shrink-0 p-1 rounded hover:bg-amber-500/20 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-amber-700 dark:text-amber-500" />
        </button>
      </div>
    </div>
  );
}
