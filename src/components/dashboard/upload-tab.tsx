'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, Sparkles, Loader2, AlertCircle, ShieldCheck, ShieldAlert, ShieldX, Timer, CheckCircle, TriangleAlert, Bug, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/app-store';
import type { InvoiceRow } from '@/stores/app-store';
import { ConfidenceMeter } from './confidence-meter';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function getToken(): string | null {
  return localStorage.getItem('op_token');
}

const PLAN_BATCH_LIMITS: Record<string, number> = {
  free: 1,
  pro: 5,
  plus: Infinity,
  business: Infinity,
  enterprise: Infinity,
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  plus: 'Plus',
  business: 'Business',
  enterprise: 'Enterprise',
};

export function UploadTab() {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [results, setResults] = useState<InvoiceRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  // GDPR data transfer consent — required before user can upload documents
  // that will be processed by US-based AI providers (OpenRouter, Groq, Google Gemini).
  // Persisted in localStorage so user only has to confirm once per device.
  // Reset on logout (see auth-view.tsx where op_token is removed).
  const [legalConsent, setLegalConsent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setInvoices, invoices, user } = useAppStore();

  // Debug logs — only visible when an admin has flipped user.debugEnabled = true
  // for this account (see /api/admin/accounts/[id]/debug). When enabled, the
  // upload tab shows a "Debug Logs" button that opens a dialog listing the
  // last 20 ParseDebugLog entries for this user. The dialog can also clear
  // the logs via DELETE /api/parse-debug-logs.
  const debugEnabled = user?.debugEnabled === true;
  const [debugLogsOpen, setDebugLogsOpen] = useState(false);
  const [debugLogs, setDebugLogs] = useState<
    Array<{
      id: string;
      filename: string | null;
      fileType: string | null;
      logs: Array<{ timestamp?: string; step?: string; data?: unknown }>;
      success: boolean;
      error: string | null;
      createdAt: string;
    }>
  >([]);
  const [debugLogsLoading, setDebugLogsLoading] = useState(false);

  const openDebugLogs = async () => {
    setDebugLogsOpen(true);
    setDebugLogsLoading(true);
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch('/api/parse-debug-logs', {
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.logs)) {
        setDebugLogs(data.logs);
      } else if (!res.ok) {
        toast.error(data.error || 'Failed to load debug logs');
      }
    } catch {
      toast.error('Network error loading debug logs');
    } finally {
      setDebugLogsLoading(false);
    }
  };

  const clearDebugLogs = async () => {
    setDebugLogsLoading(true);
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch('/api/parse-debug-logs', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await res.json();
      if (res.ok) {
        setDebugLogs([]);
        toast.success(`Cleared ${data.deleted ?? 0} log entr${(data.deleted ?? 0) === 1 ? 'y' : 'ies'}`);
      } else {
        toast.error(data.error || 'Failed to clear logs');
      }
    } catch {
      toast.error('Network error clearing logs');
    } finally {
      setDebugLogsLoading(false);
    }
  };

  // Truncate debug log data values so they fit in the dialog without
  // overwhelming the screen — 200 chars is enough to spot the relevant
  // fragment without losing the shape of the payload.
  const truncateData = (val: unknown): string => {
    if (val == null) return '';
    let str: string;
    if (typeof val === 'string') {
      str = val;
    } else {
      try { str = JSON.stringify(val); } catch { str = String(val); }
    }
    return str.length > 200 ? str.slice(0, 200) + '…' : str;
  };

  // Load consent from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('op_legal_consent');
      if (saved === 'true') setLegalConsent(true);
    } catch { /* localStorage unavailable */ }
  }, []);

  const handleLegalConsentChange = (checked: boolean | 'indeterminate') => {
    const value = checked === true;
    setLegalConsent(value);
    try {
      localStorage.setItem('op_legal_consent', value ? 'true' : 'false');
    } catch { /* localStorage unavailable */ }
  };

  // Delay showing the Welcome card so it doesn't flicker while invoices are
  // being fetched from the API on initial mount.
  useEffect(() => {
    const t = setTimeout(() => setShowWelcome(true), 100);
    return () => clearTimeout(t);
  }, []);

  const plan = user?.plan || 'free';
  const batchLimit = PLAN_BATCH_LIMITS[plan] ?? 1;
  const planLabel = PLAN_LABELS[plan] || plan;
  const limitText = batchLimit === Infinity
    ? 'unlimited files at once'
    : `up to ${batchLimit} file${batchLimit > 1 ? 's' : ''} at once`;

  const enforceBatchLimit = (newFiles: File[]) => {
    const currentCount = files.length;
    const totalCount = currentCount + newFiles.length;
    if (totalCount > batchLimit && batchLimit !== Infinity) {
      const allowed = batchLimit - currentCount;
      if (allowed <= 0) {
        toast.error(`Batch upload limit reached (${batchLimit}). ${planLabel === 'Free' ? 'Upgrade to Pro for 5 files.' : 'Upgrade to Plus for unlimited files.'}`);
        return [];
      }
      toast.error(`Batch upload requires ${plan === 'free' ? 'Pro' : 'Plus'} plan for more than ${batchLimit} files. Only ${allowed} more file${allowed !== 1 ? 's' : ''} added.`);
      return newFiles.slice(0, allowed);
    }
    return newFiles;
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!legalConsent) {
      toast.error('Please confirm the data transfer notice below before uploading.');
      return;
    }
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const dropped = Array.from(e.dataTransfer.files).filter((f) => validTypes.includes(f.type));
    if (dropped.length > 0) {
      const allowed = enforceBatchLimit(dropped);
      setFiles((prev) => [...prev, ...allowed]);
    } else {
      toast.error('Unsupported file type. Use PDF, JPEG, PNG, or WebP.');
    }
  }, [files.length, plan, batchLimit, legalConsent]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!legalConsent) {
      toast.error('Please confirm the data transfer notice below before uploading.');
      // Reset the input value so the same file can be re-selected after consent
      e.target.value = '';
      return;
    }
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const allowed = enforceBatchLimit(newFiles);
      setFiles((prev) => [...prev, ...allowed]);
    }
    e.target.value = '';
  };

  const parseFiles = async () => {
    if (files.length === 0) return;
    const token = getToken();
    if (!token) {
      toast.error('Session expired. Please sign in again.');
      useAppStore.getState().logout();
      return;
    }

    setUploading(true);
    setProgress(0);
    setResults([]);
    setErrors([]);

    const totalFiles = files.length;
    const newInvoices: InvoiceRow[] = [];
    const fileErrors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setStatusText(`Uploading ${i + 1}/${totalFiles}: ${file.name}`);
      setProgress(Math.round((i / totalFiles) * 50));

      try {
        const formData = new FormData();
        formData.append('file', file);

        setStatusText(`Parsing ${i + 1}/${totalFiles}: ${file.name} via AI...`);
        setProgress(Math.round((i / totalFiles) * 50) + 25);

        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.code === 'ACCOUNT_FROZEN') {
            // Show proper frozen message instead of generic error
            setErrors([]);
            toast.error(`ACCOUNT FROZEN — Your account has been frozen by an administrator.\n\nReason: ${data.error}\n\nTo appeal, contact: damr58h@gmail.com`, { duration: 10000 });
            return;
          }
          if (data.code === 'MONTHLY_LIMIT_REACHED') {
            fileErrors.push(`${file.name}: ${data.error}`);
            continue;
          }
          fileErrors.push(`${file.name}: ${data.error || 'Error ' + res.status}`);
          continue;
        }

        newInvoices.push({
          id: data.id,
          filename: data.filename || file.name,
          vendor: data.vendor ?? null,
          invNumber: data.invoiceNumber ?? null,
          invDate: data.invoiceDate ?? null,
          dueDate: data.dueDate ?? null,
          amount: data.amount ?? null,
          vatAmount: data.vatAmount ?? null,
          total: data.total ?? null,
          currency: data.currency ?? 'USD',
          status: data.status || 'done',
          isDuplicate: data.isDuplicate || false,
          confidence: data.confidence ?? null,
          fieldConfidence: data.fieldConfidence ?? null,
          createdAt: data.createdAt || new Date().toISOString(),
          validationResults: data.validationResults ?? null,
          validationStatus: data.validationStatus ?? null,
          normalizedVendor: data.normalizedData?.vendor ?? null,
          normalizedInvDate: data.normalizedData?.invDate ?? null,
          normalizedTotal: data.normalizedData?.total ?? null,
          processingTime: data.processingTime ?? null,
          customFields: data.customFields ?? null,
          approvalStatus: data.approvalStatus ?? null,
        });
      } catch (err) {
        fileErrors.push(`${file.name}: Network error`);
      }

      setProgress(Math.round(((i + 1) / totalFiles) * 100));
    }

    if (newInvoices.length > 0) {
      setInvoices([...invoices, ...newInvoices]);
      toast.success(`Parsed ${newInvoices.length} document${newInvoices.length > 1 ? 's' : ''}`);
    }

    setResults(newInvoices);
    setErrors(fileErrors);
    setFiles([]);
    setUploading(false);
    setStatusText('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">Upload Documents</h2>
            <p className="text-muted-foreground mt-1">Drop invoices or receipts to extract structured data using AI.</p>
          </div>
          {debugEnabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openDebugLogs}
              className="gap-1.5"
              title="View parse diagnostic logs (admin debug mode)"
            >
              <Bug className="h-4 w-4" />
              Debug Logs
            </Button>
          )}
        </div>
      </div>

      {showWelcome && invoices.length === 0 && (
        <Card data-glow data-glow-border-only className="glass-card border-l-4 border-l-amber-500 bg-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h3 className="text-base font-semibold text-foreground">Welcome to OmniParse</h3>
            </div>
            <ul className="space-y-2 text-sm text-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <span>Drag and drop invoices or click to browse (PDF, PNG, JPEG, WebP)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <span>AI extracts vendor, dates, amounts, and line items automatically</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <span>Chat with your data, generate charts, and export results</span>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3">Your first 15 invoices are free</p>
          </CardContent>
        </Card>
      )}

      {/* GDPR data transfer notice + consent checkbox
          Required before user can upload documents containing personal data
          (e.g. vendor names, email addresses) that will be processed by
          US-based AI providers (OpenRouter, Groq, Google Gemini). */ }
      <Card data-glow data-glow-border-only className={'glass-card border-l-4 ' + (legalConsent ? 'border-l-emerald-500 bg-emerald-500/5' : 'border-l-amber-500 bg-amber-500/5')}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <TriangleAlert className={'h-5 w-5 shrink-0 mt-0.5 ' + (legalConsent ? 'text-emerald-500' : 'text-amber-500')} />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold mb-1">
                {legalConsent ? 'Data transfer consent confirmed' : 'Data transfer notice — please read before uploading'}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                Uploaded documents are processed by AI providers: <strong>Mistral (Paris, EU)</strong> is used
                first; <strong>Groq (US)</strong> has confirmed Standard Contractual Clauses (SCCs) in effect
                as of September 12, 2026. <strong>OpenRouter</strong> and <strong>Google</strong> (US) are
                fallbacks pending SCC verification. Processing by AI providers is governed by their applicable
                terms and data-processing agreements.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Documents may contain personal data of multiple data subjects (vendor names, employee names,
                email addresses, bank details). You are responsible for ensuring you have a valid legal basis
                under GDPR Art. 6 for processing and transferring such data. If processing falls through to
                OpenRouter or Google (pending SCC verification), exercise caution with highly sensitive
                personal data.
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={legalConsent}
                  onCheckedChange={handleLegalConsentChange}
                  className="mt-0.5"
                />
                <span className="text-xs text-foreground leading-relaxed">
                  I understand that my documents may be processed by AI providers in the EU (Mistral) and
                  US (Groq with SCCs, OpenRouter, Google). I confirm I have a legal basis for any personal
                  data contained in my uploaded documents.
                </span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={'border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ' + (dragActive ? 'border-amber-500 bg-amber-500/5' : 'border-border hover:border-amber-500/50 hover:bg-muted/30') + (legalConsent ? '' : ' opacity-50 pointer-events-none')}
        onClick={() => legalConsent && fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFileSelect} />
        <Upload className={'h-10 w-10 mx-auto mb-4 ' + (dragActive ? 'text-amber-500' : 'text-muted-foreground')} />
        <p className="font-medium">Drop files here or click to browse</p>
        <p className="text-sm text-muted-foreground mt-1">
          PDF, JPEG, PNG, WebP — up to 10MB each
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Upload {limitText} (your plan: {planLabel})
        </p>
      </div>

      {files.length > 0 && (
        <Card data-glow data-glow-border-only className="glass-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">{files.length} file{files.length > 1 ? 's' : ''} selected</h3>
              <Button variant="ghost" size="sm" onClick={() => setFiles([])}>Clear all</Button>
            </div>
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-muted/50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Button className="w-full" onClick={parseFiles} disabled={uploading}>
              {uploading ? statusText || 'Processing...' : 'Parse Documents'}
              {uploading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Sparkles className="ml-2 h-4 w-4" />}
            </Button>
            {uploading && <Progress value={progress} className="h-2" />}
          </CardContent>
        </Card>
      )}

      {errors.length > 0 && (
        <Card data-glow data-glow-border-only className="glass-card border-red-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" /> Errors ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-red-500">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card data-glow data-glow-border-only className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Extraction Results</CardTitle>
            <CardDescription>
              Parsed {results.length} document{results.length > 1 ? 's' : ''} with AI extraction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2.5 font-medium">Vendor</th>
                      <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Invoice #</th>
                      <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Date</th>
                      <th className="text-right px-4 py-2.5 font-medium">Total</th>
                      <th className="text-center px-4 py-2.5 font-medium hidden sm:table-cell">Validation</th>
                      <th className="text-right px-4 py-2.5 font-medium">Confidence</th>
                      <th className="text-right px-4 py-2.5 font-medium hidden lg:table-cell">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="px-4 py-2.5 font-medium">{r.vendor || 'Unknown'}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground hidden md:table-cell">{r.invNumber || '-'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{r.invDate || '-'}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{(() => {
                          try {
                            return new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: (r.currency || 'USD').toUpperCase(),
                              currencyDisplay: 'narrowSymbol',
                              minimumFractionDigits: 2,
                            }).format(r.total ?? 0);
                          } catch {
                            return `${(r.total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${r.currency || 'USD'}`;
                          }
                        })()}</td>
                        <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                          {r.validationStatus === 'fail' ? (
                            <Badge variant="secondary" className="bg-red-500/10 text-red-500 gap-1"><ShieldX className="h-3 w-3" /> Fail</Badge>
                          ) : r.validationStatus === 'warning' ? (
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 gap-1"><ShieldAlert className="h-3 w-3" /> Warn</Badge>
                          ) : r.validationStatus === 'pass' ? (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 gap-1"><ShieldCheck className="h-3 w-3" /> Pass</Badge>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <ConfidenceMeter confidence={r.confidence} fieldConfidence={r.fieldConfidence} />
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground hidden lg:table-cell">
                          {r.processingTime ? <span className="flex items-center gap-1 justify-end"><Timer className="h-3 w-3" />{r.processingTime.toFixed(1)}s</span> : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Logs dialog — only rendered when debugEnabled so the Dialog
          component is never mounted for non-debug users (defence in depth). */}
      {debugEnabled && (
        <Dialog open={debugLogsOpen} onOpenChange={setDebugLogsOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-amber-500" />
                Parse Debug Logs
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {debugLogs.length} {debugLogs.length === 1 ? 'entry' : 'entries'}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-3">
              {debugLogsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : debugLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bug className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No debug logs yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Logs are recorded each time you upload a document while debug mode is on.
                  </p>
                </div>
              ) : (
                debugLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className={
                      'rounded-lg border p-3 ' +
                      (entry.success
                        ? 'border-emerald-500/20 bg-emerald-500/5'
                        : 'border-red-500/20 bg-red-500/5')
                    }
                  >
                    {/* Header row: filename, success badge, timestamp */}
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {entry.filename || 'Unknown file'}
                        </span>
                        {entry.fileType && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {entry.fileType}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {entry.success ? (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 text-[10px] gap-1">
                            <CheckCircle className="h-3 w-3" /> Success
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-red-500/10 text-red-600 text-[10px] gap-1">
                            <AlertCircle className="h-3 w-3" /> Failed
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Error message (if any) */}
                    {entry.error && (
                      <p className="text-xs text-red-500 font-mono bg-red-500/5 border border-red-500/20 rounded p-2 mb-2 break-all">
                        {entry.error}
                      </p>
                    )}

                    {/* Step list */}
                    {Array.isArray(entry.logs) && entry.logs.length > 0 ? (
                      <ol className="space-y-1.5">
                        {entry.logs.map((step, i) => (
                          <li key={i} className="text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              {step.timestamp && (
                                <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                                  {new Date(step.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                                </span>
                              )}
                              <span className="font-medium text-foreground shrink-0">
                                {step.step || `Step ${i + 1}`}
                              </span>
                            </div>
                            {step.data != null && (
                              <pre className="mt-0.5 ml-[6.5rem] font-mono text-[11px] text-muted-foreground whitespace-pre-wrap break-all">
                                {truncateData(step.data)}
                              </pre>
                            )}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No steps recorded.</p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearDebugLogs}
                disabled={debugLogsLoading || debugLogs.length === 0}
                className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
                Clear logs
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setDebugLogsOpen(false)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
