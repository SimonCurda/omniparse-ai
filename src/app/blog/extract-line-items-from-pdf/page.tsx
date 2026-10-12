import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'How to Extract Line Items from PDF Invoices Using AI',
  description: 'Step-by-step guide to extracting individual line items (descriptions, quantities, unit prices, totals) from PDF invoices using AI. Includes code examples, accuracy tips, and how to handle multi-page tables.',
  keywords: ['extract line items from PDF', 'invoice line item extraction', 'parse invoice table AI', 'extract invoice table PDF'],
  alternates: {
    canonical: 'https://omniparse-ai.vercel.app/blog/extract-line-items-from-pdf',
  },
  openGraph: {
    title: 'How to Extract Line Items from PDF Invoices Using AI',
    description: 'Step-by-step guide with code examples for extracting line items from PDF invoices.',
    type: 'article',
    url: 'https://omniparse-ai.vercel.app/blog/extract-line-items-from-pdf',
    publishedTime: '2026-10-08',
  },
};

export default function ExtractLineItemsArticle() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to blog
        </Link>

        <article className="prose prose-sm dark:prose-invert max-w-none">
          <h1>How to Extract Line Items from PDF Invoices Using AI</h1>
          <p className="text-muted-foreground">October 8, 2026 · 7 min read</p>

          <p>
            Extracting the invoice header (vendor, date, total) is relatively easy. But extracting individual
            <strong> line items</strong> — the table of charges with descriptions, quantities, unit prices, and
            totals — is much harder. Line items live in tables that vary wildly between vendors, span multiple
            pages, and often have inconsistent formatting. This guide shows you how to extract line items from
            PDF invoices using AI, with code examples and tips for maximum accuracy.
          </p>

          <h2>Why Line Item Extraction is Hard</h2>
          <p>Line item extraction is challenging for several reasons:</p>
          <ul>
            <li><strong>Table layout varies:</strong> Every vendor formats their line-item table differently — different columns, different order, different separators.</li>
            <li><strong>Multi-page tables:</strong> A 50-line invoice might span 3 pages, with headers repeated on each page.</li>
            <li><strong>Merged cells:</strong> Some invoices merge description cells across multiple lines.</li>
            <li><strong>No clear boundaries:</strong> The table might not have visible borders — you have to infer columns from alignment.</li>
            <li><strong>Subtotals and discounts:</strong> Subtotal rows, discount rows, and tax rows are interspersed with line items.</li>
          </ul>
          <p>
            Traditional OCR plus templates can handle this, but you need a template for every vendor — and it
            breaks when the layout changes. AI vision-language models (VLMs) solve this by understanding the
            table structure visually, the way a human does.
          </p>

          <h2>How AI Extracts Line Items</h2>
          <p>When you upload an invoice to an AI parser like OmniParse, here&apos;s what happens:</p>
          <ol>
            <li>The VLM &quot;sees&quot; the entire invoice as an image (including multi-page PDFs stitched together).</li>
            <li>A prompt instructs the AI to find the line-item table and extract each row.</li>
            <li>The AI identifies the table boundaries, skips header/subtotal rows, and extracts each line item.</li>
            <li>Each line item is returned as a JSON object with description, quantity, unit price, and total.</li>
            <li>Each field gets a confidence score so you know what to verify.</li>
          </ol>

          <h2>Code Example: Extracting Line Items with the OmniParse API</h2>
          <p>Here&apos;s how to extract line items using the OmniParse REST API:</p>

          <h3>cURL</h3>
          <pre className="bg-muted/30 rounded-lg p-4 overflow-x-auto text-xs"><code>{`curl -X POST https://omniparse-ai.vercel.app/api/parse \\
  -H "X-API-Key: op_live_your_key_here" \\
  -F "file=@invoice.pdf"`}</code></pre>

          <p>The response includes a <code>lineItems</code> array:</p>
          <pre className="bg-muted/30 rounded-lg p-4 overflow-x-auto text-xs"><code>{`{
  "vendor": "Acme Corp",
  "total": 1210.00,
  "lineItems": [
    {
      "description": "Consulting services - October",
      "quantity": 10,
      "unitPrice": 100.00,
      "total": 1000.00
    },
    {
      "description": "Travel expenses",
      "quantity": 1,
      "unitPrice": 210.00,
      "total": 210.00
    }
  ]
}`}</code></pre>

          <h3>Python</h3>
          <pre className="bg-muted/30 rounded-lg p-4 overflow-x-auto text-xs"><code>{`import requests

response = requests.post(
    "https://omniparse-ai.vercel.app/api/parse",
    headers={"X-API-Key": "op_live_your_key_here"},
    files={"file": open("invoice.pdf", "rb")}
)

invoice = response.json()

# Print each line item
for item in invoice.get("lineItems", []):
    print(f"{item['description']}")
    print(f"  Qty: {item['quantity']} x {item['unitPrice']} = {item['total']}")

# Verify line items add up to the subtotal
line_total = sum(item["total"] for item in invoice["lineItems"])
print(f"\\nLine items total: {line_total}")
print(f"Invoice subtotal: {invoice['amount']}")
print(f"Match: {line_total == invoice['amount']}")`}</code></pre>

          <h2>Tips for Maximum Accuracy</h2>

          <h3>1. Use high-quality PDFs</h3>
          <p>
            Digital PDFs (generated from software) give the best results. Scanned PDFs work too, but make sure
            the scan is at least 150 DPI and properly aligned. If the AI can&apos;t read the text, neither can a human.
          </p>

          <h3>2. Check confidence scores</h3>
          <p>
            Every line item field has a confidence score. If the overall confidence is below 85%, review the
            extraction manually. OmniParse shows per-field confidence so you know exactly which items need attention.
          </p>

          <h3>3. Validate line items add up</h3>
          <p>
            Always verify that the sum of line item totals equals the invoice subtotal. If they don&apos;t match,
            the AI may have missed a row or extracted a quantity/price incorrectly. This is a simple check that
            catches most extraction errors:
          </p>
          <pre className="bg-muted/30 rounded-lg p-4 overflow-x-auto text-xs"><code>{`line_total = sum(item["total"] for item in invoice["lineItems"])
expected = invoice["amount"]  # subtotal
if abs(line_total - expected) > 0.01:
    print("WARNING: Line items don't match subtotal!")`}</code></pre>

          <h3>4. Handle multi-page invoices</h3>
          <p>
            For multi-page PDFs, the AI automatically stitches pages together and extracts all line items across
            all pages. You don&apos;t need to split the PDF manually. However, if a single invoice has 50+ line
            items, consider splitting it to improve accuracy — very long tables can occasionally cause the AI
            to skip rows.
          </p>

          <h3>5. Use custom validation rules</h3>
          <p>
            OmniParse Pro and above let you define custom validation rules. For example, you can create a rule
            that flags any line item with a quantity above 100 or a unit price above $10,000 for manual review.
            This catches outliers that might be extraction errors.
          </p>

          <h2>Exporting Line Items</h2>
          <p>
            Once extracted, you can export line items in multiple formats:
          </p>
          <ul>
            <li><strong>CSV/Excel:</strong> Each line item is a row, with columns for description, quantity, unit price, and total.</li>
            <li><strong>JSON:</strong> Full structured data including line items array.</li>
            <li><strong>PDF:</strong> Formatted report with line item table.</li>
          </ul>
          <p>
            On Plus and above, you can create custom export templates that map line item fields to your
            accounting system&apos;s format (e.g., QuickBooks, Xero, SAP).
          </p>

          <h2>Conclusion</h2>
          <p>
            Extracting line items from PDF invoices is one of the hardest parts of invoice automation, but AI
            vision-language models make it reliable without templates. With the OmniParse API, you can extract
            line items programmatically in a few lines of code, with confidence scores and validation to catch
            errors. Start free with 15 invoices per month — no credit card required.
          </p>

          <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 not-prose">
            <h3 className="font-semibold mb-2">Extract line items from your invoices</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Try OmniParse free — upload an invoice and see the line items extracted with confidence scores.
            </p>
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-amber-600 hover:underline">
              Get started free →
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
