import { NextResponse } from 'next/server';
export const dynamic = 'force-static';
const manifest = {
  mcp: {
    server: {
      name: 'omniparse-ai',
      version: '1.0.0',
      description: 'AI-powered invoice parsing service. Upload invoices and receipts to extract structured data including vendor, dates, amounts, line items, and custom fields.',
      url: 'https://omniparse-ai.vercel.app',
      transport: 'streamable-http',
      endpoint: 'https://omniparse-ai.vercel.app/.well-known/mcp',
    },
    authentication: {
      type: 'api-key',
      header: 'X-API-Key',
      description: 'Generate an API key from Settings → API Access in the dashboard. Pass it via the X-API-Key header.',
      docs: 'https://omniparse-ai.vercel.app/api-docs',
    },
    tools: [
      { name: 'parse_invoice', description: 'Upload an invoice file and extract structured data.', inputSchema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] }, endpoint: 'POST /api/parse' },
      { name: 'list_invoices', description: 'List all invoices.', inputSchema: { type: 'object', properties: {} }, endpoint: 'GET /api/invoices' },
      { name: 'get_invoice', description: 'Get a single invoice by ID.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, endpoint: 'GET /api/invoices/{id}' },
      { name: 'update_invoice_status', description: 'Update the lifecycle status of an invoice.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' } }, required: ['id', 'status'] }, endpoint: 'PATCH /api/invoices/{id}' },
      { name: 'list_labels', description: 'List all labels.', inputSchema: { type: 'object', properties: {} }, endpoint: 'GET /api/labels' },
      { name: 'create_label', description: 'Create a new label.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, color: { type: 'string', enum: ['amber', 'blue', 'emerald', 'red', 'purple', 'pink'] } }, required: ['name'] }, endpoint: 'POST /api/labels' },
      { name: 'get_usage', description: 'Get current usage and plan limits.', inputSchema: { type: 'object', properties: {} }, endpoint: 'GET /api/usage' },
    ],
    resources: [
      { uri: 'https://omniparse-ai.vercel.app/openapi.json', name: 'OpenAPI Specification', description: 'Full OpenAPI 3.0 spec', mimeType: 'application/json' },
      { uri: 'https://omniparse-ai.vercel.app/llms.txt', name: 'Agent Instructions', description: 'llms.txt with when-to-use guidance', mimeType: 'text/plain' },
      { uri: 'https://omniparse-ai.vercel.app/api-docs', name: 'API Documentation', description: 'Human-readable API docs', mimeType: 'text/html' },
    ],
  },
};
export async function GET() {
  return NextResponse.json(manifest, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' } });
}
