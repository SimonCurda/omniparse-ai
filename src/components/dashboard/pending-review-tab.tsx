'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Inbox, CheckCircle2, XCircle, Ban, Loader2, FileText, Mail, RefreshCw,
  CheckSquare, AlertCircle, Clock, Download,
} from 'lucide-react';
import { toast } from 'sonner';

interface PendingItem {
  id: string;
  inboxId: string;
  fromAddress: string;
  fromName: string | null;
  subject: string;
  receivedAt: string;
  attachmentFilename: string;
  attachmentMime: string;
  classification: string; // 'invoice' | 'maybe' | 'no'
  status: string;
  createdAt: string;
}

function getToken(): string | null {
  return localStorage.getItem('op_token');
}

function fmtRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function ClassificationBadge({ classification }: { classification: string }) {
  if (classification === 'invoice') {
    return (
      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px] gap-1">
        <CheckCircle2 className="h-2.5 w-2.5" /> Looks like invoice
      </Badge>
    );
  }
  if (classification === 'no') {
    return (
      <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 text-[10px] gap-1">
        <XCircle className="h-2.5 w-2.5" /> Not an invoice
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-0 text-[10px] gap-1">
      <AlertCircle className="h-2.5 w-2.5" /> Uncertain
    </Badge>
  );
}

// ─── PDF preview component ──────────────────────────────────────────────────
// Uses pdf.js to render the PDF onto a <canvas> element. This avoids
// Content-Security-Policy issues with iframes — Vercel's CSP blocks blob:
// URLs in frame-src, but canvas rendering is pure JavaScript and isn't
// subject to frame-src restrictions.
//
// The actual rendering logic lives in the PdfViewer component.

import { PdfViewer } from './pdf-viewer';

function PdfPreview({ base64, mime, filename }: { base64: string; mime: string; filename: string }) {
  if (mime === 'application/pdf') {
    return <PdfViewer base64={base64} filename={filename} />;
  }

  // Fallback for non-PDF attachments (images already handled by the parent)
  return (
    <div className="p-8 text-center space-y-3">
      <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">
        Preview not available for this file type ({mime}).
      </p>
      <a
        href={`data:${mime};base64,${base64}`}
        download={filename}
        className="inline-flex items-center gap-1.5 text-sm text-amber-500 hover:underline"
      >
        <Download className="h-4 w-4" /> Download {filename}
      </a>
    </div>
  );
}

