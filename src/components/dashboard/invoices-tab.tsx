'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  Trash2,
  FileJson,
  Inbox,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Circle,
  XCircle,
  Clock,
  Timer,
  X,
  Eye,
  ScanSearch,
  PencilRuler,
  Sparkles,
  CalendarClock,
  Upload,
  Pencil,
  Lock,
  FileDown,
  Save,
  Undo2,
  FileText,
  ArrowUpDown,
  Mail,
} from 'lucide-react';
import { ConfidenceMeter } from './confidence-meter';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/app-store';
import type { InvoiceRow } from '@/stores/app-store';
import { calculateAging } from '@/lib/invoice-engine';

type SortKey = 'createdAt' | 'total' | 'vendor' | 'invDate' | 'confidence';
type SortDir = 'asc' | 'desc';

const SORT_OPTIONS: { key: SortKey; label: string; defaultDir: SortDir }[] = [
  { key: 'createdAt', label: 'Date Uploaded', defaultDir: 'desc' },
  { key: 'total', label: 'Total Amount', defaultDir: 'desc' },
  { key: 'vendor', label: 'Vendor Name', defaultDir: 'asc' },
  { key: 'invDate', label: 'Invoice Date', defaultDir: 'desc' },
  { key: 'confidence', label: 'Confidence', defaultDir: 'desc' },
];

function getToken(): string | null {
  return localStorage.getItem('op_token');
}

interface AuditLogEntry {
  id: string;
  action: string;
  details?: string;
  createdAt: string;
}

