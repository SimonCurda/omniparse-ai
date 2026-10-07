'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Upload, Loader2, Play, Eye, EyeOff, Copy, Check,
  FileJson, Trash2, FlaskConical, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── API Tester page ──────────────────────────────────────────────────────
//
// A standalone, fully-isolated playground for testing the REST API.
// "Fully isolated" means:
//   - Does NOT read op_token from localStorage (no dashboard session sharing)
//   - Only uses the API key the user pastes into the input field
//   - Has its own layout (no dashboard shell, no navbar)
//   - All requests go directly to /api/* with X-API-Key header
//
// Workflow:
//   1. Pick an endpoint (POST /api/parse, GET /api/invoices, etc.)
//   2. Paste your API key (from Settings → API Access)
//   3. For POST /api/parse: upload an invoice file
//   4. Click "Send Request"
//   5. See the raw JSON response (status, time, body)
//
// Accessible from the admin panel toolbar. A "Back to Admin" button is
// always visible at the top so you're never stranded on this page.

type EndpointDef = {
  method: 'GET' | 'POST';
  path: string;
  label: string;
  description: string;
  requiresFile: boolean;
};

const ENDPOINTS: EndpointDef[] = [
  {
    method: 'POST',
    path: '/api/parse',
    label: 'Parse Invoice',
    description: 'Upload an invoice file (PDF, JPG, PNG, WebP) and get the AI-extracted data back as JSON.',
    requiresFile: true,
  },
  {
    method: 'GET',
    path: '/api/invoices',
    label: 'List Invoices',
    description: 'List all your invoices, newest first. Returns an array of invoice objects.',
    requiresFile: false,
  },
  {
    method: 'GET',
    path: '/api/labels',
    label: 'List Labels',
    description: 'List all your labels with usage counts.',
    requiresFile: false,
  },
  {
    method: 'GET',
    path: '/api/usage',
    label: 'Get Usage',
    description: 'Get your current monthly parse count and limit.',
    requiresFile: false,
  },
  {
    method: 'GET',
    path: '/api/auth/export-data',
    label: 'Export All Data',
    description: 'Download all your data as JSON (GDPR data portability).',
    requiresFile: false,
  },
];

interface ResponseState {
  status: number;
  statusText: string;
  durationMs: number;
  body: string;
  ok: boolean;
}

