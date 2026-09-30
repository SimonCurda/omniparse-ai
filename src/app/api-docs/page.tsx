'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Code, Copy, Key, Zap, Shield } from 'lucide-react';

export default function ApiDocsPage() {
  const router = useRouter();

  const goBack = () => {
    // If there's browser history (user navigated from the dashboard), go back.
    // Otherwise fall back to the dashboard.
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={goBack} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <span className="text-black font-bold text-sm">OP</span>
            </div>
            <span className="font-semibold text-lg">OmniParse API</span>
          </button>
          <Button variant="outline" size="sm" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to app
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
        {/* Hero */}
        <div>
          <h1 className="text-3xl font-bold mb-3">OmniParse API Documentation</h1>
          <p className="text-lg text-muted-foreground">
            Extract structured data from invoices and receipts via a simple REST API.
            Send a PDF or image, get back vendor, amounts, line items, and more — in JSON.
          </p>
        </div>

        {/* Quick Start */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" /> Quick Start
          </h2>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              1. Generate an API key in <button onClick={goBack} className="text-amber-500 hover:underline">Settings → Developer API</button>
            </p>
            <p className="text-sm text-muted-foreground">2. Send a POST request with your invoice file:</p>
            <CodeBlock code={`curl -X POST https://omniparse-ai.vercel.app/api/v1/extract \\
  -H "Authorization: Bearer op_live_your_key_here" \\
  -F "file=@invoice.pdf"`} />
            <p className="text-sm text-muted-foreground">3. Get structured JSON back:</p>
            <CodeBlock code={`{
  "vendor": "Acme Corp",
  "invoice_number": "INV-2026-001",
  "invoice_date": "2026-01-15",
  "due_date": "2026-02-14",
  "amount": 1000.00,
  "vat_amount": 210.00,
  "total": 1210.00,
  "currency": "EUR",
  "line_items": [
    { "description": "Consulting hours", "quantity": 10, "unit_price": 100, "total": 1000 }
  ],
  "confidence": 0.95,
  "field_confidence": { "vendor": 0.99, "total": 0.97 },
  "validation_status": "pass"
}`} />
          </div>
        </section>

        {/* Authentication */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Key className="h-5 w-5 text-amber-500" /> Authentication
          </h2>
          <p className="text-sm text-muted-foreground">
            All API requests must include your API key in the <code className="px-1 py-0.5 rounded bg-muted text-foreground">Authorization</code> header:
          </p>
          <CodeBlock code={`Authorization: Bearer op_live_your_key_here`} />
          <p className="text-sm text-muted-foreground">
            API keys start with <code className="px-1 py-0.5 rounded bg-muted text-foreground">op_live_</code> and are 56 characters long.
            Generate them in Settings → Developer API. You can have up to 5 active keys.
            Keys are shown only once at creation — store them securely.
          </p>
        </section>

        {/* Endpoints */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Code className="h-5 w-5 text-amber-500" /> Endpoints
          </h2>

          <div className="space-y-6">
            {/* Extract */}
            <div className="rounded-lg border border-border p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500 text-black">POST</span>
                <code className="font-mono text-sm">/api/v1/extract</code>
              </div>
              <p className="text-sm text-muted-foreground">
                Extract structured data from an invoice file. Supports PDF, JPEG, PNG, and WebP.
              </p>

              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Parameters (multipart/form-data):</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1.5 font-medium">Field</th>
                      <th className="text-left py-1.5 font-medium">Type</th>
                      <th className="text-left py-1.5 font-medium">Required</th>
                      <th className="text-left py-1.5 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="py-1.5"><code>file</code></td>
                      <td className="py-1.5">File</td>
                      <td className="py-1.5">Yes</td>
                      <td className="py-1.5">Invoice file (PDF/JPEG/PNG/WebP, max 10MB)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1.5"><code>store</code></td>
                      <td className="py-1.5">String</td>
                      <td className="py-1.5">No</td>
                      <td className="py-1.5"><code>"true"</code> (default) = save to account, <code>"false"</code> = stateless</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Response (200 OK):</p>
                <CodeBlock code={`{
  "vendor": "Acme Corp",
  "invoice_number": "INV-2026-001",
  "invoice_date": "2026-01-15",
  "due_date": "2026-02-14",
  "amount": 1000.00,
  "vat_amount": 210.00,
  "total": 1210.00,
  "currency": "EUR",
  "line_items": [
    {
      "description": "Consulting hours",
      "quantity": 10,
      "unit_price": 100.00,
      "total": 1000.00
    }
  ],
  "confidence": 0.95,
  "field_confidence": {
    "vendor": 0.99,
    "invoice_number": 0.95,
    "total": 0.97
  },
  "validation_status": "pass",
  "invoice_id": "cm..."  // only if store=true
}`} />
              </div>
            </div>

            {/* Usage */}
            <div className="rounded-lg border border-border p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500 text-white">GET</span>
                <code className="font-mono text-sm">/api/usage</code>
              </div>
              <p className="text-sm text-muted-foreground">
                Check your current API usage and limits. Uses the same auth as extract.
              </p>
              <CodeBlock code={`curl https://omniparse-ai.vercel.app/api/usage \\
  -H "Authorization: Bearer op_live_your_key_here"`} />
            </div>
          </div>
        </section>

        {/* Rate Limits */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-500" /> Rate Limits
          </h2>
          <p className="text-sm text-muted-foreground">
            API calls share the same monthly quota as web UI uploads. The limit depends on your plan:
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Plan</th>
                <th className="text-left py-2 font-medium">Monthly Limit</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b"><td className="py-2">Free</td><td className="py-2">15 / month</td></tr>
              <tr className="border-b"><td className="py-2">Pro</td><td className="py-2">500 / month</td></tr>
              <tr className="border-b"><td className="py-2">Plus</td><td className="py-2">2,000 / month</td></tr>
              <tr className="border-b"><td className="py-2">Business</td><td className="py-2">10,000 / month</td></tr>
              <tr><td className="py-2">Enterprise</td><td className="py-2">Unlimited</td></tr>
            </tbody>
          </table>
          <p className="text-sm text-muted-foreground">
            When you hit the limit, the API returns <code className="px-1 py-0.5 rounded bg-muted">429 Too Many Requests</code> with
            a JSON body containing the reset date.
          </p>
        </section>

        {/* Errors */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Error Handling</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Status</th>
                <th className="text-left py-2 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b"><td className="py-2"><code>400</code></td><td className="py-2">Bad request — missing file, invalid type, file too large</td></tr>
              <tr className="border-b"><td className="py-2"><code>401</code></td><td className="py-2">Unauthorized — missing or invalid API key</td></tr>
              <tr className="border-b"><td className="py-2"><code>429</code></td><td className="py-2">Rate limited — monthly quota exceeded</td></tr>
              <tr className="border-b"><td className="py-2"><code>500</code></td><td className="py-2">Server error — AI extraction failed (retry with backoff)</td></tr>
            </tbody>
          </table>
          <p className="text-sm text-muted-foreground">
            All errors return JSON: <code className="px-1 py-0.5 rounded bg-muted">{`{ "error": "message" }`}</code>
          </p>
        </section>

        {/* Code Examples */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Code Examples</h2>

          <div className="space-y-2">
            <p className="text-sm font-medium">JavaScript / Node.js</p>
            <CodeBlock code={`const fs = require('fs');
const FormData = require('form-data');

const form = new FormData();
form.append('file', fs.createReadStream('invoice.pdf'));

const res = await fetch('https://omniparse-ai.vercel.app/api/v1/extract', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer op_live_your_key_here',
    ...form.getHeaders(),
  },
  body: form,
});

const data = await res.json();
console.log(data.vendor, data.total, data.currency);`} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Python</p>
            <CodeBlock code={`import requests

with open('invoice.pdf', 'rb') as f:
    res = requests.post(
        'https://omniparse-ai.vercel.app/api/v1/extract',
        headers={'Authorization': 'Bearer op_live_your_key_here'},
        files={'file': f},
    )

data = res.json()
print(data['vendor'], data['total'], data['currency'])`} />
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-border pt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Questions? Contact <a href="mailto:damr58h@gmail.com" className="text-amber-500 hover:underline">damr58h@gmail.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group">
      <pre className="p-4 rounded-lg bg-muted/50 border border-border/50 text-xs font-mono overflow-x-auto whitespace-pre">
        {code}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
        }}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 border border-border opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
