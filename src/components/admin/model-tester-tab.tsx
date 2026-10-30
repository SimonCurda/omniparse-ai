'use client';

// ─── Model Tester tab (admin panel) ─────────────────────────────────────────
//
// Lets the admin test ANY model from ANY configured provider against the
// REAL production prompts — before adding it to the cascade:
//
//   • Invoice Parse mode: upload an invoice image/PDF → the exact production
//     extraction prompt (buildVlmPrompt) runs through the chosen model →
//     extracted fields + raw response + latency.
//   • Chat mode: chat with the chosen model using the exact production
//     chatbot system prompt, optionally with a REAL account's invoice data
//     as context (account selector).
//
// Data flows through /api/admin/model-tester (CRON_SECRET auth, same as the
// rest of the admin panel).

import { useState, useEffect, useRef, useCallback, useId } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Upload, Send, Loader2, CheckCircle2, XCircle, Clock, Key,
  Eraser, FileText, MessageSquare, Eye, EyeOff, TriangleAlert,
  Check, ChevronDown, Wrench,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  ArtifactRenderer,
  isRenderableArtifact,
} from '@/components/shared/artifact-renderer';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TesterAccount {
  id: string;
  email: string;
  name: string;
  invoiceCount: number;
}

type Provider = 'mistral' | 'groq' | 'openrouter' | 'google_gemini';

interface CatalogEntry {
  id: string;
  inProduction: boolean;
  vision: boolean;
}

interface Catalog {
  mistral: CatalogEntry[];
  groq: CatalogEntry[];
  openrouter: CatalogEntry[];
  google_gemini: CatalogEntry[];
}

interface ResultMeta {
  ok: boolean;
  servedModel: string | null;
  statusCode: number | null;
  latencyMs: number;
  keyIndexUsed: number;
  retriedWithoutJsonMode: boolean;
  error?: string | null;
}

interface Extraction {
  vendor?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  amount?: number | null;
  vatAmount?: number | null;
  total?: number | null;
  currency?: string | null;
  lineItems?: Array<{ description?: string; quantity?: number; unitPrice?: number }>;
  fieldConfidence?: Record<string, number>;
  confidence?: number;
}

interface ParseResult extends ResultMeta {
  rawText: string;
  parsed: Extraction | null;
  parseError: string | null;
  /** Repair stages the server had to apply for `parsed` to exist. */
  jsonRepairs?: string[] | null;
  inputImageBytes: number;
  inputImageMime: string | null;
  inputTextChars: number;
  pdfRenderSource?: 'canvas' | 'embedded-jpeg' | 'text' | null;
}

interface ChatResult extends ResultMeta {
  rawText: string;
  displayText: string;
  artifact: unknown | null;
  parseError: string | null;
  /** True when the artifact was salvaged from the response body (fence /
   *  pseudo-envelope / inline JSON) instead of a clean JSON envelope. */
  artifactSalvaged?: boolean;
  contextInvoiceCount: number;
}

interface ChatBubble {
  role: 'user' | 'assistant';
  text: string;
  meta?: ResultMeta & { contextInvoiceCount?: number; artifactSalvaged?: boolean };
  artifact?: unknown;
  raw?: string;
}

const PROVIDERS: Array<{ id: Provider; label: string }> = [
  { id: 'mistral', label: 'Mistral' },
  { id: 'groq', label: 'Groq' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'google_gemini', label: 'Gemini' },
];