export function InvoicesTab({ invoices, searchQuery }: { invoices: InvoiceRow[]; searchQuery: string }) {
  const { setInvoices, user } = useAppStore();
  const plan = user?.plan || 'free';
  const hasBulkOps = ['plus', 'business', 'enterprise'].includes(plan);
  const canEdit = ['pro', 'plus', 'business', 'enterprise'].includes(plan);
  const canChangeLifecycle = true;
  const canLoadCustomStatuses = ['plus', 'business', 'enterprise'].includes(plan);

  const [filter, setFilter] = useState('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [showNormalized, setShowNormalized] = useState(false);

  // Bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Audit logs for detail dialog
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // File viewer for detail dialog
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editChanges, setEditChanges] = useState<Array<{ field: string; oldValue: string; newValue: string }> | null>(null);

  // Sort state
  const [sortBy, setSortBy] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Lifecycle status
  const [customStatuses, setCustomStatuses] = useState<Array<{ id: string; name: string; color: string; isBasic: boolean }>>([]);
  const [statusChanging, setStatusChanging] = useState<string | null>(null);

  // Reviewed (manually-checked) tracking — independent of auto validationStatus
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [hideReviewed, setHideReviewed] = useState(false);

  // Basic lifecycle statuses available to all Pro+ users
  const basicStatuses = [
    { id: 'pending', name: 'Pending', color: 'amber', isBasic: true },
    { id: 'approved', name: 'Approved', color: 'emerald', isBasic: true },
    { id: 'exported', name: 'Exported', color: 'blue', isBasic: true },
    { id: 'paid', name: 'Paid', color: 'violet', isBasic: true },
  ];

  const allStatuses = [...basicStatuses, ...customStatuses.filter((s) => !s.isBasic)];

  // Helper: was this invoice manually marked as checked by the user?
  const isReviewed = (inv: InvoiceRow): boolean =>
    Boolean((inv.customFields as Record<string, unknown> | null)?.reviewed === true);

  const filtered = filter === 'all'
    ? invoices
    : filter === 'duplicates'
      ? invoices.filter((inv) => inv.isDuplicate)
      : invoices.filter((inv) => inv.status === filter);

  // Apply search query if present
  const searched = (searchQuery.trim()
    ? filtered.filter((inv) => {
        const q = searchQuery.toLowerCase();
        return (
          (inv.vendor ?? '').toLowerCase().includes(q) ||
          (inv.invNumber ?? '').toLowerCase().includes(q) ||
          (inv.invDate ?? '').toLowerCase().includes(q)
        );
      })
    : filtered
  ).filter((inv) => (hideReviewed ? !isReviewed(inv) : true));

  // Apply sorting
  const displayed = useMemo(() => {
    const sorted = [...searched];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'total':
          cmp = (a.total ?? 0) - (b.total ?? 0);
          break;
        case 'vendor':
          cmp = (a.vendor ?? '').localeCompare(b.vendor ?? '');
          break;
        case 'invDate':
          cmp = (a.invDate ?? '').localeCompare(b.invDate ?? '');
          break;
        case 'confidence':
          cmp = (a.confidence ?? 0) - (b.confidence ?? 0);
          break;
        case 'createdAt':
        default:
          cmp = (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [searched, sortBy, sortDir]);

  const totalAmount = displayed.reduce((sum, inv) => sum + (inv.total ?? 0), 0);

  // Select all / deselect
  const allSelected = displayed.length > 0 && displayed.every((inv) => selectedIds.has(inv.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayed.map((inv) => inv.id)));
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

  // Fetch audit logs + file data when detail dialog opens
  useEffect(() => {
    if (!selectedInvoice) {
      setAuditLogs([]);
      setFileDataUrl(null);
      setFileType(null);
      return;
    }
    const token = getToken();
    if (!token) return;
    setAuditLoading(true);
    setFileLoading(true);
    // Fetch audit logs
    fetch(`/api/audit-logs?invoiceId=${encodeURIComponent(selectedInvoice.id)}`, {
      headers: { Authorization: 'Bearer ' + token },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAuditLogs(Array.isArray(data) ? data.slice(0, 6) : []))
      .catch(() => {})
      .finally(() => setAuditLoading(false));
    // Fetch file data for viewing (binary endpoint — avoids 4.5MB JSON limit)
    setFileError(null);
    fetch(`/api/invoices/${encodeURIComponent(selectedInvoice.id)}/file`, {
      headers: { Authorization: 'Bearer ' + token },
    })
      .then((r) => {
        if (!r.ok) {
          if (r.status === 404) {
            setFileError(null); // No file, not an error
          } else if (r.status === 410) {
            setFileError('File preview expired after 30 days. Extraction data is still available below.');
          } else if (r.status === 413) {
            setFileError('File too large to preview (over 4MB). Try downloading it directly.');
          } else {
            setFileError(`Failed to load file (HTTP ${r.status})`);
          }
          return null;
        }
        const contentType = r.headers.get('Content-Type') || 'application/octet-stream';
        setFileType(contentType);
        return r.blob();
      })
      .then((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setFileDataUrl(url);
        }
      })
      .catch((err) => {
        setFileError(err instanceof Error ? err.message : 'Failed to load file');
      })
      .finally(() => setFileLoading(false));
  }, [selectedInvoice?.id]);

  // Fetch custom statuses for Plus+ users
  useEffect(() => {
    if (!canLoadCustomStatuses) return;
    const token = getToken();
    if (!token) return;
    fetch('/api/custom-statuses', {
      headers: { Authorization: 'Bearer ' + token },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCustomStatuses(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [canLoadCustomStatuses]);

  // Reset editing state and revoke blob URL when dialog closes
  const blobUrlRef = useRef<string | null>(null);
  useEffect(() => {
    // Track the current blob URL so we can revoke it on cleanup
    blobUrlRef.current = fileDataUrl;
  }, [fileDataUrl]);

  useEffect(() => {
    if (!selectedInvoice) {
      setIsEditing(false);
      setEditFields({});
      setEditChanges(null);
      // Revoke previous blob URL to free memory
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    }
  }, [selectedInvoice?.id]);

  const startEditing = () => {
    if (!selectedInvoice) return;
    const inv = selectedInvoice;
    setEditFields({
      vendor: inv.vendor ?? '',
      invNumber: inv.invNumber ?? '',
      invDate: inv.invDate ?? '',
      dueDate: inv.dueDate ?? '',
      amount: inv.amount != null ? String(inv.amount) : '',
      vatAmount: inv.vatAmount != null ? String(inv.vatAmount) : '',
      total: inv.total != null ? String(inv.total) : '',
      currency: inv.currency ?? 'USD',
    });
    setEditChanges(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditFields({});
    setEditChanges(null);
  };

  const saveEdit = async () => {
    if (!selectedInvoice) return;
    const token = getToken();
    if (!token) {
      toast.error('Session expired. Please sign in again.');
      return;
    }
    setEditSaving(true);
    try {
      const body = {
        vendor: editFields.vendor,
        invNumber: editFields.invNumber,
        invDate: editFields.invDate,
        dueDate: editFields.dueDate,
        amount: editFields.amount ? parseFloat(editFields.amount) : null,
        vatAmount: editFields.vatAmount ? parseFloat(editFields.vatAmount) : null,
        total: editFields.total ? parseFloat(editFields.total) : null,
        currency: editFields.currency,
      };
      const res = await fetch(`/api/invoices/${encodeURIComponent(selectedInvoice.id)}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        // Show diff
        if (data.changes && Array.isArray(data.changes)) {
          setEditChanges(data.changes);
        }
        // Update the invoice in the store
        const updatedInvoice = {
          ...selectedInvoice,
          ...body,
        };
        setSelectedInvoice(updatedInvoice);
        setInvoices(invoices.map((inv) => inv.id === selectedInvoice.id ? updatedInvoice : inv));
        setIsEditing(false);
        toast.success('Invoice updated successfully');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to update invoice');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setEditSaving(false);
    }
  };

  const changeLifecycleStatus = async (invoiceId: string, newStatus: string) => {
    const token = getToken();
    if (!token) return;
    setStatusChanging(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update the invoice in the store
        const updatedInvoices = invoices.map((inv) =>
          inv.id === invoiceId ? { ...inv, lifecycleStatus: data.lifecycleStatus ?? newStatus } : inv
        );
        setInvoices(updatedInvoices);
        // If this invoice is the selected one, update it too
        if (selectedInvoice?.id === invoiceId) {
          setSelectedInvoice({ ...selectedInvoice, lifecycleStatus: data.lifecycleStatus ?? newStatus });
        }
        toast.success(`Status changed to "${newStatus}"`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to update status');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setStatusChanging(null);
    }
  };

  const toggleReviewed = async (invoiceId: string, currentlyReviewed: boolean) => {
    const token = getToken();
    if (!token) {
      toast.error('Session expired. Please sign in again.');
      return;
    }
    setReviewing(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/review`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: !currentlyReviewed }),
      });
      if (res.ok) {
        const data = await res.json();
        // Merge reviewed flag into customFields for both list and selected invoice
        const updatedInvoices = invoices.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                customFields: { ...(inv.customFields as Record<string, unknown> | null ?? {}), reviewed: data.reviewed, reviewedAt: data.reviewedAt },
              }
            : inv
        );
        setInvoices(updatedInvoices);
        if (selectedInvoice?.id === invoiceId) {
          setSelectedInvoice({
            ...selectedInvoice,
            customFields: { ...(selectedInvoice.customFields as Record<string, unknown> | null ?? {}), reviewed: data.reviewed, reviewedAt: data.reviewedAt },
          });
        }
        toast.success(data.reviewed ? 'Marked as checked' : 'Marked as needs review');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to update review state');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setReviewing(null);
    }
  };

  const bulkMarkReviewed = async (reviewed: boolean) => {
    const token = getToken();
    if (!token) return;
    setBulkDeleting(true);
    try {
      const res = await fetch('/api/bulk-actions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: reviewed ? 'set_reviewed' : 'set_unreviewed', invoiceIds: Array.from(selectedIds) }),
      });
      if (res.ok) {
        // Update local state — merge reviewed flag into customFields
        const updatedInvoices = invoices.map((inv) => {
          if (!selectedIds.has(inv.id)) return inv;
          return {
            ...inv,
            customFields: {
              ...(inv.customFields as Record<string, unknown> | null ?? {}),
              reviewed,
              reviewedAt: reviewed ? new Date().toISOString() : null,
            },
          };
        });
        setInvoices(updatedInvoices);
        toast.success(`${selectedIds.size} invoice${selectedIds.size !== 1 ? 's' : ''} ${reviewed ? 'marked as checked' : 'marked as needs review'}`);
        setSelectedIds(new Set());
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Bulk update failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setBulkDeleting(false);
    }
  };

  const deleteInvoice = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const token = getToken();
    if (!token) {
      toast.error('Session expired. Please sign in again.');
      return;
    }

    setDeleting(id);
    try {
      const res = await fetch('/api/invoices?id=' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        setInvoices(invoices.filter((inv) => inv.id !== id));
        toast.success('Invoice deleted');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(null);
    }
  };

  const bulkDelete = async () => {
    const token = getToken();
    if (!token) return;
    setBulkDeleting(true);
    try {
      const res = await fetch('/api/bulk-actions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', invoiceIds: Array.from(selectedIds) }),
      });
      if (res.ok) {
        const count = selectedIds.size;
        setInvoices(invoices.filter((inv) => !selectedIds.has(inv.id)));
        setSelectedIds(new Set());
        toast.success(`Deleted ${count} invoice${count !== 1 ? 's' : ''}`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Bulk delete failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setBulkDeleting(false);
    }
  };

  const exportSelectedCSV = () => {
    const selected = invoices.filter((inv) => selectedIds.has(inv.id));
    if (selected.length === 0) return;
    const header = 'Vendor,Invoice #,Date,Amount,VAT,Total,Currency,Status,Confidence,Validation Status,Processing Time\n';
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = selected.map((inv) =>
      [inv.vendor, inv.invNumber, inv.invDate, inv.amount, inv.vatAmount, inv.total, inv.currency, inv.status, inv.confidence, inv.validationStatus ?? '', inv.processingTime != null ? `${inv.processingTime.toFixed(1)}s` : ''].map(esc).join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'selected-invoices.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const exportCSV = () => {
    const header = 'Vendor,Invoice #,Date,Amount,VAT,Total,Currency,Status,Confidence,Validation Status,Processing Time\n';
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = displayed.map((inv) =>
      [inv.vendor, inv.invNumber, inv.invDate, inv.amount, inv.vatAmount, inv.total, inv.currency, inv.status, inv.confidence, inv.validationStatus ?? '', inv.processingTime != null ? `${inv.processingTime.toFixed(1)}s` : ''].map(esc).join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoices.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(displayed, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoices.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('JSON exported');
  };

  const exportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wsData = [
        ['Vendor', 'Invoice #', 'Date', 'Amount', 'VAT', 'Total', 'Currency', 'Status', 'Confidence (%)', 'Validation Status', 'Processing Time'],
        ...displayed.map((inv) => [
          inv.vendor || '',
          inv.invNumber || '',
          inv.invDate || '',
          inv.amount ?? '',
          inv.vatAmount ?? '',
          inv.total ?? '',
          inv.currency || 'USD',
          inv.isDuplicate ? 'Duplicate' : inv.status === 'review' ? 'Review' : 'Done',
          inv.confidence ?? '',
          inv.validationStatus ?? 'N/A',
          inv.processingTime != null ? `${inv.processingTime.toFixed(1)}s` : '',
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [
        { wch: 28 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
        { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
      XLSX.writeFile(wb, 'invoices.xlsx');
      toast.success('Excel exported');
    } catch {
      toast.error('Failed to generate Excel file');
    }
  };

  const openDetail = useCallback((inv: InvoiceRow) => {
    setSelectedInvoice(inv);
  }, []);

  // ---- Render helpers ----

  const renderApprovalBadge = (status?: string | null) => {
    if (!status || status === 'none') return null;
    if (status === 'auto_approved') {
      return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-0 text-xs">Auto</Badge>;
    }
    if (status === 'pending_review') {
      return <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-0 text-xs">Review</Badge>;
    }
    if (status === 'blocked') {
      return <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-0 text-xs">Blocked</Badge>;
    }
    if (status === 'approved') {
      return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-0 text-xs">Approved</Badge>;
    }
    if (status === 'rejected') {
      return <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-0 text-xs">Rejected</Badge>;
    }
    return null;
  };

  const renderValidationBadge = (inv: InvoiceRow) => {
    const vs = inv.validationStatus;
    // If the user has manually marked this invoice as checked, show a calm
    // "Reviewed" badge instead of the auto-detected Warning/Fail. The full
    // validation details are still visible inside the detail dialog.
    if (isReviewed(inv)) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="cursor-help">
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-0 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Reviewed
              </Badge>
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px] text-left">
            <div className="space-y-1">
              <p className="font-semibold">You marked this invoice as checked</p>
              <p className="text-muted-foreground">The automated validation rules may still have flagged issues — open the detail view to see them. This badge just means you have reviewed the invoice manually.</p>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }
    if (!vs) return <span className="text-xs text-muted-foreground">—</span>;
    if (vs === 'fail')
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="cursor-help">
              <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-0 gap-1">
                <AlertCircle className="h-3 w-3" /> Fail
              </Badge>
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px] text-left">
            <div className="space-y-1">
              <p className="font-semibold">Hard validation error or possible tampering detected</p>
              <p className="text-muted-foreground">Do not approve this invoice until the issue is resolved. Open the detail view to see which rule failed — for example: invoice date after due date, negative amount, line items summing wrong, or PDF metadata suggesting the file was edited.</p>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    if (vs === 'warning')
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="cursor-help">
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-0 gap-1">
                <AlertTriangle className="h-3 w-3" /> Warning
              </Badge>
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px] text-left">
            <div className="space-y-1">
              <p className="font-semibold">A soft validation rule flagged this invoice</p>
              <p className="text-muted-foreground">The invoice was extracted successfully, but something looks unusual and you should manually verify it before approving. Common triggers: VAT rate over 30%, due date more than a year out, invoice date in the future, blank vendor name, or line items not summing to the total. Open the detail view to see which rules fired.</p>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    if (vs === 'pass')
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="cursor-help">
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-0 gap-1">
                <CheckCircle className="h-3 w-3" /> Pass
              </Badge>
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px] text-left">
            <div className="space-y-1">
              <p className="font-semibold">All validation rules passed</p>
              <p className="text-muted-foreground">The extracted data is internally consistent (dates are in order, VAT rate is reasonable, line items sum to the total, no tampering detected). You can proceed without manual verification.</p>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    return <span className="text-xs text-muted-foreground">N/A</span>;
  };

  const renderAging = (inv: InvoiceRow) => {
    const aging = calculateAging(inv);
    if (aging.status === 'overdue') {
      return (
        <span className="text-red-500 text-xs font-medium flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {aging.daysOverdue}d overdue
        </span>
      );
    }
    if (aging.status === 'upcoming') {
      return (
        <span className="text-amber-500 text-xs font-medium flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Due in {aging.daysUntilDue}d
        </span>
      );
    }
    if (aging.status === 'current') {
      return (
        <span className="text-emerald-500 text-xs font-medium">Current</span>
      );
    }
    if (!inv.dueDate && !inv.invDate) return <span className="text-xs text-muted-foreground">—</span>;
    return <span className="text-xs text-muted-foreground">—</span>;
  };

  const renderProcessingTime = (inv: InvoiceRow) => {
    if (inv.processingTime == null) return <span className="text-xs text-muted-foreground">—</span>;
    const t = inv.processingTime;
    const color = t < 3 ? 'text-emerald-500' : t <= 10 ? 'text-amber-500' : 'text-red-500';
    return (
      <span className={`${color} text-xs font-medium flex items-center gap-1`}>
        <Timer className="h-3 w-3" />
        {t.toFixed(1)}s
      </span>
    );
  };

  const fmtCurrency = (v: number | null | undefined, currency?: string | null) => {
    if (v == null || v === undefined) return '—';
    const code = (currency || 'USD').toUpperCase();
    try {
      // Use Intl.NumberFormat to render the correct currency symbol
      // (e.g. CZK → "Kč", EUR → "€", USD → "$", GBP → "£").
      // `currencyDisplay: 'narrowSymbol'` gives the short symbol where one exists.
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
      }).format(v);
    } catch {
      // Fallback for unknown currency codes: show raw number + code
      return `${v.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${code}`;
    }
  };

  const fmtRelativeTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
      const diffDay = Math.floor(diffHr / 24);
      if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
      return d.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const lifecycleColorMap: Record<string, string> = {
    pending: 'amber',
    approved: 'emerald',
    exported: 'blue',
    paid: 'emerald',
  };

  const renderLifecycleBadge = (status?: string | null) => {
    if (!status) return <span className="text-xs text-muted-foreground">—</span>;
    // Find matching status in allStatuses to get color
    const match = allStatuses.find((s) => s.id === status);
    const color = match?.color || lifecycleColorMap[status] || 'gray';
    const label = match?.name || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');

    const colorClasses: Record<string, string> = {
      amber: 'bg-amber-500/10 text-amber-500',
      emerald: 'bg-emerald-500/10 text-emerald-500',
      green: 'bg-green-500/10 text-green-500',
      blue: 'bg-blue-500/10 text-blue-500',
      red: 'bg-red-500/10 text-red-500',
      violet: 'bg-violet-500/10 text-violet-500',
      orange: 'bg-orange-500/10 text-orange-500',
      cyan: 'bg-cyan-500/10 text-cyan-500',
      pink: 'bg-pink-500/10 text-pink-500',
      gray: 'bg-muted text-muted-foreground',
    };

    return (
      <Badge variant="secondary" className={`${colorClasses[color] || colorClasses.gray} border-0 text-xs`}>
        {label}
      </Badge>
    );
  };

  const auditIcon = (action: string) => {
    switch (action) {
      case 'uploaded': return <Upload className="h-4 w-4 text-blue-500" />;
      case 'viewed': return <Eye className="h-4 w-4 text-sky-500" />;
      case 'edited': return <Pencil className="h-4 w-4 text-amber-500" />;
      case 'approved': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'deleted': return <Trash2 className="h-4 w-4 text-muted-foreground" />;
      default: return <Eye className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Parse line items — prefer dedicated field, fallback to rawExtraction inside customFields
  const getLineItems = (inv: InvoiceRow) => {
    // Direct lineItems field (from API)
    if (inv.lineItems && Array.isArray(inv.lineItems) && inv.lineItems.length > 0) {
      return inv.lineItems;
    }
    return null;
  };

  // ---- Detail Dialog ----

  const renderDetailDialog = () => {
    if (!selectedInvoice) return null;
    const inv = selectedInvoice;
    const vr = inv.validationResults;
    const lineItems = getLineItems(inv);

    const hasNormalizedDiff =
      (inv.normalizedVendor && inv.normalizedVendor !== inv.vendor) ||
      (inv.normalizedInvDate && inv.normalizedInvDate !== inv.invDate) ||
      (inv.normalizedDueDate && inv.normalizedDueDate !== inv.dueDate) ||
      (inv.normalizedTotal != null && inv.normalizedTotal !== inv.total) ||
      (inv.normalizedCurrency && inv.normalizedCurrency !== inv.currency);

    return (
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => { if (!open) setSelectedInvoice(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2 flex-wrap">
              {inv.vendor || 'Unknown Vendor'} — {inv.invNumber || 'N/A'}
              {isReviewed(inv) && (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-0 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {(() => {
                    const ts = (inv.customFields as Record<string, unknown> | null)?.reviewedAt;
                    if (typeof ts === 'string' && ts) {
                      try {
                        return `Checked ${fmtRelativeTime(ts)}`;
                      } catch {
                        return 'Checked';
                      }
                    }
                    return 'Checked';
                  })()}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Invoice details for {inv.vendor || 'Unknown Vendor'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 -mt-2">
                {/* Mark as checked / needs review — available on all plans */}
                <Button
                  variant={isReviewed(inv) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleReviewed(inv.id, isReviewed(inv))}
                  disabled={reviewing === inv.id}
                  className={isReviewed(inv) ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : ''}
                >
                  {reviewing === inv.id ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : isReviewed(inv) ? (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  ) : (
                    <Circle className="h-4 w-4 mr-1" />
                  )}
                  {isReviewed(inv) ? 'Checked' : 'Mark as Checked'}
                </Button>
                {canEdit ? (
                  isEditing ? (
                    <>
                      <Button variant="outline" size="sm" onClick={cancelEditing} disabled={editSaving}>
                        <Undo2 className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                      <Button size="sm" onClick={saveEdit} disabled={editSaving}>
                        {editSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={startEditing}>
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                  )
                ) : (
                  <Tooltip>
                    <TooltipTrigger>
                      <Button variant="outline" size="sm" disabled>
                        <Lock className="h-4 w-4 mr-1" /> Edit
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Upgrade to Pro to edit invoices</TooltipContent>
                  </Tooltip>
                )}
          </div>

          {/* Edit Changes Diff */}
          {editChanges && editChanges.length > 0 && (
            <div className="rounded-lg border bg-amber-500/5 border-amber-500/20 p-3">
              <h4 className="text-sm font-semibold text-amber-500 mb-2">Changes Made</h4>
              <div className="space-y-1.5">
                {editChanges.map((change, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-muted-foreground min-w-[80px]">{change.field}</span>
                    <span className="line-through text-red-500">{String(change.oldValue || '—')}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium text-emerald-500">{String(change.newValue || '—')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Core fields grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {isEditing ? (
              <>
                <EditDetailField label="Vendor" value={editFields.vendor} onChange={(v) => setEditFields((f) => ({ ...f, vendor: v }))} />
                <EditDetailField label="Invoice #" value={editFields.invNumber} onChange={(v) => setEditFields((f) => ({ ...f, invNumber: v }))} />
                <EditDetailField label="Date" value={editFields.invDate} onChange={(v) => setEditFields((f) => ({ ...f, invDate: v }))} />
                <EditDetailField label="Due Date" value={editFields.dueDate} onChange={(v) => setEditFields((f) => ({ ...f, dueDate: v }))} />
                <EditDetailField label="Amount" value={editFields.amount} onChange={(v) => setEditFields((f) => ({ ...f, amount: v }))} mono />
                <EditDetailField label="VAT" value={editFields.vatAmount} onChange={(v) => setEditFields((f) => ({ ...f, vatAmount: v }))} mono />
                <EditDetailField label="Total" value={editFields.total} onChange={(v) => setEditFields((f) => ({ ...f, total: v }))} mono />
                <EditDetailField label="Currency" value={editFields.currency} onChange={(v) => setEditFields((f) => ({ ...f, currency: v }))} />
                <DetailField
                  label="Status"
                  value={inv.isDuplicate ? 'Duplicate' : inv.status === 'review' ? 'Review' : 'Done'}
                />
                <DetailField
                  label="Confidence"
                  value={inv.confidence != null ? `${Math.round(inv.confidence * 100)}%` : 'N/A'}
                />
              </>
            ) : (
              <>
                <DetailField label="Vendor" value={inv.vendor} />
                <DetailField label="Invoice #" value={inv.invNumber} mono />
                <DetailField label="Date" value={inv.invDate} />
                <DetailField label="Due Date" value={inv.dueDate} />
                <DetailField label="Amount" value={inv.amount != null ? fmtCurrency(inv.amount, inv.currency) : null} />
                <DetailField label="VAT" value={inv.vatAmount != null ? fmtCurrency(inv.vatAmount, inv.currency) : null} />
                <DetailField label="Total" value={fmtCurrency(inv.total, inv.currency)} />
                <DetailField label="Currency" value={inv.currency} />
                <DetailField
                  label="Status"
                  value={
                    inv.isDuplicate ? 'Duplicate' : inv.status === 'review' ? 'Review' : 'Done'
                  }
                />
                <DetailField
                  label="Confidence"
                  value={inv.confidence != null ? `${Math.round(inv.confidence * 100)}%` : 'N/A'}
                />
              </>
            )}
          </div>

          {/* Original File Viewer */}
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Original File</h4>
            {fileLoading ? (
              <div className="flex items-center justify-center py-8 rounded-lg border bg-muted/30">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Loading file...</span>
              </div>
            ) : fileDataUrl && fileType ? (
              <div className="rounded-lg border overflow-hidden bg-muted/30">
                {fileType.startsWith('image/') ? (
                  <img
                    src={fileDataUrl}
                    alt={inv.filename || 'Invoice'}
                    className="w-full h-auto max-h-[60vh] object-contain bg-white"
                  />
                ) : fileType === 'application/pdf' ? (
                  <div className="p-4">
                    <div className="rounded border bg-white overflow-hidden">
                      <iframe
                        src={fileDataUrl}
                        className="w-full h-[50vh] border-0"
                        title={inv.filename || 'Invoice PDF'}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      If the PDF doesn't display, <a href={fileDataUrl} download={inv.filename || 'invoice.pdf'} className="text-primary hover:underline">download it</a> instead.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 text-center">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-3">{inv.filename}</p>
                    <a
                      href={fileDataUrl}
                      download={inv.filename || 'invoice'}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      <Download className="h-4 w-4" /> Download file
                    </a>
                  </div>
                )}
              </div>
            ) : fileError ? (
              <div className="py-4 rounded-lg border border-red-500/20 bg-red-500/5">
                <div className="flex items-center justify-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <p className="text-xs text-red-500">{fileError}</p>
                </div>
              </div>
            ) : (
              <div className="py-4 rounded-lg border bg-muted/20">
                <p className="text-xs text-muted-foreground text-center">No file stored for this invoice. Only invoices uploaded recently include the original file.</p>
              </div>
            )}
          </div>

          {/* Line Items */}
          {lineItems && lineItems.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">Line Items</h4>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium">Description</th>
                      <th className="text-right px-3 py-2 font-medium">Qty</th>
                      <th className="text-right px-3 py-2 font-medium">Unit Price</th>
                      <th className="text-right px-3 py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(lineItems as Array<Record<string, unknown>>).map((item, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-2">{String(item.description ?? item.name ?? '')}</td>
                        <td className="px-3 py-2 text-right font-mono">{String(item.quantity ?? item.qty ?? '')}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {item.unitPrice != null ? fmtCurrency(Number(item.unitPrice), inv.currency) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {item.total != null ? fmtCurrency(Number(item.total), inv.currency) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Validation Issues */}
          {vr && vr.rules && vr.rules.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">Validation Issues</h4>
              <div className="space-y-1.5">
                {vr.rules.map((rule, i) => {
                  const isError = rule.severity === 'error';
                  const isWarn = rule.severity === 'warning';
                  const Icon = isError ? AlertCircle : isWarn ? AlertTriangle : CheckCircle;
                  const iconColor = isError
                    ? 'text-red-500'
                    : isWarn
                      ? 'text-amber-500'
                      : 'text-emerald-500';
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2"
                    >
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor}`} />
                      <div className="text-xs">
                        <span className="font-medium">{rule.rule}</span>
                        {rule.field && (
                          <span className="text-muted-foreground ml-1">({rule.field})</span>
                        )}
                        <p className="text-muted-foreground mt-0.5">{rule.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Variance Checks */}
          {vr && vr.varianceChecks && vr.varianceChecks.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-semibold">Variance Checks</h4>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="cursor-help text-muted-foreground hover:text-foreground">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span className="sr-only">What does this mean?</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[320px] text-left">
                    <div className="space-y-1.5">
                      <p className="font-semibold">Internal consistency checks</p>
                      <p className="text-muted-foreground">
                        These checks compare line items <em>against each other</em> to spot outliers —
                        they don&apos;t compare against an external &quot;correct&quot; value.
                      </p>
                      <p className="text-muted-foreground">
                        <strong>Baseline</strong> = the average across all line items.<br />
                        <strong>Outlier</strong> = the one that deviates the most from the average.<br />
                        <strong>Variance</strong> = how far off it is, as a % of the average.
                      </p>
                      <p className="text-muted-foreground">
                        A warning here doesn&apos;t necessarily mean the extraction is wrong —
                        it just means one line item looks unusual compared to the others.
                        Open the invoice and verify the highlighted line.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium">Check</th>
                      <th className="text-right px-3 py-2 font-medium">Baseline (avg)</th>
                      <th className="text-right px-3 py-2 font-medium">Outlier</th>
                      <th className="text-right px-3 py-2 font-medium">Deviation</th>
                      <th className="text-center px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vr.varianceChecks.map((vc, i) => {
                      const checkLabel: Record<string, string> = {
                        unit_price: 'Unit price spread',
                        line_item: 'Line-item total spread',
                        total: 'Total vs (amount + VAT)',
                      };
                      return (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium">
                            {checkLabel[vc.field] || vc.field}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {typeof vc.expected === 'number' ? fmtCurrency(vc.expected, inv.currency) : vc.expected}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {typeof vc.actual === 'number' ? fmtCurrency(vc.actual, inv.currency) : vc.actual}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {vc.variancePercent.toFixed(1)}%
                            <span className="text-muted-foreground ml-1">(threshold {vc.threshold}{typeof vc.threshold === 'number' && vc.threshold <= 100 ? '%' : ''})</span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <MiniStatusBadge status={vc.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tampering Detection */}
          {vr && vr.tamperingCheck && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3">
                <h4 className="text-sm font-semibold">Tampering Detection</h4>
                {vr.tamperingCheck.isSuspicious ? (
                  <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-0">
                    <XCircle className="h-3 w-3 mr-1" /> Suspicious
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-0">
                    <CheckCircle className="h-3 w-3 mr-1" /> Clean
                  </Badge>
                )}
              </div>
              <div className="space-y-1.5">
                {vr.tamperingCheck.checks.map((check, i) => {
                  const iconMap: Record<string, React.ReactNode> = {
                    ai: <Sparkles className="h-3.5 w-3.5 text-violet-500 shrink-0" />,
                    editing: <PencilRuler className="h-3.5 w-3.5 text-amber-500 shrink-0" />,
                    metadata: <ScanSearch className="h-3.5 w-3.5 text-sky-500 shrink-0" />,
                    date: <CalendarClock className="h-3.5 w-3.5 text-orange-500 shrink-0" />,
                    structure: <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />,
                    visual: <Eye className="h-3.5 w-3.5 text-purple-500 shrink-0" />,
                  };
                  const labelMap: Record<string, string> = {
                    ai_tool_detected: 'AI Tool Detection',
                    editing_software: 'Editing Software',
                    stripped_metadata: 'Metadata Integrity',
                    suspicious_dimensions: 'Dimension Analysis',
                    origin_analysis: 'Origin Analysis',
                    date_inconsistency: 'Date Consistency',
                    date_mismatch: 'Date Mismatch',
                    editing_tool: 'Editing Tool',
                    modified_after_creation: 'Modification History',
                    metadata: 'Metadata Check',
                    visual_ai_analysis: 'AI Visual Analysis',
                    artifact_detail: 'AI Artifact Detail',
                  };
                  const borderColor = check.status === 'fail'
                    ? 'border-red-500/20 bg-red-500/5'
                    : check.status === 'warn'
                      ? 'border-amber-500/20 bg-amber-500/5'
                      : 'border-border/50 bg-muted/30';
                  return (
                    <div
                      key={i}
                      className={"flex items-start gap-2.5 rounded-md border px-3 py-2.5 " + borderColor}
                    >
                      {iconMap[check.icon || ''] || <ScanSearch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">
                            {labelMap[check.check] || check.check.replace(/_/g, ' ')}
                          </span>
                          <MiniStatusBadge status={check.status} />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{check.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Fields */}
          {inv.customFields && Object.keys(inv.customFields).length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">Custom Fields</h4>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                {Object.entries(inv.customFields).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="font-medium text-muted-foreground">{key}</span>
                    <span className="font-mono">{String(value ?? '')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Normalized Data */}
          {hasNormalizedDiff && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">Normalized Data</h4>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                {inv.normalizedVendor && inv.normalizedVendor !== inv.vendor && (
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Vendor</span>
                    <span>
                      <span className="line-through text-muted-foreground mr-2">{inv.vendor || '—'}</span>
                      <span className="font-medium">{inv.normalizedVendor}</span>
                    </span>
                  </div>
                )}
                {inv.normalizedInvDate && inv.normalizedInvDate !== inv.invDate && (
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Invoice Date</span>
                    <span>
                      <span className="line-through text-muted-foreground mr-2">{inv.invDate || '—'}</span>
                      <span className="font-medium">{inv.normalizedInvDate}</span>
                    </span>
                  </div>
                )}
                {inv.normalizedDueDate && inv.normalizedDueDate !== inv.dueDate && (
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Due Date</span>
                    <span>
                      <span className="line-through text-muted-foreground mr-2">{inv.dueDate || '—'}</span>
                      <span className="font-medium">{inv.normalizedDueDate}</span>
                    </span>
                  </div>
                )}
                {inv.normalizedTotal != null && inv.normalizedTotal !== inv.total && (
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Total</span>
                    <span>
                      <span className="line-through text-muted-foreground mr-2">{fmtCurrency(inv.total, inv.currency)}</span>
                      <span className="font-medium">{fmtCurrency(inv.normalizedTotal, inv.normalizedCurrency || inv.currency)}</span>
                    </span>
                  </div>
                )}
                {inv.normalizedCurrency && inv.normalizedCurrency !== inv.currency && (
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Currency</span>
                    <span>
                      <span className="line-through text-muted-foreground mr-2">{inv.currency}</span>
                      <span className="font-medium">{inv.normalizedCurrency}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audit Trail */}
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Audit Trail</h4>
            {auditLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No audit entries found.</p>
            ) : (
              <div className="relative ml-2 space-y-0">
                {auditLogs.map((entry, i) => (
                  <div key={entry.id || i} className="flex items-start gap-3 pb-3 relative">
                    {/* Timeline line */}
                    {i < auditLogs.length - 1 && (
                      <div className="absolute left-[9px] top-5 bottom-0 w-px bg-border" />
                    )}
                    <div className="relative z-10 mt-0.5 shrink-0">
                      {auditIcon(entry.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium capitalize">
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {fmtRelativeTime(entry.createdAt)}
                        </span>
                      </div>
                      {entry.details && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {typeof entry.details === 'string'
                            ? entry.details
                            : JSON.stringify(entry.details)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Close button */}
          <div className="mt-6 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(null)}>
              <X className="h-4 w-4 mr-1" /> Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Invoices</h2>
          <p className="text-muted-foreground mt-1">
            {displayed.length} invoice{displayed.length !== 1 ? 's' : ''} — Total:{' '}
            {(() => {
              // If all visible invoices share the same currency, show the
              // sum in that currency. Otherwise list each currency's subtotal.
              const currencies = new Set(
                displayed
                  .map((inv) => (showNormalized && inv.normalizedCurrency ? inv.normalizedCurrency : inv.currency) || 'USD')
                  .filter(Boolean)
              );
              if (currencies.size <= 1) {
                const cur = currencies.values().next().value as string | undefined;
                return fmtCurrency(totalAmount, cur);
              }
              // Mixed currencies: show subtotals per currency
              const subtotals = new Map<string, number>();
              for (const inv of displayed) {
                const cur = (showNormalized && inv.normalizedCurrency ? inv.normalizedCurrency : inv.currency) || 'USD';
                subtotals.set(cur, (subtotals.get(cur) ?? 0) + (inv.total ?? 0));
              }
              return Array.from(subtotals.entries())
                .map(([cur, amt]) => fmtCurrency(amt, cur))
                .join(' + ');
            })()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Scan Inboxes button — link to Pending tab */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => useAppStore.getState().setActiveDashTab('pending')}
            title="Go to Pending Review to scan your email inboxes"
          >
            <Mail className="h-4 w-4 mr-1" /> Scan Inboxes
          </Button>
          {/* Show Normalized toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="show-normalized"
              checked={showNormalized}
              onCheckedChange={setShowNormalized}
            />
            <Label htmlFor="show-normalized" className="text-sm text-muted-foreground cursor-pointer">
              Show Normalized
            </Label>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={displayed.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={exportCSV}>
                <FileJson className="mr-2 h-4 w-4" /> CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportJSON}>
                <FileJson className="mr-2 h-4 w-4" /> JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">All ({invoices.length})</TabsTrigger>
            <TabsTrigger value="review">
              Needs Review ({invoices.filter((inv) => !isReviewed(inv)).length})
            </TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
            <TabsTrigger value="duplicates">
              Duplicates ({invoices.filter((inv) => inv.isDuplicate).length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* "Needs Review" filter — only show invoices the user hasn't manually marked as checked */}
        <div className="flex items-center gap-2 sm:ml-2">
          <Switch
            id="hide-reviewed"
            checked={hideReviewed}
            onCheckedChange={setHideReviewed}
          />
          <Label htmlFor="hide-reviewed" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
            Hide checked
          </Label>
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2 ml-auto">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select
            value={`${sortBy}-${sortDir}`}
            onValueChange={(v) => {
              const [key, dir] = v.split('-') as [SortKey, SortDir];
              setSortBy(key);
              setSortDir(dir);
            }}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={`${opt.key}-${opt.defaultDir}`} value={`${opt.key}-${opt.defaultDir}`}>
                  {opt.label} {opt.defaultDir === 'desc' ? '↓' : '↑'}
                </SelectItem>
              ))}
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={`${opt.key}-${opt.defaultDir === 'desc' ? 'asc' : 'desc'}`} value={`${opt.key}-${opt.defaultDir === 'desc' ? 'asc' : 'desc'}`}>
                  {opt.label} {opt.defaultDir === 'desc' ? '↑' : '↓'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            title={sortDir === 'asc' ? 'Sort descending' : 'Sort ascending'}
          >
            <ArrowUpDown className={`h-3.5 w-3.5 ${sortDir === 'desc' ? 'rotate-180' : ''} transition-transform`} />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {/* Checkbox column */}
                <th className="px-3 py-3 w-10">
                  {hasBulkOps ? (
                    <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                  ) : (
                    <Tooltip>
                      <TooltipTrigger>
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>Bulk operations require Plus plan</TooltipContent>
                    </Tooltip>
                  )}
                </th>
                <th className="text-left px-4 py-3 font-medium">Vendor</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">
                  {showNormalized ? 'Norm. Vendor' : 'Date'}
                </th>
                <th className="text-right px-4 py-3 font-medium">
                  {showNormalized ? 'Norm. Total' : 'Total'}
                </th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">Approval</th>
                <th className="text-center px-4 py-3 font-medium hidden xl:table-cell">Validation</th>
                <th className="text-center px-4 py-3 font-medium hidden lg:table-cell">Confidence</th>
                <th className="text-center px-4 py-3 font-medium hidden lg:table-cell">Aging</th>
                <th className="text-center px-4 py-3 font-medium hidden xl:table-cell">Proc. Time</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">Lifecycle</th>
                <th className="text-center px-3 py-3 font-medium w-[88px]">Checked</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={15} className="text-center py-12 text-muted-foreground">
                    <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>No invoices found</p>
                  </td>
                </tr>
              ) : (
                displayed.map((inv) => (
                  <tr
                    key={inv.id}
                    className={"border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer "
                      + (selectedIds.has(inv.id) ? 'bg-amber-500/5 ' : '')
                      + (isReviewed(inv) ? 'bg-emerald-500/[0.03] ' : '')}
                    onClick={() => openDetail(inv)}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      {hasBulkOps ? (
                        <Checkbox
                          checked={selectedIds.has(inv.id)}
                          onCheckedChange={() => toggleSelect(inv.id)}
                        />
                      ) : null}
                    </td>
                    {/* Vendor */}
                    <td className="px-4 py-3">
                      <div className="font-medium flex items-center gap-1.5">
                        {showNormalized && inv.normalizedVendor ? inv.normalizedVendor : inv.vendor}
                        {inv.isDuplicate && (
                          <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-0 text-[10px] px-1.5 py-0">
                            Duplicate
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground md:hidden">{inv.invNumber}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">
                      {inv.invNumber}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {showNormalized && inv.normalizedInvDate ? inv.normalizedInvDate : inv.invDate}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {showNormalized && inv.normalizedTotal != null
                        ? fmtCurrency(inv.normalizedTotal, inv.normalizedCurrency || inv.currency)
                        : fmtCurrency(inv.total, inv.currency)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {inv.isDuplicate ? (
                        <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-0">
                          Duplicate
                        </Badge>
                      ) : inv.status === 'review' ? (
                        <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 border-0">
                          Review
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-0">
                          Done
                        </Badge>
                      )}
                    </td>
                    {/* Approval Status */}
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      {renderApprovalBadge(inv.approvalStatus)}
                    </td>
                    {/* Validation Status */}
                    <td className="px-4 py-3 text-center hidden xl:table-cell">
                      {renderValidationBadge(inv)}
                    </td>
                    {/* Confidence */}
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <ConfidenceMeter confidence={inv.confidence} fieldConfidence={inv.fieldConfidence} />
                    </td>
                    {/* Aging */}
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      {renderAging(inv)}
                    </td>
                    {/* Processing Time */}
                    <td className="px-4 py-3 text-center hidden xl:table-cell">
                      {renderProcessingTime(inv)}
                    </td>
                    {/* Lifecycle Status */}
                    <td className="px-4 py-3 text-center hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                      {canChangeLifecycle ? (
                        statusChanging === inv.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="cursor-pointer hover:opacity-80 transition-opacity">
                                {renderLifecycleBadge(inv.lifecycleStatus)}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center">
                              {allStatuses.map((status) => (
                                <DropdownMenuItem
                                  key={status.id}
                                  onClick={() => changeLifecycleStatus(inv.id, status.id)}
                                  className={inv.lifecycleStatus === status.id ? 'bg-muted' : ''}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`h-2 w-2 rounded-full ${
                                      status.color === 'amber' ? 'bg-amber-500' :
                                      status.color === 'emerald' ? 'bg-emerald-500' :
                                      status.color === 'green' ? 'bg-green-500' :
                                      status.color === 'blue' ? 'bg-blue-500' :
                                      status.color === 'red' ? 'bg-red-500' :
                                      status.color === 'violet' ? 'bg-violet-500' :
                                      status.color === 'orange' ? 'bg-orange-500' :
                                      status.color === 'cyan' ? 'bg-cyan-500' :
                                      status.color === 'pink' ? 'bg-pink-500' :
                                      'bg-gray-400'
                                    }`} />
                                    {status.name}
                                  </div>
                                </DropdownMenuItem>
                              ))}
                              {inv.lifecycleStatus && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => changeLifecycleStatus(inv.id, '')}
                                    className="text-muted-foreground"
                                  >
                                    Clear status
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )
                      ) : (
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center gap-1">
                              {renderLifecycleBadge(inv.lifecycleStatus)}
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Status tracking is not available.</TooltipContent>
                        </Tooltip>
                      )}
                    </td>
                    {/* Manual "Checked" toggle */}
                    <td
                      className="px-3 py-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${isReviewed(inv) ? 'text-emerald-500 hover:text-emerald-600' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleReviewed(inv.id, isReviewed(inv));
                            }}
                            disabled={reviewing === inv.id}
                          >
                            {reviewing === inv.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isReviewed(inv) ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : (
                              <Circle className="h-5 w-5" />
                            )}
                            <span className="sr-only">
                              {isReviewed(inv) ? 'Mark as needs review' : 'Mark as checked'}
                            </span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isReviewed(inv)
                            ? 'Checked — click to mark as needs review'
                            : 'Click to mark this invoice as checked'}
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    {/* View button */}
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openDetail(inv)}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View details</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View invoice details</TooltipContent>
                      </Tooltip>
                    </td>
                    {/* Delete */}
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => deleteInvoice(inv.id, e)}
                        disabled={deleting === inv.id}
                      >
                        {deleting === inv.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk operations sticky bar */}
      {hasBulkOps && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkMarkReviewed(true)}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-500" />}
                Mark Checked
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkMarkReviewed(false)}
                disabled={bulkDeleting}
              >
                <Circle className="h-4 w-4 mr-1 text-muted-foreground" />
                Mark Needs Review
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={bulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Delete Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportSelectedCSV}
              >
                <FileDown className="h-4 w-4 mr-1" />
                Export Selected CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      {renderDetailDialog()}
    </div>
  );
}

// ---- Small internal helpers ----

function DetailField({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value ?? 'N/A'}</p>
    </div>
  );
}

function EditDetailField({ label, value, onChange, mono }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 text-sm ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

function MiniStatusBadge({ status }: { status: string }) {
  if (status === 'pass')
    return (
      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-0 text-xs shrink-0">
        <CheckCircle className="h-3 w-3 mr-1" /> Pass
      </Badge>
    );
  if (status === 'warn' || status === 'warning')
    return (
      <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-0 text-xs shrink-0">
        <AlertTriangle className="h-3 w-3 mr-1" /> Warn
      </Badge>
    );
  if (status === 'fail' || status === 'reject')
    return (
      <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-0 text-xs shrink-0">
        <AlertCircle className="h-3 w-3 mr-1" /> Fail
      </Badge>
    );
  return (
    <Badge variant="secondary" className="text-xs shrink-0">
      {status}
    </Badge>
  );
}
