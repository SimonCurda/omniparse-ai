'use client';

import { useState, useCallback } from 'react';

// ─── Local API Test Page ──────────────────────────────────────────────────
// Test the OmniParse API without curl.
// Upload a file, enter your API key, click "Extract", see the JSON result.
//
// Access at: /api-test

export default function ApiTestPage() {
  const [apiKey, setApiKey] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState(true);
  const [showKey, setShowKey] = useState(false);

  const handleExtract = useCallback(async () => {
    if (!apiKey.trim()) {
      setError('Please enter your API key');
      return;
    }
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('store', store ? 'true' : 'false');

      const res = await fetch('/api/v1/extract', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || `Request failed with status ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [apiKey, file, store]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setResult(null);
      setError(null);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <span className="text-black font-bold text-sm">OP</span>
            </div>
            <h1 className="text-2xl font-bold">OmniParse API Tester</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Test the extraction API right here. Upload an invoice, enter your API key, and see the structured JSON result.
          </p>
        </div>

        {/* API Key Input */}
        <div className="rounded-lg border border-border p-4 space-y-2">
          <label className="text-sm font-medium flex items-center justify-between">
            API Key
            <button
              onClick={() => setShowKey(!showKey)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </label>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="op_live_..."
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Generate a key in Settings → Developer API
          </p>
        </div>

        {/* File Upload */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="rounded-lg border-2 border-dashed border-border p-8 text-center hover:border-amber-500/50 transition-colors cursor-pointer"
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setResult(null);
                setError(null);
              }
            }}
            className="hidden"
          />
          {file ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB · {file.type || 'unknown type'}
              </p>
              <p className="text-xs text-amber-500 mt-2">Click to change file</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">Drop a file here or click to browse</p>
              <p className="text-xs text-muted-foreground">PDF, JPEG, PNG, or WebP · max 10MB</p>
            </div>
          )}
        </div>

        {/* Options */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="store"
            checked={store}
            onChange={(e) => setStore(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="store" className="text-sm text-muted-foreground">
            Save to my account (store=true). Uncheck for stateless extraction.
          </label>
        </div>

        {/* Extract Button */}
        <button
          onClick={handleExtract}
          disabled={loading || !apiKey.trim() || !file}
          className="w-full py-3 rounded-lg bg-amber-500 text-black font-semibold text-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Extracting...' : 'Extract Invoice Data'}
        </button>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">Error</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Result</h2>
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
                className="text-xs text-amber-500 hover:underline"
              >
                Copy JSON
              </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ResultCard label="Vendor" value={(result as { vendor?: string }).vendor} />
              <ResultCard label="Total" value={
                (result as { total?: number }).total != null
                  ? `${(result as { total?: number }).total} ${(result as { currency?: string }).currency || ''}`
                  : '—'
              } />
              <ResultCard label="Invoice #" value={(result as { invoice_number?: string }).invoice_number} />
              <ResultCard label="Confidence" value={
                (result as { confidence?: number }).confidence != null
                  ? `${((result as { confidence?: number }).confidence * 100).toFixed(0)}%`
                  : '—'
              } />
            </div>

            {/* Line items */}
            {(result as { line_items?: unknown[] }).line_items && (result as { line_items?: unknown[] }).line_items!.length > 0 && (
              <div className="rounded-lg border border-border p-4">
                <h3 className="text-sm font-medium mb-2">Line Items ({(result as { line_items?: unknown[] }).line_items!.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1.5">Description</th>
                        <th className="text-right py-1.5">Qty</th>
                        <th className="text-right py-1.5">Unit Price</th>
                        <th className="text-right py-1.5">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((result as { line_items?: Array<{ description?: string; quantity?: number; unit_price?: number; total?: number }> }).line_items || []).map((item, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1.5">{item.description || '—'}</td>
                          <td className="py-1.5 text-right">{item.quantity ?? '—'}</td>
                          <td className="py-1.5 text-right">{item.unit_price ?? '—'}</td>
                          <td className="py-1.5 text-right">{item.total ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Raw JSON */}
            <div className="rounded-lg border border-border">
              <div className="px-4 py-2 border-b border-border">
                <h3 className="text-sm font-medium">Raw JSON Response</h3>
              </div>
              <pre className="p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            This page calls <code className="px-1 py-0.5 rounded bg-muted">/api/v1/extract</code> — the same endpoint developers use.
            Your API key is sent in the Authorization header and never stored.
          </p>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground truncate">{value || '—'}</p>
    </div>
  );
}