export function PendingReviewTab() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [previewItem, setPreviewItem] = useState<PendingItem | null>(null);
  const [previewData, setPreviewData] = useState<{ attachmentData: string; attachmentMime: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadItems = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/pending-review?status=pending', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const approve = async (id: string, addToTrusted = false) => {
    const token = getToken();
    if (!token) return;
    setProcessing(id);
    try {
      const res = await fetch(`/api/pending-review/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ addToTrustedSenders: addToTrusted }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(addToTrusted ? 'Approved + sender added to trusted' : 'Invoice approved');
        setItems(items.filter((i) => i.id !== id));
        if (data.invoiceId) {
          // Refresh invoices list in the background
          // (the dashboard shell will pick it up on next invoices tab load)
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to approve');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setProcessing(null);
    }
  };

  const skip = async (id: string) => {
    const token = getToken();
    if (!token) return;
    setProcessing(id);
    try {
      const res = await fetch(`/api/pending-review/${id}/skip`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        toast.success('Skipped');
        setItems(items.filter((i) => i.id !== id));
      } else {
        toast.error('Failed to skip');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setProcessing(null);
    }
  };

  const block = async (id: string) => {
    const token = getToken();
    if (!token) return;
    setProcessing(id);
    try {
      const res = await fetch(`/api/pending-review/${id}/block`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        toast.success('Sender blocked');
        setItems(items.filter((i) => i.id !== id));
      } else {
        toast.error('Failed to block sender');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setProcessing(null);
    }
  };

  const bulkAction = async (action: 'approve' | 'skip' | 'block') => {
    const token = getToken();
    if (!token) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkProcessing(true);
    try {
      const res = await fetch('/api/pending-review/bulk', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      });
      if (res.ok) {
        const data = await res.json();
        const results = data.results || {};
        const ok = (results.approved || 0) + (results.skipped || 0) + (results.blocked || 0);
        toast.success(`${ok} of ${ids.length} items ${action}d`);
        if (results.errors?.length > 0) {
          toast.error(`${results.errors.length} errors occurred`);
        }
        setSelectedIds(new Set());
        loadItems(); // refresh
      } else {
        toast.error('Bulk action failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setBulkProcessing(false);
    }
  };

  const openPreview = async (item: PendingItem) => {
    setPreviewItem(item);
    setPreviewData(null);
    setPreviewLoading(true);
    const token = getToken();
    if (!token) { setPreviewLoading(false); return; }
    try {
      const res = await fetch(`/api/pending-review/${item.id}`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewData({
          attachmentData: data.attachmentData,
          attachmentMime: data.attachmentMime,
        });
      }
    } catch {
      // silent
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((i) => i.id)));
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="h-6 w-6 text-amber-500" />
            Pending Review
          </h2>
          <p className="text-muted-foreground mt-1">
            {items.length > 0
              ? `${items.length} email${items.length !== 1 ? 's' : ''} waiting for your review. Nothing auto-imports to your Invoices list until you approve.`
              : 'No emails waiting for review. Scan your inboxes in Settings to find new invoices.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadItems} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {hasSelection && (
        <div className="sticky top-14 z-30 bg-background border rounded-lg shadow-sm p-3 flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => bulkAction('approve')} disabled={bulkProcessing}>
              {bulkProcessing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-500" />}
              Approve All
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkAction('skip')} disabled={bulkProcessing}>
              <XCircle className="h-4 w-4 mr-1" />
              Skip All
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkAction('block')} disabled={bulkProcessing}>
              <Ban className="h-4 w-4 mr-1" />
              Block All
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Items list */}
      {loading ? (
        <Card><CardContent className="py-12 text-center">
          <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Loading pending emails...</p>
        </CardContent></Card>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">No pending emails</p>
          <p className="text-sm text-muted-foreground mt-1">
            Go to Settings → Email Inboxes to add an inbox and scan for invoices.
          </p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {/* Select all header */}
          <div className="flex items-center gap-2 px-2 py-1">
            <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
            <span className="text-xs text-muted-foreground">Select all ({items.length})</span>
          </div>
          {items.map((item) => (
            <Card key={item.id} className={`border-border/50 ${selectedIds.has(item.id) ? 'ring-2 ring-amber-500/30' : ''}`}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className="pt-1">
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">{item.fromName || item.fromAddress}</span>
                      <ClassificationBadge classification={item.classification} />
                      <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {fmtRelativeTime(item.receivedAt)}
                      </span>
                    </div>
                    {/* Subject */}
                    <p className="text-sm text-foreground/80 truncate mb-0.5">{item.subject}</p>
                    {/* Attachment */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <FileText className="h-3 w-3" />
                      <span className="truncate">{item.attachmentFilename}</span>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approve(item.id)}
                        disabled={processing === item.id}
                        className="h-7 text-xs"
                      >
                        {processing === item.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approve(item.id, true)}
                        disabled={processing === item.id}
                        className="h-7 text-xs"
                      >
                        <CheckSquare className="h-3 w-3 mr-1" />
                        Approve + Trust Sender
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => skip(item.id)}
                        disabled={processing === item.id}
                        className="h-7 text-xs"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Skip
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => block(item.id)}
                        disabled={processing === item.id}
                        className="h-7 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <Ban className="h-3 w-3 mr-1" />
                        Block Sender
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openPreview(item)}
                        className="h-7 text-xs ml-auto"
                      >
                        Preview
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewItem} onOpenChange={(open) => { if (!open) { setPreviewItem(null); setPreviewData(null); } }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {previewItem?.attachmentFilename || 'Attachment'}
            </DialogTitle>
            <DialogDescription>
              From {previewItem?.fromName || previewItem?.fromAddress} — {previewItem?.subject}
            </DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : previewData ? (
            <div className="rounded-lg border overflow-hidden bg-muted/30">
              {previewData.attachmentMime.startsWith('image/') ? (
                <img
                  src={`data:${previewData.attachmentMime};base64,${previewData.attachmentData}`}
                  alt={previewItem?.attachmentFilename || 'Attachment'}
                  className="w-full h-auto max-h-[60vh] object-contain bg-white"
                />
              ) : previewData.attachmentMime === 'application/pdf' ? (
                <div className="p-4">
                  {/* Convert base64 to a Blob URL so browsers don't block it
                      (Vercel's CSP blocks data: URLs in iframes, but blob: URLs work) */}
                  <PdfPreview
                    base64={previewData.attachmentData}
                    mime={previewData.attachmentMime}
                    filename={previewItem?.attachmentFilename || 'attachment.pdf'}
                  />
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Preview not available for this file type.
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Failed to load attachment.
            </div>
          )}
          {previewItem && (
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" size="sm" onClick={() => skip(previewItem.id)}>
                <XCircle className="h-4 w-4 mr-1" /> Skip
              </Button>
              <Button variant="outline" size="sm" onClick={() => block(previewItem.id)}>
                <Ban className="h-4 w-4 mr-1" /> Block
              </Button>
              <Button size="sm" onClick={() => { approve(previewItem.id); setPreviewItem(null); }}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
