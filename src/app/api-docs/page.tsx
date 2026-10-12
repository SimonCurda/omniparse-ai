import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'API Documentation — OmniParse AI',
  description: 'REST API reference for OmniParse AI. Learn how to access your invoices, labels, and data programmatically.',
};

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>

        <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
        <p className="text-muted-foreground mb-8">
          The OmniParse REST API lets you access your invoices, labels, and account data programmatically.
          All endpoints return JSON and use your API key for authentication.
        </p>

        {/* Authentication */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Authentication</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Generate an API key from <strong>Settings → API Access</strong> in the dashboard. Pass it with every request using the <code className="px-1 py-0.5 rounded bg-muted text-amber-600 dark:text-amber-400">X-API-Key</code> header:
          </p>
          <pre className="rounded-lg border border-border bg-muted/30 p-4 text-xs overflow-x-auto"><code>{`curl -H "X-API-Key: op_live_your_key_here" \\
  https://your-app.vercel.app/api/invoices`}</code></pre>
          <p className="text-xs text-muted-foreground mt-2">
            Your API key grants full access to your account data — keep it secret. You can regenerate or revoke it at any time from Settings.
          </p>
        </section>

        {/* Rate Limits */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Rate Limits</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• 60 requests per minute per IP (general API)</li>
            <li>• 5 login attempts per minute per IP (auth endpoints)</li>
            <li>• 3 registration attempts per minute per IP</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-2">
            Rate-limited requests return <code className="px-1 py-0.5 rounded bg-muted">429 Too Many Requests</code>.
          </p>
        </section>

        {/* Endpoints */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Endpoints</h2>

          {/* Invoices */}
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">GET</span>
                <code className="text-sm font-mono">/api/invoices</code>
              </div>
              <p className="text-sm text-muted-foreground">List all your invoices, newest first. Returns an array of invoice objects.</p>
              <pre className="mt-2 rounded bg-muted/30 p-3 text-xs overflow-x-auto"><code>{`curl -H "X-API-Key: YOUR_KEY" \\
  https://your-app.vercel.app/api/invoices`}</code></pre>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">GET</span>
                <code className="text-sm font-mono">/api/invoices/[id]</code>
              </div>
              <p className="text-sm text-muted-foreground">Get a single invoice by ID, including line items, validation results, and labels.</p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">PATCH</span>
                <code className="text-sm font-mono">/api/invoices/[id]</code>
              </div>
              <p className="text-sm text-muted-foreground">Update an invoice&apos;s lifecycle status. Body: <code className="text-xs">{`{ "status": "approved" }`}</code></p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-400">DELETE</span>
                <code className="text-sm font-mono">/api/invoices?id=xxx</code>
              </div>
              <p className="text-sm text-muted-foreground">Delete an invoice by ID.</p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">GET</span>
                <code className="text-sm font-mono">/api/labels</code>
              </div>
              <p className="text-sm text-muted-foreground">List all your labels with usage counts.</p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">POST</span>
                <code className="text-sm font-mono">/api/labels</code>
              </div>
              <p className="text-sm text-muted-foreground">Create a new label. Body: <code className="text-xs">{`{ "name": "Urgent", "color": "red" }`}</code></p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">GET</span>
                <code className="text-sm font-mono">/api/invoices/[id]/labels</code>
              </div>
              <p className="text-sm text-muted-foreground">List labels attached to an invoice.</p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">POST</span>
                <code className="text-sm font-mono">/api/invoices/[id]/labels</code>
              </div>
              <p className="text-sm text-muted-foreground">Attach a label to an invoice. Body: <code className="text-xs">{`{ "labelId": "..." }`}</code></p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-400">DELETE</span>
                <code className="text-sm font-mono">/api/invoices/[id]/labels?labelId=xxx</code>
              </div>
              <p className="text-sm text-muted-foreground">Remove a label from an invoice.</p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">GET</span>
                <code className="text-sm font-mono">/api/usage</code>
              </div>
              <p className="text-sm text-muted-foreground">Get your current monthly parse count and limit.</p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">GET</span>
                <code className="text-sm font-mono">/api/auth/export-data</code>
              </div>
              <p className="text-sm text-muted-foreground">Download all your data as JSON (GDPR data portability).</p>
            </div>
          </div>
        </section>

        {/* Response format */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Response Format</h2>
          <p className="text-sm text-muted-foreground mb-3">All responses are JSON. Example invoice object:</p>
          <pre className="rounded-lg border border-border bg-muted/30 p-4 text-xs overflow-x-auto"><code>{`{
  "id": "ck...",
  "vendor": "Acme Corp",
  "invNumber": "INV-2026-001",
  "invDate": "2026-10-01",
  "amount": 1000.00,
  "vatAmount": 210.00,
  "total": 1210.00,
  "currency": "EUR",
  "status": "done",
  "confidence": 0.95,
  "lifecycleStatus": "approved",
  "labels": [
    { "label": { "id": "ck...", "name": "Urgent", "color": "red" } }
  ],
  "createdAt": "2026-10-01T12:00:00.000Z"
}`}</code></pre>
        </section>

        {/* Errors */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Errors</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <code className="px-1 py-0.5 rounded bg-muted">401</code> — Unauthorized (missing or invalid API key)</li>
            <li>• <code className="px-1 py-0.5 rounded bg-muted">404</code> — Resource not found</li>
            <li>• <code className="px-1 py-0.5 rounded bg-muted">429</code> — Rate limit exceeded</li>
            <li>• <code className="px-1 py-0.5 rounded bg-muted">500</code> — Server error</li>
          </ul>
        </section>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Need help?</strong> Contact support or check the admin dashboard for API key management.
          </p>
        </div>
      </div>
    </div>
  );
}
