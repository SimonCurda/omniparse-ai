import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About — OmniParse AI',
  description: 'OmniParse AI is an AI-powered invoice and receipt parsing service built by Simon Curda. Learn about our mission, technology, and commitment to GDPR compliance.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>

        <h1 className="text-3xl font-bold mb-4">About OmniParse AI</h1>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
          <p>
            OmniParse AI is an AI-powered invoice and receipt parsing service that helps businesses
            automate their accounts-payable workflows. Founded by Simon Curda and based in the Czech Republic,
            the service uses vision language models to extract structured data from invoice documents —
            including vendor names, invoice numbers, dates, amounts, VAT, totals, and line items — and
            returns it as clean, structured JSON that can be exported or consumed via REST API.
          </p>

          <p>
            Our mission is to eliminate manual data entry from invoice processing. Traditional OCR tools
            require templates for every vendor and break when layouts change. OmniParse uses AI vision models
            that understand invoice structure the way a human does — they read the document, identify the
            relevant fields, and extract the data regardless of the invoice's layout, language, or format.
            Every extracted field includes a confidence score so you know what to verify before committing
            the data to your accounting system.
          </p>

          <p>
            The service is built with a strong commitment to EU data protection. We use Mistral AI
            (Paris, France) as our primary AI provider so that data processing stays within the EEA.
            Groq Inc. (US-based) is used as a fallback with Standard Contractual Clauses in effect.
            OpenRouter and Google Gemini are disabled by default and only enabled after the operator
            completes their own DPA/SCC review. All data is stored in Supabase (PostgreSQL) with
            transparent disk encryption, and IMAP credentials are encrypted with AES-256-GCM.
          </p>

          <p>
            OmniParse includes built-in compliance features: 3-layer tampering detection (metadata analysis,
            heuristic checks, and vision model inspection) to flag modified PDFs; 8 built-in validation rules
            plus custom rules to catch extraction errors before export; and a full audit trail that records
            every action taken on an invoice. The service supports approval workflows (auto-approve, flag for
            review, or block by amount threshold), custom lifecycle statuses, and bulk operations for
            processing large batches of invoices efficiently.
          </p>

          <p>
            The REST API is available on all plans, including Free, so developers can integrate OmniParse
            into their own systems programmatically. API keys can be generated from the dashboard and used
            via the <code className="px-1 py-0.5 rounded bg-muted">X-API-Key</code> header. Full API
            documentation is available at{' '}
            <Link href="/api-docs" className="text-amber-600 hover:underline">/api-docs</Link>, and the
            OpenAPI specification is published at{' '}
            <Link href="/openapi.json" className="text-amber-600 hover:underline">/openapi.json</Link>.
          </p>

          <p>
            For support, feature requests, or business inquiries, please visit our{' '}
            <Link href="/contact" className="text-amber-600 hover:underline">contact page</Link>.
            To learn more about how we handle your data, see our{' '}
            <Link href="/privacy-policy" className="text-amber-600 hover:underline">Privacy Policy</Link>{' '}
            and{' '}
            <Link href="/terms-of-service" className="text-amber-600 hover:underline">Terms of Service</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
