import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Free Invoice OCR API: How to Extract Invoice Data Programmatically for Free',
  description: 'Complete guide to using a free invoice OCR API. Compare free tiers from OmniParse, Parseur, Nanonets, and Docparser. Includes code examples for extracting vendor, amounts, and line items via REST API.',
  keywords: ['free invoice OCR API', 'invoice parsing API', 'extract invoice data API', 'invoice OCR free tier'],
  alternates: {
    canonical: 'https://omniparse-ai.vercel.app/blog/free-invoice-ocr-api',
  },
  openGraph: {
    title: 'Free Invoice OCR API: How to Extract Invoice Data Programmatically for Free',
    description: 'Compare free invoice OCR APIs and see code examples for extracting invoice data via REST.',
    type: 'article',
    url: 'https://omniparse-ai.vercel.app/blog/free-invoice-ocr-api',
    publishedTime: '2026-10-08',
  },
};

export default function FreeInvoiceOcrApiArticle() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to blog
        </Link>

        <article className="prose prose-sm dark:prose-invert max-w-none">
          <h1>Free Invoice OCR API: How to Extract Invoice Data Programmatically for Free</h1>
          <p className="text-muted-foreground">October 8, 2026 · 6 min read</p>

          <p>
            If you&apos;re building an app that needs to process invoices, you need an invoice OCR API that can
            extract structured data from PDFs and images. The good news: several providers offer free tiers that
            are generous enough for testing, small projects, and even light production use. This guide compares
            the best free invoice OCR APIs and shows you how to use one with code examples.
          </p>

          <h2>Free Invoice OCR API Comparison</h2>
          <p>Here&apos;s how the top invoice parsing APIs compare on their free tiers:</p>
          <div className="overflow-x-auto not-prose my-6">
            <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Provider</th>
                  <th className="text-left p-3 font-medium">Free Tier</th>
                  <th className="text-left p-3 font-medium">API Access</th>
                  <th className="text-left p-3 font-medium">AI-Based</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="p-3 font-semibold text-amber-500">OmniParse</td>
                  <td className="p-3">15 invoices/month</td>
                  <td className="p-3">Yes (X-API-Key)</td>
                  <td className="p-3">Yes (VLM)</td>
                </tr>
                <tr className="border-t border-border bg-muted/20">
                  <td className="p-3">Parseur</td>
                  <td className="p-3">20 pages/month</td>
                  <td className="p-3">Yes</td>
                  <td className="p-3">Yes</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="p-3">Nanonets</td>
                  <td className="p-3">$200 trial credits</td>
                  <td className="p-3">Yes</td>
                  <td className="p-3">Yes</td>
                </tr>
                <tr className="border-t border-border bg-muted/20">
                  <td className="p-3">Docparser</td>
                  <td className="p-3">20 documents/month</td>
                  <td className="p-3">Yes</td>
                  <td className="p-3">No (templates)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            OmniParse stands out because it offers AI-based extraction (not templates), per-field confidence
            scores, tampering detection, and a full REST API with OpenAPI specification — all on the free tier.
            For a detailed feature comparison, see our <Link href="/compare">OmniParse vs Parseur vs Nanonets vs Docparser</Link> page.
          </p>

          <h2>How to Use the OmniParse Invoice OCR API</h2>
          <p>Here&apos;s a complete example of how to parse an invoice using the OmniParse REST API:</p>

          <h3>Step 1: Get your API key</h3>
          <p>
            Sign up for a free account at <Link href="/">omniparse-ai.vercel.app</Link>, then go to
            Settings → API Access to generate your API key. It looks like <code>op_live_...</code>
          </p>

          <h3>Step 2: Upload and parse an invoice</h3>
          <p>Use <code>curl</code> to upload an invoice file and get structured JSON back:</p>
          <pre className="bg-muted/30 rounded-lg p-4 overflow-x-auto text-xs"><code>{`curl -X POST https://omniparse-ai.vercel.app/api/parse \\
  -H "X-API-Key: op_live_your_key_here" \\
  -F "file=@invoice.pdf"`}</code></pre>

          <p>The response is a JSON object with all extracted fields:</p>
          <pre className="bg-muted/30 rounded-lg p-4 overflow-x-auto text-xs"><code>{`{
  "id": "ck...",
  "vendor": "Acme Corp",
  "invNumber": "INV-2026-001",
  "invDate": "2026-10-01",
  "dueDate": "2026-10-31",
  "amount": 1000.00,
  "vatAmount": 210.00,
  "total": 1210.00,
  "currency": "EUR",
  "confidence": 0.95,
  "lineItems": [
    { "description": "Consulting services", "quantity": 10, "unitPrice": 100, "total": 1000 }
  ]
}`}</code></pre>

          <h3>Step 3: List all parsed invoices</h3>
          <pre className="bg-muted/30 rounded-lg p-4 overflow-x-auto text-xs"><code>{`curl https://omniparse-ai.vercel.app/api/invoices \\
  -H "X-API-Key: op_live_your_key_here"`}</code></pre>

          <h3>Python example</h3>
          <pre className="bg-muted/30 rounded-lg p-4 overflow-x-auto text-xs"><code>{`import requests

API_KEY = "op_live_your_key_here"
BASE_URL = "https://omniparse-ai.vercel.app"

# Parse an invoice
with open("invoice.pdf", "rb") as f:
    response = requests.post(
        BASE_URL + "/api/parse",
        headers={"X-API-Key": API_KEY},
        files={"file": f}
    )

invoice = response.json()
print("Vendor:", invoice["vendor"])
print("Total:", invoice["total"], invoice["currency"])
print("Confidence:", invoice["confidence"]*100, "%")`}</code></pre>

          <h3>JavaScript example</h3>
          <pre className="bg-muted/30 rounded-lg p-4 overflow-x-auto text-xs"><code>{`const API_KEY = "op_live_your_key_here";
const BASE_URL = "https://omniparse-ai.vercel.app";

// Parse an invoice
const formData = new FormData();
formData.append("file", fileInput.files[0]);

const response = await fetch(BASE_URL + "/api/parse", {
  method: "POST",
  headers: { "X-API-Key": API_KEY },
  body: formData
});

const invoice = await response.json();
console.log("Vendor: " + invoice.vendor);
console.log("Total: " + invoice.total + " " + invoice.currency);`}</code></pre>

          <h2>Authentication</h2>
          <p>
            The OmniParse API uses a simple API key authentication. Pass your API key in the
            <code>X-API-Key</code> header with every request. The key is tied to your account and respects
            your plan&apos;s monthly invoice limit.
          </p>

          <h2>Rate Limits</h2>
          <ul>
            <li>60 requests per minute per IP (general API)</li>
            <li>5 login attempts per minute (auth endpoints)</li>
            <li>15 invoices per month on the Free plan</li>
          </ul>
          <p>
            Rate-limited requests return <code>429 Too Many Requests</code>. When you hit the monthly invoice
            limit, you get <code>429</code> with <code>code: "MONTHLY_LIMIT_REACHED"</code>.
          </p>

          <h2>Full API Documentation</h2>
          <p>
            For the complete API reference with all endpoints, parameters, and response schemas, see our
            <Link href="/api-docs">API Documentation</Link>. The full OpenAPI 3.0 specification is available at
            <Link href="/openapi.json">/openapi.json</Link> — you can import it into Postman, Swagger, or any
            API client. There&apos;s also an interactive <Link href="/api-test">API Tester</Link> where you
            can try the API without writing code.
          </p>

          <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 not-prose">
            <h3 className="font-semibold mb-2">Start parsing invoices for free</h3>
            <p className="text-sm text-muted-foreground mb-3">
              15 invoices per month, full REST API access, no credit card required.
            </p>
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-amber-600 hover:underline">
              Get your free API key →
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