// ── Meta chips — status row shown under every test result ──────────────────
// Defined at module level (not inside the component) to satisfy
// react-hooks/static-components.
function MetaChips({ meta }: { meta: ResultMeta & { contextInvoiceCount?: number; pdfRenderSource?: 'canvas' | 'embedded-jpeg' | 'text' | null; jsonRepairs?: string[] | null; artifactSalvaged?: boolean } }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${meta.ok ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
        {meta.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {meta.ok ? 'OK' : 'FAILED'}
      </span>
      {meta.servedModel && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">
          served: {meta.servedModel}
        </span>
      )}
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">
        <Clock className="h-3 w-3" />{meta.latencyMs}ms
      </span>
      {meta.statusCode != null && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">
          HTTP {meta.statusCode}
        </span>
      )}
      {meta.keyIndexUsed > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">
          <Key className="h-3 w-3" />key #{meta.keyIndexUsed}
        </span>
      )}
      {meta.retriedWithoutJsonMode && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <TriangleAlert className="h-3 w-3" />Retried without response_format/usage_options
        </span>
      )}
      {meta.pdfRenderSource && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">
          PDF:{' '}
          {meta.pdfRenderSource === 'canvas'
            ? 'canvas render'
            : meta.pdfRenderSource === 'embedded-jpeg'
              ? 'embedded JPEG'
              : 'text extraction (production Path B)'}
        </span>
      )}
      {meta.jsonRepairs && meta.jsonRepairs.length > 0 && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400"
          title="The model emitted almost-valid JSON — the server repair chain fixed it. This model needs that repair before raw use in strict-JSON integrations."
        >
          <Wrench className="h-3 w-3" />
          JSON repaired ({meta.jsonRepairs.join('; ')})
        </span>
      )}
      {meta.artifactSalvaged && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400"
          title="The artifact was recovered from the response body (embedded fence / pseudo-JSON envelope) instead of a clean {text, artifact} envelope — this model doesn't emit clean envelopes on its own."
        >
          <Wrench className="h-3 w-3" />
          Artifact salvaged from text
        </span>
      )}
      {typeof meta.contextInvoiceCount === 'number' && meta.contextInvoiceCount > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground">
          {meta.contextInvoiceCount} invoices in context
        </span>
      )}
    </div>
  );
}

