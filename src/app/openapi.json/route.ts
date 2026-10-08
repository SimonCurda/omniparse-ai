import { NextResponse } from 'next/server';

// GET /openapi.json — OpenAPI 3.0 specification for the OmniParse REST API.
//
// This is the machine-readable API surface that AI agents use to discover
// endpoints, parameters, and response schemas automatically. Every
// operation has a unique operationId, a description, typed parameters,
// and response schemas for function-calling compatibility.

export const dynamic = 'force-static';

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'OmniParse AI REST API',
    description: 'AI-powered invoice parsing API. Upload invoices and receipts to extract structured data including vendor, dates, amounts, line items, and custom fields. Includes confidence scores, tampering detection, and validation rules.\n\nAuthentication: Pass your API key via the `X-API-Key` header. Generate a key from Settings → API Access in the dashboard.',
    version: '1.0.0',
    contact: {
      name: 'OmniParse AI',
      url: 'https://omniparse-ai.vercel.app',
      email: 'support@omniparse-ai.com',
    },
    license: {
      name: 'Proprietary',
      url: 'https://omniparse-ai.vercel.app/terms-of-service',
    },
  },
  servers: [
    {
      url: 'https://omniparse-ai.vercel.app',
      description: 'Production',
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key from Settings → API Access. Format: op_live_...',
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Session JWT from login. Browser sessions use this.',
      },
    },
    schemas: {
      Invoice: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique invoice ID (CUID)' },
          filename: { type: 'string', nullable: true, description: 'Original uploaded filename' },
          vendor: { type: 'string', nullable: true, description: 'Vendor/supplier name' },
          invNumber: { type: 'string', nullable: true, description: 'Invoice number' },
          invDate: { type: 'string', nullable: true, description: 'Invoice date (raw text)' },
          dueDate: { type: 'string', nullable: true, description: 'Due date (raw text)' },
          amount: { type: 'number', nullable: true, description: 'Subtotal amount' },
          vatAmount: { type: 'number', nullable: true, description: 'VAT/tax amount' },
          total: { type: 'number', nullable: true, description: 'Total amount' },
          currency: { type: 'string', description: 'ISO 4217 currency code', example: 'EUR' },
          status: { type: 'string', enum: ['pending', 'review', 'done'], description: 'Processing status' },
          isDuplicate: { type: 'boolean', description: 'Whether a duplicate was detected' },
          confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Overall extraction confidence (0-1)' },
          lifecycleStatus: { type: 'string', description: 'Workflow status (pending, approved, exported, etc.)' },
          approvalStatus: { type: 'string', description: 'Approval workflow status' },
          validationStatus: { type: 'string', enum: ['pass', 'warning', 'fail', 'pending'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          labels: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    color: { type: 'string', enum: ['amber', 'blue', 'emerald', 'red', 'purple', 'pink'] },
                  },
                },
              },
            },
          },
        },
      },
      Label: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', description: 'Display name' },
          color: { type: 'string', enum: ['amber', 'blue', 'emerald', 'red', 'purple', 'pink'] },
          usageCount: { type: 'integer', description: 'Number of invoices with this label' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Human-readable error message' },
          code: { type: 'string', description: 'Machine-readable error code', example: 'UNAUTHORIZED' },
        },
      },
      Usage: {
        type: 'object',
        properties: {
          plan: { type: 'string', enum: ['free', 'pro', 'plus', 'business', 'enterprise'] },
          monthlyParseCount: { type: 'integer', description: 'Invoices parsed this month' },
          monthlyParseLimit: { type: 'integer', description: 'Plan limit per month' },
          remaining: { type: 'integer', description: 'Remaining parses this month' },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
  paths: {
    '/api/parse': {
      post: {
        operationId: 'parseInvoice',
        summary: 'Parse an invoice file',
        description: 'Upload an invoice file (PDF, JPG, PNG, WebP) and receive AI-extracted structured data. The response includes vendor, dates, amounts, line items, confidence scores, and validation results. Consumes the monthly parse quota.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Invoice file (PDF, JPG, PNG, WebP, max 10MB)',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Invoice parsed successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Invoice' },
              },
            },
          },
          '401': { description: 'Unauthorized — invalid or missing API key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '429': { description: 'Rate limit or monthly parse limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/invoices': {
      get: {
        operationId: 'listInvoices',
        summary: 'List all invoices',
        description: 'Returns all invoices belonging to the authenticated user, newest first. Each invoice includes labels, validation status, and lifecycle status.',
        responses: {
          '200': {
            description: 'Array of invoices',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Invoice' } },
              },
            },
          },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/invoices/{id}': {
      get: {
        operationId: 'getInvoice',
        summary: 'Get a single invoice',
        description: 'Returns the full invoice record including line items, validation results, and labels.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Invoice ID' },
        ],
        responses: {
          '200': { description: 'Invoice found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Invoice' } } } },
          '404': { description: 'Invoice not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      patch: {
        operationId: 'updateInvoice',
        summary: 'Update invoice lifecycle status',
        description: 'Update the lifecycle status of an invoice (e.g. pending → approved → exported).',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Invoice ID' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', description: 'New lifecycle status', example: 'approved' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Invoice updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Invoice' } } } },
          '404': { description: 'Invoice not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/invoices/{id}/labels': {
      get: {
        operationId: 'getInvoiceLabels',
        summary: 'List labels attached to an invoice',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Invoice ID' },
        ],
        responses: {
          '200': { description: 'Array of labels', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Label' } } } } },
        },
      },
      post: {
        operationId: 'assignLabelToInvoice',
        summary: 'Attach a label to an invoice',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Invoice ID' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  labelId: { type: 'string', description: 'ID of the label to attach' },
                },
                required: ['labelId'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Label attached', content: { 'application/json': { schema: { $ref: '#/components/schemas/Label' } } } },
        },
      },
    },
    '/api/labels': {
      get: {
        operationId: 'listLabels',
        summary: 'List all labels',
        description: 'Returns all labels belonging to the authenticated user, with usage counts.',
        responses: {
          '200': { description: 'Array of labels', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Label' } } } } },
        },
      },
      post: {
        operationId: 'createLabel',
        summary: 'Create a new label',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Label name (max 50 chars)', example: 'Urgent' },
                  color: { type: 'string', enum: ['amber', 'blue', 'emerald', 'red', 'purple', 'pink'], default: 'amber' },
                },
                required: ['name'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Label created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Label' } } } },
          '409': { description: 'Label name already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/usage': {
      get: {
        operationId: 'getUsage',
        summary: 'Get current usage and plan limits',
        description: 'Returns the authenticated user\'s current monthly parse count, plan limit, and remaining parses.',
        responses: {
          '200': { description: 'Usage data', content: { 'application/json': { schema: { $ref: '#/components/schemas/Usage' } } } },
        },
      },
    },
    '/api/auth/export-data': {
      get: {
        operationId: 'exportAllData',
        summary: 'Export all user data as JSON',
        description: 'Downloads all user data (invoices, chat history, profile, settings) as a JSON file. This is the GDPR data portability endpoint.',
        responses: {
          '200': { description: 'JSON file download', content: { 'application/json': { schema: { type: 'object' } } } },
        },
      },
    },
    '/api/health': {
      get: {
        operationId: 'healthCheck',
        summary: 'Service health check',
        description: 'Returns the service status. No authentication required.',
        security: [],
        responses: {
          '200': { description: 'Service is healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } } } },
        },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
