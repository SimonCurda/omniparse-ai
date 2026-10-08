import { NextResponse } from 'next/server';
export const dynamic = 'force-static';
const content = `# OmniParse AI

> AI-powered invoice and receipt parsing service. Upload documents (PDF, JPG, PNG, WebP) and extract structured data as JSON with confidence scores, tampering detection, and a REST API.

## When to use

Use OmniParse when an agent needs to:
- Extract structured data (vendor, dates, amounts, line items) from invoices or receipts
- Validate invoice data against business rules before processing
- Detect tampered or fraudulent PDF documents
- Build automated accounts-payable workflows with approval rules
- Query invoice data programmatically via REST API
- Import invoices from email attachments automatically
- Export invoice data in CSV, JSON, Excel, or PDF format

Do NOT use OmniParse for:
- General document OCR (use a dedicated OCR tool)
- Non-invoice documents (contracts, forms, ID cards)
- Real-time payment processing

## API Access

The REST API is available on all plans (including Free). Authentication uses the X-API-Key header.

1. Generate an API key from Settings → API Access in the dashboard
2. Pass it with every request: X-API-Key: op_live_...
3. All endpoints return JSON

Rate limits: 60 requests/minute per IP (general), 5/minute for auth endpoints.

## Documentation

- [API Documentation](https://omniparse-ai.vercel.app/api-docs)
- [OpenAPI Specification](https://omniparse-ai.vercel.app/openapi.json)
- [API Tester](https://omniparse-ai.vercel.app/api-test)
- [Sitemap](https://omniparse-ai.vercel.app/sitemap.xml)
- [Blog](https://omniparse-ai.vercel.app/blog)
- [Comparison](https://omniparse-ai.vercel.app/compare)

## Key Endpoints

- POST /api/parse — Upload an invoice file and get AI-extracted JSON
- GET /api/invoices — List all invoices
- GET /api/invoices/{id} — Get a single invoice with full details
- PATCH /api/invoices/{id} — Update invoice lifecycle status
- GET /api/labels — List all labels
- POST /api/labels — Create a new label
- GET /api/usage — Get current usage and plan limits
- GET /api/auth/export-data — Export all data as JSON (GDPR)

## Pricing

- Free: 15 invoices/month, REST API access
- Pro ($49/mo): 500 invoices/month, editing, JSON/Excel export
- Plus ($99/mo): 2,000 invoices/month, approval workflows, audit trail
- Business ($199/mo): 10,000 invoices/month, multi-entity
- Enterprise ($499/mo): Unlimited

## Legal

- [Privacy Policy](https://omniparse-ai.vercel.app/privacy-policy)
- [Terms of Service](https://omniparse-ai.vercel.app/terms-of-service)
- [Cookie Policy](https://omniparse-ai.vercel.app/cookie-policy)
- [AI Act Notice](https://omniparse-ai.vercel.app/ai-act-notice)

## Contact

- Website: https://omniparse-ai.vercel.app
- Support: support@omniparse-ai.com
`;
export async function GET() {
  return new NextResponse(content, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
