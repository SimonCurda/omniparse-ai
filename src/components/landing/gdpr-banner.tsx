'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * EU AI Processing Notice Banner
 *
 * Shown to all visitors on the landing page. Explains that AI features
 * involve transfer of personal data to AI providers — Mistral (EU-based,
 * primary) and US-based providers as fallback.
 *
 * As of December 9, 2026:
 * - Mistral (EU): ✅ No SCC needed — stays in EU
 * - Groq (US): ✅ SCCs confirmed in effect
 * - OpenRouter + Google (US): ⏳ Pending SCC verification
 *
 * EU users CAN legally use OmniParse via Mistral + Groq.
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
    <div className="bg-amber-100 border-b-2 border-amber-400 dark:bg-amber-900/40 dark:border-amber-600">
      <div className="max-w-6xl mx-auto px-4 py-2.5 sm:py-3 flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
            <span className="font-bold">EU users — AI processing notice.</span>{' '}
            Documents are processed by AI providers: Mistral (Paris, EU) is used first (no transfer outside EU);
            Groq (US) has confirmed SCCs. OpenRouter and Google (US) are fallbacks pending SCC verification.
            Processing via Mistral and Groq is fully GDPR-compliant.{' '}
            <a href="/ai-act-notice" className="text-amber-800 dark:text-amber-300 hover:underline font-bold">
              Learn more →
            </a>
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notice"
          className="shrink-0 p-1 rounded hover:bg-amber-300/50 dark:hover:bg-amber-700/50 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-amber-800 dark:text-amber-300" />
        </button>
      </div>
    </div>
  );
}