export default function ApiTestPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDef>(ENDPOINTS[0]);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResponse(null);
  };

  const handleEndpointChange = (ep: EndpointDef) => {
    setSelectedEndpoint(ep);
    setResponse(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendRequest = async () => {
    if (!apiKey.trim()) {
      toast.error('Please paste your API key first.');
      return;
    }
    if (selectedEndpoint.requiresFile && !file) {
      toast.error('Please select a file to upload.');
      return;
    }

    setLoading(true);
    setResponse(null);
    const startTime = Date.now();

    try {
      let res: Response;
      const headers: Record<string, string> = {
        'X-API-Key': apiKey.trim(),
      };

      if (selectedEndpoint.method === 'POST' && selectedEndpoint.requiresFile) {
        const formData = new FormData();
        formData.append('file', file as File);
        res = await fetch(selectedEndpoint.path, {
          method: 'POST',
          headers,
          body: formData,
        });
      } else {
        res = await fetch(selectedEndpoint.path, { method: selectedEndpoint.method, headers });
      }

      const durationMs = Date.now() - startTime;
      const text = await res.text();

      // Try to pretty-print JSON. If it's not JSON, show the raw text.
      let body = text;
      try {
        const json = JSON.parse(text);
        body = JSON.stringify(json, null, 2);
      } catch {
        // not JSON — keep raw text
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        durationMs,
        body,
        ok: res.ok,
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      setResponse({
        status: 0,
        statusText: 'Network Error',
        durationMs,
        body: err instanceof Error ? err.message : String(err),
        ok: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = async () => {
    if (!response) return;
    try {
      await navigator.clipboard.writeText(response.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Response copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const clearAll = () => {
    setResponse(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const statusColor = (status: number) => {
    if (status === 0) return 'text-red-500 bg-red-500/10';
    if (status < 300) return 'text-emerald-500 bg-emerald-500/10';
    if (status < 400) return 'text-blue-500 bg-blue-500/10';
    if (status < 500) return 'text-amber-500 bg-amber-500/10';
    return 'text-red-500 bg-red-500/10';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header — sticky so the Back to Admin button is always reachable */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <FlaskConical className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-sm">API Tester</h1>
              <p className="text-xs text-muted-foreground">Standalone playground — fully isolated from the dashboard</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/50 transition-colors"
            title="Back to Admin Dashboard"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Admin
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Endpoint selector */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <label className="text-sm font-medium">Endpoint</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ENDPOINTS.map((ep) => (
              <button
                key={ep.method + ep.path}
                onClick={() => handleEndpointChange(ep)}
                className={`text-left p-3 rounded-lg border transition-all ${
                  selectedEndpoint.path === ep.path && selectedEndpoint.method === ep.method
                    ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/20'
                    : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    ep.method === 'GET' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {ep.method}
                  </span>
                  <span className="text-xs font-mono font-medium truncate">{ep.path}</span>
                </div>
                <p className="text-xs text-muted-foreground">{ep.label}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-1">{selectedEndpoint.description}</p>
        </div>

        {/* API key input */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <label className="text-sm font-medium">API Key</label>
          <p className="text-xs text-muted-foreground">
            Generate one from <strong>Settings → API Access</strong> in the dashboard. It looks like <code className="px-1 py-0.5 rounded bg-muted text-[11px]">op_live_…</code>
          </p>
          <div className="flex items-center gap-2">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="op_live_..."
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={() => setShowApiKey((v) => !v)}
              className="p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors shrink-0"
              title={showApiKey ? 'Hide' : 'Show'}
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              onClick={() => {
                setApiKey('');
                setResponse(null);
              }}
              className="p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors shrink-0"
              title="Clear"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* File upload — only for endpoints that require a file */}
        {selectedEndpoint.requiresFile && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <label className="text-sm font-medium">Invoice File</label>
            <p className="text-xs text-muted-foreground">
              Accepted: PDF, JPG, PNG, WebP. Max 10 MB.
            </p>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-amber-500', 'bg-amber-500/5'); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('border-amber-500', 'bg-amber-500/5'); }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-amber-500', 'bg-amber-500/5');
                const f = e.dataTransfer.files?.[0];
                if (f) {
                  setFile(f);
                  setResponse(null);
                }
              }}
              className="cursor-pointer rounded-lg border-2 border-dashed border-border p-8 text-center hover:border-amber-500/50 hover:bg-muted/30 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <FileJson className="h-5 w-5 text-amber-500" />
                  </div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Click to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Click to upload or drag & drop</p>
                  <p className="text-xs text-muted-foreground">PDF, JPG, PNG, WebP up to 10 MB</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Send button */}
        <div className="flex items-center gap-3">
          <button
            onClick={sendRequest}
            disabled={loading || !apiKey.trim() || (selectedEndpoint.requiresFile && !file)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {loading ? 'Sending...' : 'Send Request'}
          </button>
          {response && (
            <button
              onClick={clearAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors"
            >
              <Trash2 className="h-4 w-4" /> Clear
            </button>
          )}
        </div>

        {/* Response panel */}
        {response && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs font-bold ${statusColor(response.status)}`}>
                  {response.status === 0 ? 'ERR' : response.status} {response.statusText}
                </span>
                <span className="text-xs text-muted-foreground">{response.durationMs} ms</span>
              </div>
              <button
                onClick={copyResponse}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-muted transition-colors"
                title="Copy response"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Error banner with Back to Admin button */}
            {!response.ok && (
              <div className="px-4 py-3 bg-red-500/5 border-b border-red-500/20">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                      Request failed
                      {response.status === 401 && ' — check your API key'}
                      {response.status === 403 && ' — account may be frozen'}
                      {response.status === 404 && ' — endpoint or resource not found'}
                      {response.status === 429 && ' — rate limit exceeded'}
                      {response.status >= 500 && ' — server error'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      If this persists, return to the admin panel and verify your API key is valid.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push('/admin')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/50 transition-colors shrink-0"
                  >
                    <ArrowLeft className="h-3 w-3" /> Back to Admin
                  </button>
                </div>
              </div>
            )}

            {/* Raw JSON body */}
            <div className="max-h-[600px] overflow-auto">
              <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
                {response.body || '(empty response body)'}
              </pre>
            </div>
          </div>
        )}

        {/* Empty state hint */}
        {!response && !loading && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
            <FlaskConical className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm font-medium">Ready to test</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {selectedEndpoint.requiresFile
                ? 'Paste your API key, upload an invoice file, and click "Send Request" to see the raw JSON output.'
                : 'Paste your API key and click "Send Request" to see the raw JSON output.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
