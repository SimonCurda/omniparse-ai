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
  CheckSquare, AlertCircle, Clock, Download, RotateCcw, Undo2, ExternalLink,
  ChevronDown, ArrowDownWideNarrow, ArrowUpWideNarrow,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/app-store';

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

// ─── Smart attachment preview ──────────────────────────────────────────────
// Detects the actual file type from magic bytes (first few bytes of the file)
// instead of trusting the MIME type from the email scanner, which can be wrong.
//
// This fixes cases where:
// - MIME says application/pdf but the file is actually an image or HTML
// - MIME says application/octet-stream but it's actually a PDF
// - The file is a forwarded email body (HTML) stored as an attachment

function detectFileType(base64: string): { type: 'pdf' | 'jpeg' | 'png' | 'webp' | 'html' | 'text' | 'unknown'; mime: string } {
  try {
    // Decode first 2000 characters of base64 (~1500 bytes) — enough to detect
    // HTML even if it starts with whitespace, MIME headers, or encoding declarations
    const binary = atob(base64.slice(0, 2000));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // Check magic bytes (first 4 bytes are enough for binary formats)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return { type: 'pdf', mime: 'application/pdf' }; // %PDF
    }
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return { type: 'jpeg', mime: 'image/jpeg' };
    }
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return { type: 'png', mime: 'image/png' };
    }
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes.length > 11 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return { type: 'webp', mime: 'image/webp' };
    }

    // Check for HTML anywhere in the first 1500 bytes.
    // Forwarded emails often start with MIME headers like:
    //   "Content-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: ..."
    // before the actual <html> tag. We need to scan more bytes.
    const text = binary.toLowerCase();
    if (text.includes('<!doctype html') || text.includes('<html') || text.includes('<head') ||
        text.includes('<body') || text.includes('<table') || text.includes('<div') ||
        text.includes('content-type: text/html') || text.includes('<meta ')) {
      return { type: 'html', mime: 'text/html' };
    }
    if (text.includes('<?xml')) {
      return { type: 'html', mime: 'text/html' };
    }

    // Check if it's plain text (high ratio of printable ASCII characters)
    let printable = 0;
    for (let i = 0; i < Math.min(bytes.length, 200); i++) {
      if ((bytes[i] >= 32 && bytes[i] <= 126) || bytes[i] === 9 || bytes[i] === 10 || bytes[i] === 13) printable++;
    }
    if (printable > 160 && bytes.length > 20) {
      return { type: 'text', mime: 'text/plain' };
    }
  } catch {
    // If decoding fails, fall through to unknown
  }
  return { type: 'unknown', mime: 'application/octet-stream' };
}

// ─── PDF viewer import ─────────────────────────────────────────────────────

import { PdfViewer } from './pdf-viewer';

// ─── Smart attachment preview wrapper ──────────────────────────────────────
// Detects actual file type from magic bytes, then renders the appropriate
// preview (PDF canvas, image inline, HTML rendered, text displayed).