// ── ModelCombobox — searchable model picker ─────────────────────────────────
// Popover + cmdk combobox. The plain Select had no way to filter by typing,
// which was painful for providers with 20+ catalog entries (OpenRouter).
// This component lives at module level (not inside ModelTesterTab) so React's
// static-elements lint rule stays happy.
function ModelCombobox({
  value,
  onChange,
  models,
  placeholder = 'Select a model',
}: {
  value: string;
  onChange: (id: string) => void;
  models: CatalogEntry[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Stable id so the trigger's aria-controls points at the listbox.
  const listId = useId();

  // Same sort as the old Select: production models first, then alphabetical.
  const sorted = [...models].sort(
    (a, b) => Number(b.inProduction) - Number(a.inProduction) || a.id.localeCompare(b.id),
  );
  const q = query.trim().toLowerCase();
  const filtered = q ? sorted.filter((m) => m.id.toLowerCase().includes(q)) : sorted;
  const selected = sorted.find((m) => m.id === value) || null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm hover:bg-muted/30 transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            {selected ? (
              <>
                <span className="font-mono truncate">{selected.id}</span>
                {selected.inProduction && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                    prod
                  </span>
                )}
                {selected.vision && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                    vision
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 min-w-72"
        // Match the trigger width so the dropdown never shrinks narrower than it.
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search models…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList id={listId}>
            <CommandEmpty>
              {q ? <>No model matches &ldquo;{query}&rdquo;.</> : 'No models available.'}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.id}
                  onSelect={() => {
                    onChange(m.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      value === m.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-mono truncate">{m.id}</span>
                    {m.inProduction && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                        prod
                      </span>
                    )}
                    {m.vision && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                        vision
                      </span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ModelTesterTab({ secret, accounts }: { secret: string; accounts: TesterAccount[] }) {
  // Catalog
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [keyCounts, setKeyCounts] = useState<Record<Provider, number> | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Config
  const [provider, setProvider] = useState<Provider>('mistral');
  const [model, setModel] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [mode, setMode] = useState<'parse' | 'chat'>('parse');

  // Parse mode
  const [file, setFile] = useState<File | null>(null);
  const [parseRunning, setParseRunning] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [showRawParse, setShowRawParse] = useState(false);

  // Chat mode
  const [accountId, setAccountId] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatBubble[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatRunning, setChatRunning] = useState(false);
  const [showRawChat, setShowRawChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveModel = useCustom ? customModel.trim() : model;
  const sortedAccounts = [...accounts].sort((a, b) => b.invoiceCount - a.invoiceCount);
  const selectedAccount = sortedAccounts.find((a) => a.id === accountId) || null;

  // ─── Catalog fetch ────────────────────────────────────────────────────────
  const fetchCatalog = useCallback(async () => {
    if (!secret) return;
    setCatalogLoading(true);
    try {
      const res = await fetch(`/api/admin/model-tester?key=${encodeURIComponent(secret)}`);
      const data = await res.json();
      if (res.ok && data.catalog) {
        setCatalog(data.catalog);
        setKeyCounts(data.keys);
      } else {
        toast.error(data.error || 'Failed to load model catalog');
      }
    } catch {
      toast.error('Network error loading catalog');
    } finally {
      setCatalogLoading(false);
    }
  }, [secret]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Auto-select the first production model when provider changes
  useEffect(() => {
    if (!catalog) return;
    const list = catalog[provider] || [];
    const first = list.find((m) => m.inProduction) || list[0];
    setModel(first ? first.id : '');
  }, [provider, catalog]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatRunning]);

  // ─── Parse mode ───────────────────────────────────────────────────────────

  const runParseTest = async () => {
    if (!file) {
      toast.error('Upload an invoice file first');
      return;
    }
    if (!effectiveModel) {
      toast.error('Select a model first');
      return;
    }
    setParseRunning(true);
    setParseResult(null);
    setShowRawParse(false);
    try {
      const fd = new FormData();
      fd.append('provider', provider);
      fd.append('model', effectiveModel);
      fd.append('file', file);
      const res = await fetch(`/api/admin/model-tester?key=${encodeURIComponent(secret)}`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Test failed');
        setParseResult(null);
        return;
      }
      setParseResult(data as ParseResult);
      if (data.ok) {
        toast.success(`Done in ${data.latencyMs}ms`);
      } else {
        toast.error(`Model call failed: HTTP ${data.statusCode}`);
      }
    } catch {
      toast.error('Network error running test');
    } finally {
      setParseRunning(false);
    }
  };

  // ─── Chat mode ────────────────────────────────────────────────────────────

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatRunning) return;
    if (!effectiveModel) {
      toast.error('Select a model first');
      return;
    }

    const history = [
      ...chatMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.text })),
      { role: 'user' as const, content: text },
    ];

    setChatMessages((prev) => [...prev, { role: 'user', text }]);
    setChatInput('');
    setChatRunning(true);
    setShowRawChat(false);

    try {
      const res = await fetch(`/api/admin/model-tester?key=${encodeURIComponent(secret)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: effectiveModel,
          accountId: accountId || undefined,
          messages: history,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Chat test failed');
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', text: `⚠️ Request failed: ${data.error || 'unknown error'}` },
        ]);
        return;
      }
      const result = data as ChatResult;
      // displayText: envelope text, or markdown with the artifact JSON block
      // stripped out (extractChatResponse handles both shapes server-side).
      const replyText = result.displayText || result.rawText || '(empty response)';
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: result.ok ? replyText : `⚠️ Model call failed (HTTP ${result.statusCode}): ${result.error || ''}`,
          meta: result,
          artifact: result.artifact ?? null,
          raw: result.rawText,
        },
      ]);
      if (result.ok) {
        toast.success(`${result.latencyMs}ms${result.contextInvoiceCount ? ` · ${result.contextInvoiceCount} invoices in context` : ''}`);
      } else {
        toast.error(`Model call failed: HTTP ${result.statusCode}`);
      }
    } catch {
      toast.error('Network error');
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: '⚠️ Network error running the test.' },
      ]);
    } finally {
      setChatRunning(false);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const modelList: CatalogEntry[] = catalog ? catalog[provider] || [] : [];

  const confPct = (v: number | undefined) =>
    typeof v === 'number' ? `${Math.round(v * 100)}%` : '—';

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-2">
          <FileText className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          <div className="text-sm text-muted-foreground">
            Test any model against the <span className="text-foreground font-medium">exact production prompts</span>{' '}
            before adding it to the cascade. Parse mode runs the real invoice-extraction prompt on an
            uploaded document; Chat mode talks to the model with the real chatbot system prompt —
            optionally with a real account&rsquo;s invoice data as context.
          </div>
        </div>
      </div>

      {/* Provider + model config */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5">Provider</div>
          <div className="flex flex-wrap gap-1.5">
            {PROVIDERS.map((p) => {
              const keyCount = keyCounts?.[p.id];
              const active = provider === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    active
                      ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'border-border hover:bg-muted/50 text-foreground'
                  }`}
                >
                  {p.label}
                  {keyCount != null && (
                    <span className={`ml-1.5 text-[10px] ${keyCount > 0 ? 'text-muted-foreground' : 'text-red-500'}`}>
                      {keyCount > 0 ? `${keyCount} key${keyCount > 1 ? 's' : ''}` : 'no key'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs font-medium text-muted-foreground">Model</div>
            <button
              onClick={() => setUseCustom(!useCustom)}
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {useCustom ? 'pick from list' : 'custom model ID…'}
            </button>
          </div>

          {useCustom ? (
            <input
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="e.g. ministral-14b-latest"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          ) : catalogLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2.5 rounded-lg border border-border">
              <Loader2 className="h-3 w-3 animate-spin" /> loading catalog…
            </div>
          ) : modelList.length === 0 ? (
            <div className="text-xs text-muted-foreground px-3 py-2.5 rounded-lg border border-border">
              No models listed for this provider (or no key configured) — use a custom model ID.
            </div>
          ) : (
            <ModelCombobox
              value={model}
              onChange={setModel}
              models={modelList}
              placeholder="Select a model"
            />
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1.5 pt-1">
          <button
            onClick={() => setMode('parse')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              mode === 'parse'
                ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-border hover:bg-muted/50 text-foreground'
            }`}
          >
            <FileText className="h-3.5 w-3.5" /> Invoice Parse Test
          </button>
          <button
            onClick={() => setMode('chat')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              mode === 'chat'
                ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-border hover:bg-muted/50 text-foreground'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Chatbot Test
          </button>
        </div>
      </div>

      {/* ─── PARSE MODE ─── */}
      {mode === 'parse' && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-xs font-medium text-muted-foreground">Upload an invoice (image or PDF)</div>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-amber-500/50 hover:bg-muted/30 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-emerald-500" />
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground text-xs">
                  {(file.size / 1024).toFixed(0)} KB · {file.type || 'unknown'}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                <Upload className="h-5 w-5" />
                <div className="text-sm">Click or drag a file here</div>
                <div className="text-xs">JPG · PNG · WebP · PDF (first page) · max 10MB</div>
              </div>
            )}
          </div>

          <button
            onClick={runParseTest}
            disabled={parseRunning || !file || !effectiveModel}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-black text-sm font-medium hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {parseRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Running extraction ({effectiveModel})…
              </>
            ) : (
              <>Run extraction test</>
            )}
          </button>

          {/* Parse result */}
          {parseResult && (
            <div className="space-y-3 pt-1">
              <MetaChips meta={parseResult} />

              {parseResult.error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs font-mono text-red-600 dark:text-red-400 break-all">
                  {parseResult.error}
                </div>
              )}

              {parseResult.parsed && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-border text-xs">
                    {([
                      ['Vendor', parseResult.parsed.vendor],
                      ['Invoice #', parseResult.parsed.invoiceNumber],
                      ['Invoice date', parseResult.parsed.invoiceDate],
                      ['Due date', parseResult.parsed.dueDate],
                      ['Amount (net)', parseResult.parsed.amount?.toLocaleString()],
                      ['VAT', parseResult.parsed.vatAmount?.toLocaleString()],
                      ['Total', parseResult.parsed.total?.toLocaleString()],
                      ['Currency', parseResult.parsed.currency],
                    ] as Array<[string, unknown]>).map(([label, value]) => (
                      <div key={label} className="p-2.5">
                        <div className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</div>
                        <div className="font-medium mt-0.5 break-all">
                          {value == null ? <span className="text-muted-foreground">—</span> : String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border border-t border-border text-xs">
                    <div className="p-2.5">
                      <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Overall confidence</div>
                      <div className="font-medium mt-0.5">{confPct(parseResult.parsed.confidence)}</div>
                    </div>
                    <div className="p-2.5">
                      <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Field confidence</div>
                      <div className="font-medium mt-0.5 text-[11px] text-muted-foreground break-all">
                        {parseResult.parsed.fieldConfidence
                          ? Object.entries(parseResult.parsed.fieldConfidence)
                              .map(([k, v]) => `${k}: ${confPct(v)}`)
                              .join(' · ')
                          : '—'}
                      </div>
                    </div>
                  </div>
                  {parseResult.parsed.lineItems && parseResult.parsed.lineItems.length > 0 && (
                    <div className="border-t border-border p-2.5">
                      <div className="text-muted-foreground text-[10px] uppercase tracking-wide mb-1.5">
                        Line items ({parseResult.parsed.lineItems.length})
                      </div>
                      <div className="space-y-1">
                        {parseResult.parsed.lineItems.map((li, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-xs">
                            <span className="break-all">{li.description || '—'}</span>
                            <span className="text-muted-foreground whitespace-nowrap">
                              {li.quantity ?? '—'} × {(li.unitPrice ?? 0).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {parseResult.parseError && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
                  JSON parse failed: {parseResult.parseError} — check the raw response below.
                </div>
              )}

              <button
                onClick={() => setShowRawParse(!showRawParse)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {showRawParse ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showRawParse ? 'Hide' : 'Show'} raw response ({parseResult.rawText.length} chars)
              </button>
              {showRawParse && (
                <pre className="rounded-lg border border-border bg-muted/30 p-3 text-[11px] font-mono whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
                  {parseResult.rawText || '(empty)'}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── CHAT MODE ─── */}
      {mode === 'chat' && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-medium text-muted-foreground">Account context:</div>
            <div className="flex-1 min-w-48">
              <Select value={accountId} onValueChange={(v) => setAccountId(v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full text-xs h-8">
                  <SelectValue placeholder="No account (generic test)" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none" className="text-xs">— No account (generic test) —</SelectItem>
                  {sortedAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">
                      <span className="flex items-center gap-2">
                        <span className="truncate max-w-52">{a.email}</span>
                        <span className="text-muted-foreground text-[10px] whitespace-nowrap">
                          {a.invoiceCount} inv
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {chatMessages.length > 0 && (
              <button
                onClick={() => setChatMessages([])}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/50"
              >
                <Eraser className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          {selectedAccount && (
            <div className="text-[11px] text-muted-foreground">
              Context will include {selectedAccount.invoiceCount} invoice(s) from{' '}
              <span className="text-foreground">{selectedAccount.email}</span> (last 100, same as production).
            </div>
          )}

          {/* Transcript */}
          <div className="rounded-lg border border-border bg-background h-96 overflow-y-auto p-3 space-y-3">
            {chatMessages.length === 0 && !chatRunning && (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-1.5 text-xs">
                <MessageSquare className="h-5 w-5" />
                <div>Ask something invoice-related, e.g. &ldquo;How many invoices do I have?&rdquo;</div>
                <div className="text-[10px]">The model gets the exact production system prompt{selectedAccount ? ' + this account\u2019s invoice data' : ''}.</div>
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-amber-500/10 border border-amber-500/30'
                      : 'bg-muted/40 border border-border'
                  }`}
                >
                  {m.role === 'user' ? (
                    <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  ) : (
                    <>
                      <div className="prose-sm break-words [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_table]:my-2 [&_table]:text-xs [&_th]:border [&_th]:border-border [&_th]:px-1.5 [&_th]:py-0.5 [&_td]:border [&_td]:border-border [&_td]:px-1.5 [&_td]:py-0.5 [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_code]:text-[11px]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                      </div>
                      {m.artifact != null && (
                        <>
                          {/* Render the artifact visually (chart/table/summary)
                              when the model emitted a valid artifact shape.
                              Falls through to just-the-JSON when malformed. */}
                          {isRenderableArtifact(m.artifact) && (
                            <ArtifactRenderer artifact={m.artifact} />
                          )}
                          {/* Keep the raw JSON collapsible — useful for
                              inspecting exactly what the model produced,
                              especially for unsupported artifact types. */}
                          <details className="mt-2">
                            <summary className="text-[11px] text-muted-foreground cursor-pointer select-none">
                              {isRenderableArtifact(m.artifact)
                                ? 'artifact JSON'
                                : 'malformed artifact — raw JSON'}
                            </summary>
                            <pre className="mt-1 rounded border border-border bg-muted/30 p-2 text-[10px] font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                              {JSON.stringify(m.artifact, null, 2)}
                            </pre>
                          </details>
                        </>
                      )}
                      {m.meta && <MetaChips meta={m.meta} />}
                      {m.raw && i === chatMessages.length - 1 && (
                        <button
                          onClick={() => setShowRawChat(!showRawChat)}
                          className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          {showRawChat ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {showRawChat ? 'Hide' : 'Show'} raw response ({m.raw.length} chars)
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {chatRunning && (
              <div className="flex justify-start">
                <div className="rounded-lg px-3 py-2 bg-muted/40 border border-border flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {effectiveModel} is thinking…
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendChat();
                }
              }}
              placeholder={
                effectiveModel
                  ? `Message ${effectiveModel}…`
                  : 'Select a model first…'
              }
              disabled={chatRunning}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm disabled:opacity-50"
            />
            <button
              onClick={sendChat}
              disabled={chatRunning || !chatInput.trim() || !effectiveModel}
              className="px-4 py-2 rounded-lg bg-amber-500 text-black text-sm font-medium hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {chatRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </div>

          {showRawChat && chatMessages.length > 0 && chatMessages[chatMessages.length - 1].raw && (
            <pre className="rounded-lg border border-border bg-muted/30 p-3 text-[11px] font-mono whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
              {chatMessages[chatMessages.length - 1].raw}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
