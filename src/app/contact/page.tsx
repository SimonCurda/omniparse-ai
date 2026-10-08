import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Mail, Globe, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact — OmniParse AI',
  description: 'Get in touch with the OmniParse AI team. Email support, view our legal documents, or access our API documentation.',
  alternates: { canonical: 'https://omniparse-ai.vercel.app/contact' },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>
        <h1 className="text-3xl font-bold mb-4">Contact OmniParse AI</h1>
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <p>OmniParse AI is developed and operated by Simon Curda, based in the Czech Republic. We are committed to responding to all legitimate inquiries within 2 business days. Below are the available contact channels and resources.</p>
          <div className="rounded-xl border border-border bg-card p-6 space-y-4 not-prose">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0"><Mail className="h-5 w-5 text-amber-500" /></div>
              <div>
                <h2 className="font-semibold text-sm">Email Support</h2>
                <p className="text-sm text-muted-foreground mt-1">For technical support, bug reports, feature requests, and account-related inquiries (including password reset requests — see <Link href="/terms-of-service#account-security" className="text-amber-600 hover:underline">ToS §4a</Link> for our password reset policy):</p>
                <p className="text-sm font-mono mt-2">support@omniparse-ai.com</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0"><Globe className="h-5 w-5 text-blue-500" /></div>
              <div>
                <h2 className="font-semibold text-sm">Website</h2>
                <p className="text-sm text-muted-foreground mt-1">The OmniParse AI dashboard and all documentation are available at:</p>
                <p className="text-sm font-mono mt-2"><Link href="https://omniparse-ai.vercel.app" className="text-amber-600 hover:underline">https://omniparse-ai.vercel.app</Link></p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0"><Shield className="h-5 w-5 text-emerald-500" /></div>
              <div>
                <h2 className="font-semibold text-sm">Developer Resources</h2>
                <p className="text-sm text-muted-foreground mt-1">For programmatic access and integration:</p>
                <ul className="text-sm mt-2 space-y-1">
                  <li><Link href="/api-docs" className="text-amber-600 hover:underline">API Documentation</Link> — full endpoint reference with examples</li>
                  <li><Link href="/openapi.json" className="text-amber-600 hover:underline">OpenAPI Specification</Link> — machine-readable OpenAPI 3.0 spec</li>
                  <li><Link href="/api-test" className="text-amber-600 hover:underline">API Tester</Link> — interactive playground for testing API calls</li>
                  <li><Link href="/llms.txt" className="text-amber-600 hover:underline">llms.txt</Link> — agent instruction file with when-to-use guidance</li>
                  <li><Link href="/blog" className="text-amber-600 hover:underline">Blog</Link> — guides and tutorials on AI invoice parsing</li>
                  <li><Link href="/compare" className="text-amber-600 hover:underline">Compare</Link> — OmniParse vs Parseur, Nanonets, Docparser</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 not-prose">
            <h2 className="font-semibold text-sm mb-2">Legal & Compliance</h2>
            <p className="text-sm text-muted-foreground">OmniParse AI is operated in compliance with GDPR, the EU AI Act, and Czech law. For legal inquiries, DPA requests, or data subject access requests, please email support@omniparse-ai.com with the subject line &quot;Legal Inquiry.&quot;</p>
            <div className="flex flex-wrap gap-3 mt-3">
              <Link href="/privacy-policy" className="text-sm text-amber-600 hover:underline">Privacy Policy</Link>
              <span className="text-muted-foreground">·</span>
              <Link href="/terms-of-service" className="text-sm text-amber-600 hover:underline">Terms of Service</Link>
              <span className="text-muted-foreground">·</span>
              <Link href="/cookie-policy" className="text-sm text-amber-600 hover:underline">Cookie Policy</Link>
              <span className="text-muted-foreground">·</span>
              <Link href="/ai-act-notice" className="text-sm text-amber-600 hover:underline">AI Act Notice</Link>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 not-prose">
            <h2 className="font-semibold text-sm mb-2">Response Times</h2>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Technical support: within 2 business days</li>
              <li>• Account/password reset requests: within 1 business day (must be sent from the registered email)</li>
              <li>• Legal/data subject requests: within 30 days (GDPR Art. 12(3))</li>
              <li>• Security vulnerability reports: within 24 hours for acknowledgment</li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground">If you are an existing user, the fastest way to get help is through the in-app dashboard. Log in and use the Settings tab to manage your account, or the API Access tab to manage your API key. For password reset requests, please note that we can only process requests sent from the email address registered on your account — see our <Link href="/terms-of-service#account-security" className="text-amber-600 hover:underline">Terms of Service §4a</Link> for details.</p>
        </div>
      </div>
    </div>
  );
}