function SmartAttachmentPreview({ base64, mime, filename }: { base64: string; mime: string; filename: string }) {
  const detected = detectFileType(base64);
  const fileSizeKB = Math.round((base64.length * 3) / 4 / 1024);

  // Show file info bar
  const fileInfo = (
    <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b bg-muted/50">
      <span className="truncate">{filename || 'attachment'}</span>
      <span className="shrink-0 ml-2">
        {detected.mime} · {fileSizeKB < 1024 ? `${fileSizeKB} KB` : `${(fileSizeKB / 1024).toFixed(1)} MB`}
      </span>
    </div>
  );

  // Render based on detected type (not the claimed MIME type)
  if (detected.type === 'pdf') {
    return (
      <div className="rounded-lg border overflow-hidden bg-muted/30">
        {fileInfo}
        <div className="p-4">
          <PdfViewer base64={base64} filename={filename} />
        </div>
      </div>
    );
  }

  if (detected.type === 'jpeg' || detected.type === 'png' || detected.type === 'webp') {
    return (
      <div className="rounded-lg border overflow-hidden bg-muted/30">
        {fileInfo}
        <img
          src={`data:${detected.mime};base64,${base64}`}
          alt={filename || 'Attachment'}
          className="w-full h-auto max-h-[50vh] object-contain bg-white"
        />
      </div>
    );
  }

  if (detected.type === 'html') {
    // Render HTML in a sandboxed iframe via blob URL
    let blobUrl: string | null = null;
    try {
      let htmlContent = atob(base64);

      // If the content starts with MIME headers (e.g., "Content-Type: text/html..."),
      // strip everything before the first <html> or <!DOCTYPE tag
      const htmlStartIdx = htmlContent.search(/<(!doctype|html|head|body|meta|table|div)/i);
      if (htmlStartIdx > 0) {
        htmlContent = htmlContent.slice(htmlStartIdx);
      }

      // Wrap in a basic HTML structure if not already
      if (!htmlContent.toLowerCase().includes('<html')) {
        htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;padding:20px;color:#333;line-height:1.5;} table{border-collapse:collapse;width:100%;} td,th{padding:8px;border:1px solid #ddd;}</style></head><body>${htmlContent}</body></html>`;
      }

      const bytes = new TextEncoder().encode(htmlContent);
      const blob = new Blob([bytes], { type: 'text/html;charset=utf-8' });
      blobUrl = URL.createObjectURL(blob);
    } catch {}

    return (
      <div className="rounded-lg border overflow-hidden bg-muted/30">
        {fileInfo}
        <div className="p-2">
          {blobUrl ? (
            <iframe
              src={blobUrl}
              className="w-full h-[50vh] border-0 rounded bg-white"
              title="Email HTML preview"
              sandbox="allow-same-origin allow-popups"
            />
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">Failed to render HTML.</div>
          )}
        </div>
      </div>
    );
  }

  if (detected.type === 'text') {
    let text = '';
    try {
      text = atob(base64);
    } catch {}
    return (
      <div className="rounded-lg border overflow-hidden bg-muted/30">
        {fileInfo}
        <pre className="p-4 text-xs whitespace-pre-wrap break-words max-h-[50vh] overflow-auto font-mono">
          {text.slice(0, 5000)}{text.length > 5000 ? '\n\n... (truncated)' : ''}
        </pre>
      </div>
    );
  }

  // Unknown file type — show download link
  return (
    <div className="rounded-lg border overflow-hidden bg-muted/30">
      {fileInfo}
      <div className="p-8 text-center space-y-3">
        <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Preview not available for this file type.
        </p>
        <p className="text-xs text-muted-foreground">
          Detected: {detected.mime} · {fileSizeKB < 1024 ? `${fileSizeKB} KB` : `${(fileSizeKB / 1024).toFixed(1)} MB`}
        </p>
        <button
          onClick={() => downloadBlob(base64, detected.mime, filename)}
          className="inline-flex items-center gap-1.5 text-sm text-amber-500 hover:underline"
        >
          <Download className="h-4 w-4" /> Download file
        </button>
      </div>
    </div>
  );
}

