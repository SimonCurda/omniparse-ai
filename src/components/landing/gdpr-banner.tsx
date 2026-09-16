'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, Info } from 'lucide-react';

/**
 * EU AI Processing Notice Banner
 *
 * Shown to all visitors on the landing page. Explains that AI features
 * involve transfer of personal data to US-based AI providers (OpenRouter,
 * Groq, Google Gemini), and that EU users should not upload documents
 * containing personal data of EU data subjects until Standard Contractual
 * Clauses (SCCs) are executed with each AI provider.
 *
 * Dismissable per-session (localStorage) so returning visitors don't see
 * it every time. Banner is informational — we don't actually geo-block,
 * because (a) IP geo-blocking is unreliable, and (b) EU users can still
 * safely use the Service if their documents don't contain personal data
 * subject to GDPR (e.g. anonymized test data, their own personal invoices
 * not processed on behalf of data subjects).
 *
 * Legal context: GDPR Chapter V requires SCCs for transfers to countries
 * without adequacy decisions (like the US). A user checkbox does not
 * replace signed SCCs between OmniParse and AI providers. Until SCCs are
 * in place, EU users uploading personal data is at their own regulatory
 * risk — and ours.
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
        <div className="flex-1 text-xs sm:text-sm text-foreground leading-relaxed">
          <strong className="text-amber-700 dark:text-amber-500">EU users — AI processing notice:</strong>{' '}
          Documents are processed by AI providers in the United States (OpenRouter, Groq, Google Gemini).
          We are executing Standard Contractual Clauses (SCCs) with each provider. Until SCCs are in place,
          do not upload documents containing personal data of EU residents (names, emails, ID numbers) unless
          you have a valid legal basis for the transfer.{' '}
          <a href="/ai-act-notice" className="underline text-amber-700 dark:text-amber-500 hover:text-amber-800 dark:hover:text-amber-400 font-medium">
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
