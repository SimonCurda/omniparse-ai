import { NextResponse } from 'next/server';

// GET /.well-known/mcp — MCP (Model Context Protocol) server manifest.
//
// This manifest tells AI agents (Claude, ChatGPT, etc.) that OmniParse
// exposes its API as tools that can be called natively via MCP.
// The manifest follows the MCP server discovery format.
//
// Note: This is a manifest/declaration only. A full MCP server with
// Streamable HTTP transport would require a separate endpoint that
// implements the MCP JSON-RPC protocol. This manifest publishes the
// tool surface so agents know what's available.

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
      {
        name: 'parse_invoice',
        description: 'Upload an invoice file (PDF, JPG, PNG, WebP) and extract structured data including vendor, dates, amounts, line items, and confidence scores.',
        inputSchema: {
          type: 'object',
          properties: {
            file: { type: 'string', format: 'binary', description: 'Invoice file to parse' },
          },
          required: ['file'],
        },
        endpoint: 'POST /api/parse',
      },
      {
        name: 'list_invoices',
        description: 'List all invoices belonging to the authenticated user, newest first.',
        inputSchema: { type: 'object', properties: {} },
        endpoint: 'GET /api/invoices',
      },
      {
        name: 'get_invoice',
        description: 'Get a single invoice by ID, including line items, validation results, and labels.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Invoice ID' },
          },
          required: ['id'],
        },
        endpoint: 'GET /api/invoices/{id}',
      },
      {
        name: 'update_invoice_status',
        description: 'Update the lifecycle status of an invoice (e.g. pending → approved → exported).',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Invoice ID' },
            status: { type: 'string', description: 'New lifecycle status' },
          },
          required: ['id', 'status'],
        },
        endpoint: 'PATCH /api/invoices/{id}',
      },
      {
        name: 'list_labels',
        description: 'List all labels belonging to the authenticated user, with usage counts.',
        inputSchema: { type: 'object', properties: {} },
        endpoint: 'GET /api/labels',
      },
      {
        name: 'create_label',
        description: 'Create a new label with a name and color.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Label name (max 50 chars)' },
            color: { type: 'string', enum: ['amber', 'blue', 'emerald', 'red', 'purple', 'pink'] },
          },
          required: ['name'],
        },
        endpoint: 'POST /api/labels',
      },
      {
        name: 'get_usage',
        description: 'Get the current monthly parse count, plan limit, and remaining parses.',
        inputSchema: { type: 'object', properties: {} },
        endpoint: 'GET /api/usage',
      },
    ],
    resources: [
      {
        uri: 'https://omniparse-ai.vercel.app/openapi.json',
        name: 'OpenAPI Specification',
        description: 'Full OpenAPI 3.0 specification for the OmniParse REST API',
        mimeType: 'application/json',
      },
      {
        uri: 'https://omniparse-ai.vercel.app/llms.txt',
        name: 'Agent Instructions',
        description: 'llms.txt file with when-to-use guidance for AI agents',
        mimeType: 'text/plain',
      },
      {
        uri: 'https://omniparse-ai.vercel.app/api-docs',
        name: 'API Documentation',
        description: 'Human-readable API documentation with examples',
        mimeType: 'text/html',
      },
    ],
  },
};

export async function GET() {
  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