// Download helper — uses Blob URL instead of data: URL to avoid browser crashes
// on large files (data: URLs can exceed browser URL length limits)
function downloadBlob(base64: string, mime: string, filename: string) {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('Download failed:', err);
    alert('Download failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
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
  const [filter, setFilter] = useState('pending');
  const [counts, setCounts] = useState({ pending: 0, approved: 0, skipped: 0, blocked: 0 });

  // Inbox list + scan state
  const [inboxes, setInboxes] = useState<Array<{ id: string; label: string; emailAddress: string; active: boolean }>>([]);
  const [scanning, setScanning] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<string>('all'); // 'all' or inbox ID

  const loadItems = useCallback(async (status?: string) => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const s = status || filter;
      const res = await fetch(`/api/pending-review?status=${s}`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
      // Also load counts for all statuses
      const countRes = await fetch('/api/pending-review?status=all', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (countRes.ok) {
        const allItems = await countRes.json();
        if (Array.isArray(allItems)) {
          setCounts({
            pending: allItems.filter((i: PendingItem) => i.status === 'pending').length,
            approved: allItems.filter((i: PendingItem) => i.status === 'approved').length,
            skipped: allItems.filter((i: PendingItem) => i.status === 'skipped').length,
            blocked: allItems.filter((i: PendingItem) => i.status === 'blocked').length,
          });
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Load inbox list for the scan dropdown
  const loadInboxes = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/email-inboxes', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        const data = await res.json();
        setInboxes((data.inboxes || []).filter((i: { active: boolean }) => i.active));
      }
    } catch {
      // silent
    }
  }, []);

  // Scan from the Pending tab (no need to go to Settings)
  const handleScan = async (direction: 'oldest' | 'newest') => {
    if (inboxes.length === 0) {
      toast.error('No active inboxes. Add one in Settings first.');
      return;
    }
    setScanning(true);
    const token = getToken();
    if (!token) { setScanning(false); return; }

    // If only one inbox, scan it directly. Otherwise scan all active inboxes.
    let totalScanned = 0, totalPending = 0, totalSkipped = 0, totalRemaining = 0;
    let error: string | null = null;

    for (const inbox of inboxes) {
      try {
        const res = await fetch(`/api/email-inboxes/${inbox.id}/scan`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction }),
        });
        const data = await res.json();
        if (res.ok) {
          totalScanned += data.scanned || 0;
          totalPending += data.pending || 0;
          totalSkipped += data.skipped || 0;
          totalRemaining += data.remaining || 0;
          if (data.error) error = data.error;
        } else {
          error = data.error || 'Scan failed';
        }
      } catch {
        error = 'Network error';
      }
    }

    setScanning(false);

    if (totalScanned === 0 && totalPending === 0 && !error) {
      toast.success('No new emails to scan. All caught up!');
    } else {
      let msg = `Scanned: ${totalScanned} | New pending: ${totalPending} | Skipped: ${totalSkipped}`;
      if (totalRemaining > 0) msg += ` | ${totalRemaining} remaining`;
      if (error) msg += ` | Error: ${error}`;
      toast.success(msg);
    }
    loadItems(); // refresh the pending list
  };

  useEffect(() => {
    loadItems();
    loadInboxes();
  }, [loadItems, loadInboxes]);

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
        toast.success(addToTrusted ? 'Approved + sender added to trusted' : 'Invoice approved');
        loadItems(); // reload to move item to 'approved' tab
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
        loadItems();
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
        loadItems();
      } else {
        toast.error('Failed to block sender');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setProcessing(null);
    }
  };

  const restore = async (id: string) => {
    const token = getToken();
    if (!token) return;
    setProcessing(id);
    try {
      const res = await fetch(`/api/pending-review/${id}/restore`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        toast.success('Restored to pending');
        loadItems();
      } else {
        toast.error('Failed to restore');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setProcessing(null);
    }
  };

  const unapprove = async (id: string) => {
    if (!confirm('Un-approve this item? The invoice will be DELETED and the item will go back to pending.')) return;
    const token = getToken();
    if (!token) return;
    setProcessing(id);
    try {
      const res = await fetch(`/api/pending-review/${id}/unapprove`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        toast.success('Un-approved — invoice deleted, item back in pending');
        loadItems();
      } else {
        toast.error('Failed to un-approve');
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

  // Filter items by inbox
  const filteredItems = inboxFilter === 'all'
    ? items
    : items.filter((i) => i.inboxId === inboxFilter);

  // Get unique inbox labels for the filter
  const inboxLabels: Record<string, string> = {};
  for (const inbox of inboxes) {
    inboxLabels[inbox.id] = inbox.label || inbox.emailAddress;
  }

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
            {filter === 'pending' && filteredItems.length > 0
              ? `${filteredItems.length} email${filteredItems.length !== 1 ? 's' : ''} waiting for your review.`
              : filter === 'pending'
                ? 'No emails waiting. Click "Scan" below to check your inbox for new invoices.'
                : `${filteredItems.length} ${filter} item${filteredItems.length !== 1 ? 's' : ''}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Scan dropdown — replaces the need to go to Settings */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={scanning || inboxes.length === 0}>
                {scanning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Scan Inboxes
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Scan direction</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleScan('newest')} className="cursor-pointer">
                <ArrowDownWideNarrow className="h-4 w-4 mr-2" />
                <div>
                  <p className="font-medium">Newest first</p>
                  <p className="text-xs text-muted-foreground">Scan the 25 most recent unprocessed emails</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleScan('oldest')} className="cursor-pointer">
                <ArrowUpWideNarrow className="h-4 w-4 mr-2" />
                <div>
                  <p className="font-medium">Oldest first</p>
                  <p className="text-xs text-muted-foreground">Scan the 25 oldest unprocessed emails</p>
                </div>
              </DropdownMenuItem>
              {inboxes.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1">No active inboxes. Add one in Settings.</p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => loadItems()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Status tabs + inbox filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Tabs value={filter} onValueChange={(v) => { setFilter(v); loadItems(v); }}>
          <TabsList>
            <TabsTrigger value="pending">
              Pending {counts.pending > 0 && `(${counts.pending})`}
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved {counts.approved > 0 && `(${counts.approved})`}
            </TabsTrigger>
            <TabsTrigger value="skipped">
              Skipped {counts.skipped > 0 && `(${counts.skipped})`}
            </TabsTrigger>
            <TabsTrigger value="blocked">
              Blocked {counts.blocked > 0 && `(${counts.blocked})`}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Inbox/domain filter — only show if user has multiple inboxes */}
        {inboxes.length > 1 && (
          <div className="flex items-center gap-2 ml-auto">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={inboxFilter}
              onChange={(e) => setInboxFilter(e.target.value)}
              className="text-xs border rounded-md px-2 py-1.5 bg-background"
            >
              <option value="all">All inboxes</option>
              {inboxes.map((inbox) => (
                <option key={inbox.id} value={inbox.id}>{inbox.label || inbox.emailAddress}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Bulk actions bar — only for pending items */}
      {filter === 'pending' && hasSelection && (
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
        <Card data-glow data-glow-border-only className="glass-card"><CardContent className="py-12 text-center">
          <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">Loading pending emails...</p>
        </CardContent></Card>
      ) : items.length === 0 ? (
        <Card data-glow data-glow-border-only className="glass-card"><CardContent className="py-12 text-center">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">No pending emails</p>
          <p className="text-sm text-muted-foreground mt-1">
            Go to Settings → Email Inboxes to add an inbox and scan for invoices.
          </p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {/* Select all header — only for pending */}
          {filter === 'pending' && (
            <div className="flex items-center gap-2 px-2 py-1">
              <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
              <span className="text-xs text-muted-foreground">Select all ({filteredItems.length})</span>
            </div>
          )}
          {filteredItems.map((item) => (
            <Card key={item.id} data-glow data-glow-border-only className={`glass-card border-border/50 ${selectedIds.has(item.id) ? 'ring-2 ring-amber-500/30' : ''}`}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  {filter === 'pending' && (
                    <div className="pt-1">
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </div>
                  )}
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
                    {/* Actions — different per status */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.status === 'pending' && (
                        <>
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
                            Approve + Trust
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
                        </>
                      )}
                      {item.status === 'approved' && (
                        <>
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-0 text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Approved → Invoice created
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => unapprove(item.id)}
                            disabled={processing === item.id}
                            className="h-7 text-xs text-amber-600 hover:text-amber-700 ml-auto"
                          >
                            {processing === item.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Undo2 className="h-3 w-3 mr-1" />}
                            Un-approve
                          </Button>
                        </>
                      )}
                      {item.status === 'skipped' && (
                        <>
                          <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 text-xs gap-1">
                            <XCircle className="h-3 w-3" /> Skipped
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => restore(item.id)}
                            disabled={processing === item.id}
                            className="h-7 text-xs text-amber-600 hover:text-amber-700 ml-auto"
                          >
                            {processing === item.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                            Restore to Pending
                          </Button>
                        </>
                      )}
                      {item.status === 'blocked' && (
                        <>
                          <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-0 text-xs gap-1">
                            <Ban className="h-3 w-3" /> Sender blocked
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => restore(item.id)}
                            disabled={processing === item.id}
                            className="h-7 text-xs text-amber-600 hover:text-amber-700 ml-auto"
                          >
                            {processing === item.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                            Unblock + Restore
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview Dialog — shows full email info + attachment */}
      <Dialog open={!!previewItem} onOpenChange={(open) => { if (!open) { setPreviewItem(null); setPreviewData(null); } }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-amber-500" />
              {previewItem?.subject || '(no subject)'}
            </DialogTitle>
            <DialogDescription className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-foreground">{previewItem?.fromName || previewItem?.fromAddress}</span>
                {previewItem?.fromName && <span className="text-muted-foreground">&lt;{previewItem.fromAddress}&gt;</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {previewItem ? fmtRelativeTime(previewItem.receivedAt) : ''}</span>
                <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {previewItem?.attachmentFilename}</span>
              </div>
            </DialogDescription>
          </DialogHeader>

          {/* Email info card */}
          {previewItem && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground font-medium w-20 shrink-0">From:</span>
                <span className="text-sm">{previewItem.fromName || previewItem.fromAddress}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground font-medium w-20 shrink-0">Subject:</span>
                <span className="text-sm">{previewItem.subject}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground font-medium w-20 shrink-0">Received:</span>
                <span className="text-sm">{new Date(previewItem.receivedAt).toLocaleString()}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground font-medium w-20 shrink-0">File:</span>
                <span className="text-sm font-mono">{previewItem.attachmentFilename}</span>
              </div>
              <ClassificationBadge classification={previewItem.classification} />
            </div>
          )}

          {/* Attachment preview — smart detection from magic bytes */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Attachment Preview</h4>
            {previewLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground ml-2">Loading...</span>
              </div>
            ) : previewData ? (
              <SmartAttachmentPreview
                base64={previewData.attachmentData}
                mime={previewData.attachmentMime}
                filename={previewItem?.attachmentFilename || 'attachment'}
              />
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Failed to load attachment.
              </div>
            )}
          </div>

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
