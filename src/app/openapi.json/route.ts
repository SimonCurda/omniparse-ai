import { NextResponse } from 'next/server';
export const dynamic = 'force-static';
const spec = {
  openapi: '3.0.3',
  info: {
    title: 'OmniParse AI REST API',
    description: 'AI-powered invoice parsing API. Upload invoices to extract structured data. Auth: X-API-Key header.',
    version: '1.0.0',
    contact: { name: 'OmniParse AI', url: 'https://omniparse-ai.vercel.app', email: 'support@omniparse-ai.com' },
  },
  servers: [{ url: 'https://omniparse-ai.vercel.app', description: 'Production' }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'API key from Settings → API Access. Format: op_live_...' },
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Invoice: {
        type: 'object',
        properties: {
          id: { type: 'string' }, filename: { type: 'string', nullable: true },
          vendor: { type: 'string', nullable: true }, invNumber: { type: 'string', nullable: true },
          invDate: { type: 'string', nullable: true }, dueDate: { type: 'string', nullable: true },
          amount: { type: 'number', nullable: true }, vatAmount: { type: 'number', nullable: true },
          total: { type: 'number', nullable: true }, currency: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'review', 'done'] },
          isDuplicate: { type: 'boolean' }, confidence: { type: 'number', minimum: 0, maximum: 1 },
          lifecycleStatus: { type: 'string' }, approvalStatus: { type: 'string' },
          validationStatus: { type: 'string', enum: ['pass', 'warning', 'fail', 'pending'] },
          createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Label: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, color: { type: 'string' }, usageCount: { type: 'integer' } } },
      Error: { type: 'object', properties: { error: { type: 'string' }, code: { type: 'string' } } },
      Usage: { type: 'object', properties: { plan: { type: 'string' }, monthlyParseCount: { type: 'integer' }, monthlyParseLimit: { type: 'integer' }, remaining: { type: 'integer' } } },
    },
  },
  security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
  paths: {
    '/api/parse': { post: { operationId: 'parseInvoice', summary: 'Parse an invoice file', description: 'Upload an invoice file (PDF, JPG, PNG, WebP) and receive AI-extracted structured data.', requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { '200': { description: 'Invoice parsed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Invoice' } } } }, '401': { description: 'Unauthorized' }, '429': { description: 'Rate limit exceeded' } } } },
    '/api/invoices': { get: { operationId: 'listInvoices', summary: 'List all invoices', description: 'Returns all invoices newest first.', responses: { '200': { description: 'Array of invoices', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Invoice' } } } } } } } },
    '/api/invoices/{id}': { get: { operationId: 'getInvoice', summary: 'Get a single invoice', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Invoice found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Invoice' } } } }, '404': { description: 'Not found' } } }, patch: { operationId: 'updateInvoice', summary: 'Update invoice lifecycle status', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } } }, responses: { '200': { description: 'Updated' } } } },
    '/api/invoices/{id}/labels': { get: { operationId: 'getInvoiceLabels', summary: 'List labels on an invoice', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Array of labels' } } }, post: { operationId: 'assignLabelToInvoice', summary: 'Attach a label', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { labelId: { type: 'string' } }, required: ['labelId'] } } } }, responses: { '201': { description: 'Label attached' } } } },
    '/api/labels': { get: { operationId: 'listLabels', summary: 'List all labels', responses: { '200': { description: 'Array of labels' } } }, post: { operationId: 'createLabel', summary: 'Create a new label', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, color: { type: 'string', enum: ['amber', 'blue', 'emerald', 'red', 'purple', 'pink'] } }, required: ['name'] } } } }, responses: { '201': { description: 'Label created' } } } },
    '/api/usage': { get: { operationId: 'getUsage', summary: 'Get current usage and plan limits', responses: { '200': { description: 'Usage data', content: { 'application/json': { schema: { $ref: '#/components/schemas/Usage' } } } } } } },
    '/api/auth/export-data': { get: { operationId: 'exportAllData', summary: 'Export all user data as JSON (GDPR)', responses: { '200': { description: 'JSON file download' } } } },
    '/api/health': { get: { operationId: 'healthCheck', summary: 'Service health check', security: [], responses: { '200': { description: 'Healthy' } } } },
  },
};
export async function GET() {
  return NextResponse.json(spec, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' } });
}
