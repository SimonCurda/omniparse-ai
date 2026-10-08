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
  DropdownMenuLabel,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  Copy,
  Save,
  Undo2,
  FileText,
  ArrowUpDown,
  Mail,
  Tag,
  Plus,
} from 'lucide-react';
import { ConfidenceMeter } from './confidence-meter';
import { PdfViewer } from './pdf-viewer';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/app-store';
import type { InvoiceRow } from '@/stores/app-store';
import { calculateAging } from '@/lib/invoice-engine';

const LABEL_DOT_CLASSES: Record<string, string> = {
  amber: 'bg-amber-500', blue: 'bg-blue-500', emerald: 'bg-emerald-500',
  red: 'bg-red-500', purple: 'bg-purple-500', pink: 'bg-pink-500',
};

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
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; vendor: string } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [showNormalized, setShowNormalized] = useState(false);
  const [showNormalizedVisible, setShowNormalizedVisible] = useState<boolean | null>(null);

  // Labels
  const [labels, setLabels] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [showLabelPicker, setShowLabelPicker] = useState<string | null>(null);
  const [createLabelOpen, setCreateLabelOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('amber');
  const LABEL_COLOR_NAMES = ['amber', 'blue', 'emerald', 'red', 'purple', 'pink'];
  const LABEL_COLOR_HEX: Record<string, string> = {
    amber: '#f59e0b', blue: '#3b82f6', emerald: '#10b981', red: '#ef4444', purple: '#8b5cf6', pink: '#ec4899',
  };

  // Bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Audit logs for detail dialog
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // File viewer for detail dialog
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
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
  ).filter((inv) => (hideReviewed ? !isReviewed(inv) : true))
  .filter((inv) => {
    if (!labelFilter) return true;
    return (inv.labels || []).some((l) => l.label.id === labelFilter);
  });

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

  // Feature flag: show/hide "Show Normalized" toggle
  useEffect(() => {
    fetch('/api/feature-flags', { headers: { Authorization: 'Bearer ' + localStorage.getItem('op_token') } })
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then((data) => {
        if (typeof data.show_normalized_toggle === 'boolean') {
          setShowNormalizedVisible(data.show_normalized_toggle);
          if (!data.show_normalized_toggle) setShowNormalized(false);
        } else { setShowNormalizedVisible(true); }
      })
      .catch(() => setShowNormalizedVisible(true));
  }, []);

  // Fetch labels
  useEffect(() => {
    const token = localStorage.getItem('op_token');
    if (!token) return;
    fetch('/api/labels', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { labels: [] }))
      .then((data) => setLabels(Array.isArray(data) ? data : (data.labels || [])))
      .catch(() => {});
  }, []);

  // ---- Label operations ----
  const createLabel = async (name: string, color?: string) => {
    const token = localStorage.getItem('op_token');
    if (!token) return null;
    try {
      const res = await fetch('/api/labels', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: color || 'amber' }),
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) {
        setLabels((prev) => [...prev, data]);
        toast.success(`Label "${data.name}" created`);
        return data;
      }
      toast.error(data.error || 'Failed to create label');
    } catch { toast.error('Network error'); }
    return null;
  };

  const toggleLabel = async (invoiceId: string, labelId: string, assigned: boolean) => {
    const token = localStorage.getItem('op_token');
    if (!token) return;
    const url = `/api/invoices/${invoiceId}/labels${assigned ? `?labelId=${labelId}` : ''}`;
    const method = assigned ? 'DELETE' : 'POST';
    const body = assigned ? undefined : JSON.stringify({ labelId });
    try {
      const res = await fetch(url, {
        method,
        headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body } : {}),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(`Failed to ${assigned ? 'remove' : 'assign'} label: ${errData.error || res.status}`);
        return;
      }
      // Optimistic update — immediately update the invoice in local state
      // so labels appear without waiting for refreshInvoices()
      const labelDef = labels.find((l) => l.id === labelId);
      if (labelDef) {
        const { invoices: currentInvoices, setInvoices } = useAppStore.getState();
        setInvoices(currentInvoices.map((inv) => {
          if (inv.id !== invoiceId) return inv;
          if (assigned) {
            // Remove label
            return { ...inv, labels: (inv.labels || []).filter((l) => l.label.id !== labelId) };
          } else {
            // Add label
            return { ...inv, labels: [...(inv.labels || []), { label: { id: labelDef.id, name: labelDef.name, color: labelDef.color } }] };
          }
        }));
      }
      // Also refresh from server to make sure state is accurate
      useAppStore.getState().refreshInvoices();
    } catch { toast.error('Network error'); }
  };

  const deleteLabel = async (labelId: string) => {
    const token = localStorage.getItem('op_token');
    if (!token) return;
    try {
      const res = await fetch(`/api/labels?id=${encodeURIComponent(labelId)}`, {
        method: 'DELETE', headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        setLabels((prev) => prev.filter((l) => l.id !== labelId));
        if (labelFilter === labelId) setLabelFilter(null);
        useAppStore.getState().refreshInvoices();
        toast.success('Label deleted');
      }
    } catch { toast.error('Network error'); }
  };

  // Bulk label assignment — applies a single label to every selected invoice
  const bulkLabel = async (labelId: string) => {
    const token = localStorage.getItem('op_token');
    if (!token) return;
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;
    for (const invId of selectedIds) {
      try {
        const res = await fetch(`/api/invoices/${invId}/labels`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ labelId }),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setBulkDeleting(false);
    if (failCount === 0) {
      toast.success(`Label applied to ${successCount} invoice${successCount !== 1 ? 's' : ''}`);
    } else {
      toast.error(`${successCount} succeeded, ${failCount} failed`);
    }
    useAppStore.getState().refreshInvoices();
    setSelectedIds(new Set());
  };

  // Fetch audit logs + file data when detail dialog opens
  useEffect(() => {
    if (!selectedInvoice) {
      setAuditLogs([]);
      setFileDataUrl(null);
      setFileBase64(null);
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
          // For PDFs, convert to base64 for the PdfViewer (canvas-based
          // renderer that bypasses COEP/COOP iframe restrictions).
          if (blob.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onloadend = () => {
              // reader.result is "data:application/pdf;base64,...."
              // Strip the data URL prefix to get raw base64.
              const result = reader.result as string;
              const base64 = result.includes(',') ? result.split(',')[1] : result;
              setFileBase64(base64);
            };
            reader.readAsDataURL(blob);
          }
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
        // Merge reviewed flag + auto-bumped lifecycleStatus into both list and selected invoice.
        // The server may return lifecycleAutoBumped=true when it bumped the
        // status from "pending" to "approved" as part of the review action.
        const updatedInvoices = invoices.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                customFields: { ...(inv.customFields as Record<string, unknown> | null ?? {}), reviewed: data.reviewed, reviewedAt: data.reviewedAt },
                ...(data.lifecycleStatus ? { lifecycleStatus: data.lifecycleStatus } : {}),
              }
            : inv
        );
        setInvoices(updatedInvoices);
        if (selectedInvoice?.id === invoiceId) {
          setSelectedInvoice({
            ...selectedInvoice,
            customFields: { ...(selectedInvoice.customFields as Record<string, unknown> | null ?? {}), reviewed: data.reviewed, reviewedAt: data.reviewedAt },
            ...(data.lifecycleStatus ? { lifecycleStatus: data.lifecycleStatus } : {}),
          });
        }
        toast.success(data.reviewed ? 'Marked as checked' : 'Marked as needs review');
        // Refresh from server to ensure the lifecycle column reflects any
        // auto-bump (e.g. pending → approved) that the review endpoint did.
        // The optimistic update above already merged the returned data, but
        // this guarantees the UI is fully in sync with the DB.
        useAppStore.getState().refreshInvoices();
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
    // Show confirmation dialog
    const inv = invoices.find((i) => i.id === id);
    setDeleteConfirm({ id, vendor: inv?.vendor ?? 'this invoice' });
  };

  const confirmDeleteInvoice = async () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm.id;
    setDeleteConfirm(null);
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
    setBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    setBulkDeleteConfirm(false);
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

  // Labels → string helper for exports
  const labelsToStr = (inv: InvoiceRow): string =>
    (inv.labels ?? []).map((l) => l.label?.name).filter(Boolean).join('; ');

  const exportSelectedCSV = () => {
    const selected = invoices.filter((inv) => selectedIds.has(inv.id));
    if (selected.length === 0) return;
    const header = 'Vendor,Invoice #,Date,Amount,VAT,Total,Currency,Status,Confidence,Validation Status,Processing Time,Labels\n';
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = selected.map((inv) =>
      [inv.vendor, inv.invNumber, inv.invDate, inv.amount, inv.vatAmount, inv.total, inv.currency, inv.status, inv.confidence, inv.validationStatus ?? '', inv.processingTime != null ? `${inv.processingTime.toFixed(1)}s` : '', labelsToStr(inv)].map(esc).join(',')
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

  const exportSelectedJSON = () => {
    const selected = invoices.filter((inv) => selectedIds.has(inv.id));
    if (selected.length === 0) { toast.error('No checked invoices to export'); return; }
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'selected-invoices.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selected.length} invoice${selected.length !== 1 ? 's' : ''} to JSON`);
  };

  const exportSelectedExcel = async () => {
    const selected = invoices.filter((inv) => selectedIds.has(inv.id));
    if (selected.length === 0) { toast.error('No checked invoices to export'); return; }
    try {
      const XLSX = await import('xlsx');
      const wsData = [
        ['Vendor', 'Invoice #', 'Date', 'Amount', 'VAT', 'Total', 'Currency', 'Status', 'Confidence (%)', 'Validation Status', 'Processing Time', 'Labels'],
        ...selected.map((inv) => [
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
          labelsToStr(inv),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = wsData[0].map((_, colIdx) => {
        const maxLen = Math.max(...wsData.map((row) => String(row[colIdx] ?? '').length));
        return { wch: Math.min(Math.max(maxLen + 2, 8), 50) };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Selected Invoices');
      XLSX.writeFile(wb, 'selected-invoices.xlsx');
      toast.success(`Exported ${selected.length} invoice${selected.length !== 1 ? 's' : ''} to Excel`);
    } catch {
      toast.error('Failed to generate Excel file');
    }
  };

  // ─── Smart lifecycle: mark invoices as "exported" after export ──────────
  // Called by every export function (CSV/JSON/Excel/PDF, both "all" and
  // "checked only" variants) after the file download is triggered. Sends a
  // bulk PATCH to /api/bulk-actions with change_lifecycle_status so the
  // lifecycle column reflects that these invoices have been exported.
  //
  // Only bumps invoices whose current lifecycle is "pending" or "approved"
  // (the pre-export states in the pending → approved → exported workflow).
  // Invoices already at "exported" or a custom terminal status are left
  // untouched so we don't clobber a status the user set deliberately.
  //
  // Errors are non-fatal — the export already succeeded (the file was
  // downloaded), so we just log a warning instead of showing an error toast.
  const markInvoicesExported = async (rows: InvoiceRow[]) => {
    const token = getToken();
    if (!token || rows.length === 0) return;
    // Filter to invoices that are in a pre-export lifecycle state.
    const idsToBump = rows
      .filter((inv) => !inv.lifecycleStatus || inv.lifecycleStatus === '' || inv.lifecycleStatus === 'pending' || inv.lifecycleStatus === 'approved')
      .map((inv) => inv.id);
    if (idsToBump.length === 0) return;
    try {
      const res = await fetch('/api/bulk-actions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_lifecycle_status',
          invoiceIds: idsToBump,
          data: { status: 'exported' },
        }),
      });
      if (res.ok) {
        // Update local state so the UI reflects the new status immediately.
        // We read from the `invoices` closure rather than a state-updater
        // callback because setInvoices is a plain setter from the store,
        // not a React setState functional updater.
        const idSet = new Set(idsToBump);
        const updatedInvoices = invoices.map((inv) =>
          idSet.has(inv.id) ? { ...inv, lifecycleStatus: 'exported' } : inv
        );
        setInvoices(updatedInvoices);
        if (selectedInvoice && idSet.has(selectedInvoice.id)) {
          setSelectedInvoice({ ...selectedInvoice, lifecycleStatus: 'exported' });
        }
      }
    } catch {
      // Non-fatal — export already succeeded.
    }
  };

  const exportCSV = () => {
    const header = 'Vendor,Invoice #,Date,Amount,VAT,Total,Currency,Status,Confidence,Validation Status,Processing Time,Labels\n';
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = displayed.map((inv) =>
      [inv.vendor, inv.invNumber, inv.invDate, inv.amount, inv.vatAmount, inv.total, inv.currency, inv.status, inv.confidence, inv.validationStatus ?? '', inv.processingTime != null ? `${inv.processingTime.toFixed(1)}s` : '', labelsToStr(inv)].map(esc).join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoices.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
    markInvoicesExported(displayed);
  };

  // ─── Export Checked Only ─────────────────────────────────────────
  // Same as exportCSV/exportJSON/exportExcel but filters to only
  // invoices where the user has manually marked them as "checked"
  // (customFields.reviewed === true). Pre-selected as default.

  const checkedInvoices = useMemo(() => displayed.filter(isReviewed), [displayed, isReviewed]);

  const exportCheckedCSV = () => {
    if (checkedInvoices.length === 0) { toast.error('No checked invoices to export'); return; }
    const header = 'Vendor,Invoice #,Date,Amount,VAT,Total,Currency,Status,Confidence,Validation Status,Processing Time,Labels\n';
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = checkedInvoices.map((inv) =>
      [inv.vendor, inv.invNumber, inv.invDate, inv.amount, inv.vatAmount, inv.total, inv.currency, inv.status, inv.confidence, inv.validationStatus ?? '', inv.processingTime != null ? `${inv.processingTime.toFixed(1)}s` : '', labelsToStr(inv)].map(esc).join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'checked-invoices.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${checkedInvoices.length} checked invoices to CSV`);
    markInvoicesExported(checkedInvoices);
  };

  const exportCheckedJSON = () => {
    if (checkedInvoices.length === 0) { toast.error('No checked invoices to export'); return; }
    const blob = new Blob([JSON.stringify(checkedInvoices, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'checked-invoices.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${checkedInvoices.length} checked invoices to JSON`);
    markInvoicesExported(checkedInvoices);
  };

  const exportCheckedExcel = async () => {
    if (checkedInvoices.length === 0) { toast.error('No checked invoices to export'); return; }
    try {
      const XLSX = await import('xlsx');
      const wsData = [
        ['Vendor', 'Invoice #', 'Date', 'Amount', 'VAT', 'Total', 'Currency', 'Status', 'Confidence (%)', 'Validation Status', 'Processing Time', 'Labels'],
        ...checkedInvoices.map((inv) => [
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
          labelsToStr(inv),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      // Auto-size columns based on content
      ws['!cols'] = wsData[0].map((_, colIdx) => {
        const maxLen = Math.max(...wsData.map((row) => String(row[colIdx] ?? '').length));
        return { wch: Math.min(Math.max(maxLen + 2, 8), 50) };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Checked Invoices');
      XLSX.writeFile(wb, 'checked-invoices.xlsx');
      toast.success(`Exported ${checkedInvoices.length} checked invoices to Excel`);
      markInvoicesExported(checkedInvoices);
    } catch {
      toast.error('Failed to generate Excel file');
    }
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
    markInvoicesExported(displayed);
  };

  const exportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wsData = [
        ['Vendor', 'Invoice #', 'Date', 'Amount', 'VAT', 'Total', 'Currency', 'Status', 'Confidence (%)', 'Validation Status', 'Processing Time', 'Labels'],
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
          labelsToStr(inv),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      // Auto-size columns based on content
      ws['!cols'] = wsData[0].map((_, colIdx) => {
        const maxLen = Math.max(...wsData.map((row) => String(row[colIdx] ?? '').length));
        return { wch: Math.min(Math.max(maxLen + 2, 8), 50) };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
      XLSX.writeFile(wb, 'invoices.xlsx');
      toast.success('Excel exported');
      markInvoicesExported(displayed);
    } catch {
      toast.error('Failed to generate Excel file');
    }
  };

  // ─── PDF export ────────────────────────────────────────────────
  const generatePDF = async (rows: InvoiceRow[], filename: string, title: string) => {
    if (rows.length === 0) { toast.error('No invoices to export'); return; }
    try {
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const autoTable = (autoTableMod as unknown as { default: (doc: unknown, opts: unknown) => void }).default
        || (autoTableMod as unknown as (doc: unknown, opts: unknown) => void);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(16); doc.setTextColor(40); doc.text(title, 40, 40);
      doc.setFontSize(10); doc.setTextColor(120);
      doc.text(`${rows.length} invoice${rows.length !== 1 ? 's' : ''} · Generated ${new Date().toLocaleString('en-US')}`, 40, 58);
      const head = [['Vendor', 'Invoice #', 'Date', 'Amount', 'VAT', 'Total', 'Currency', 'Status', 'Confidence', 'Labels']];
      const body = rows.map((inv) => [
        (inv.vendor ?? '').slice(0, 40), inv.invNumber ?? '', inv.invDate ?? '',
        inv.amount != null ? inv.amount.toFixed(2) : '', inv.vatAmount != null ? inv.vatAmount.toFixed(2) : '',
        inv.total != null ? inv.total.toFixed(2) : '', inv.currency || 'USD',
        inv.isDuplicate ? 'Duplicate' : inv.status === 'review' ? 'Review' : 'Done',
        inv.confidence != null ? `${(inv.confidence * 100).toFixed(0)}%` : '', labelsToStr(inv),
      ]);
      autoTable(doc, {
        startY: 75, head, body, theme: 'striped',
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8, cellPadding: 4 },
        columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 8: { halign: 'right' } },
        margin: { left: 40, right: 40 },
        didDrawPage: (data: { pageNumber: number }) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8); doc.setTextColor(150);
          doc.text(`Page ${data.pageNumber} of ${pageCount} · OmniParse AI`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 20, { align: 'center' });
        },
      });
      doc.save(filename);
      toast.success(`PDF exported (${rows.length} invoice${rows.length !== 1 ? 's' : ''})`);
      markInvoicesExported(rows);
    } catch (err) { console.error('[exportPDF] error:', err); toast.error('Failed to generate PDF file'); }
  };
  const exportPDF = () => generatePDF(displayed, 'invoices.pdf', 'Invoices');
  const exportCheckedPDF = () => { if (checkedInvoices.length === 0) { toast.error('No checked invoices to export'); return; } generatePDF(checkedInvoices, 'checked-invoices.pdf', 'Checked Invoices'); };
  const exportSelectedPDF = () => {
    const selected = invoices.filter((inv) => selectedIds.has(inv.id));
    if (selected.length === 0) { toast.error('No checked invoices to export'); return; }
    generatePDF(selected, 'selected-invoices.pdf', 'Selected Invoices');
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

      // Same calendar day → show exact time (HH:MM)
      const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();

      if (sameDay) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      // Different day → show date only (no time)
      // Use locale-aware short date format: "Sep 19" or "19. 9." depending on locale
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
              {(inv.customFields as Record<string, unknown> | null)?.source === 'email' && (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-0 text-xs gap-1">
                  <Mail className="h-3 w-3" />
                  From Email
                </Badge>
              )}
              {inv.isDuplicate && (
                <Badge variant="secondary" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-0 text-xs gap-1">
                  <Copy className="h-3 w-3" />
                  Duplicate
                </Badge>
              )}
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
                {/* Currency — dropdown with common currencies */}
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Currency</p>
                  <Select value={editFields.currency || 'USD'} onValueChange={(v) => setEditFields((f) => ({ ...f, currency: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD — US Dollar ($)</SelectItem>
                      <SelectItem value="EUR">EUR — Euro (€)</SelectItem>
                      <SelectItem value="CZK">CZK — Czech Koruna (Kč)</SelectItem>
                      <SelectItem value="GBP">GBP — British Pound (£)</SelectItem>
                      <SelectItem value="PLN">PLN — Polish Złoty (zł)</SelectItem>
                      <SelectItem value="SEK">SEK — Swedish Krona</SelectItem>
                      <SelectItem value="NOK">NOK — Norwegian Krone</SelectItem>
                      <SelectItem value="DKK">DKK — Danish Krone</SelectItem>
                      <SelectItem value="HUF">HUF — Hungarian Forint (Ft)</SelectItem>
                      <SelectItem value="RON">RON — Romanian Leu</SelectItem>
                      <SelectItem value="CHF">CHF — Swiss Franc</SelectItem>
                      <SelectItem value="JPY">JPY — Japanese Yen (¥)</SelectItem>
                      <SelectItem value="CAD">CAD — Canadian Dollar</SelectItem>
                      <SelectItem value="AUD">AUD — Australian Dollar</SelectItem>
                      <SelectItem value="BRL">BRL — Brazilian Real (R$)</SelectItem>
                      <SelectItem value="CNY">CNY — Chinese Yuan</SelectItem>
                      <SelectItem value="INR">INR — Indian Rupee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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

          {/* Email Source Provenance — shown only for invoices imported via IMAP */}
          {(inv.customFields as Record<string, unknown> | null)?.source === 'email' && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Mail className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-500">
                  Imported via Email
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {(() => {
                  const cf = inv.customFields as Record<string, unknown> | null;
                  const fromAddr = cf?.emailFromAddress as string | null;
                  const fromName = cf?.emailFromName as string | null;
                  const subject = cf?.emailSubject as string | null;
                  const date = cf?.emailDate as string | null;
                  return (
                    <>
                      <div className="text-muted-foreground">
                        From:{' '}
                        <span className="text-foreground font-medium">
                          {fromName ? `${fromName} ` : ''}{fromAddr ? `<${fromAddr}>` : 'unknown'}
                        </span>
                      </div>
                      {date && (
                        <div className="text-muted-foreground">
                          Received:{' '}
                          <span className="text-foreground font-medium">
                            {(() => {
                              try {
                                return new Date(date).toLocaleString();
                              } catch {
                                return date;
                              }
                            })()}
                          </span>
                        </div>
                      )}
                      {subject && (
                        <div className="text-muted-foreground sm:col-span-2 truncate" title={subject}>
                          Subject:{' '}
                          <span className="text-foreground font-medium">{subject}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

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
                    {fileBase64 ? (
                      <PdfViewer base64={fileBase64} filename={inv.filename || 'invoice.pdf'} />
                    ) : (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                        <span className="text-sm text-muted-foreground">Preparing PDF...</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      If the PDF doesn&apos;t display, <a href={fileDataUrl || '#'} download={inv.filename || 'invoice.pdf'} className="text-primary hover:underline">download it</a> instead.
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
          {/* Show Normalized toggle — gated by feature flag */}
          {showNormalizedVisible === true && (
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
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={displayed.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              {/* Checked invoices — pre-selected as default */}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Checked Only ({checkedInvoices.length})
              </div>
              <DropdownMenuItem onClick={exportCheckedCSV} disabled={checkedInvoices.length === 0}>
                <FileJson className="mr-2 h-4 w-4" /> CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCheckedJSON} disabled={checkedInvoices.length === 0}>
                <FileJson className="mr-2 h-4 w-4" /> JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCheckedExcel} disabled={checkedInvoices.length === 0}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCheckedPDF} disabled={checkedInvoices.length === 0}>
                <FileText className="mr-2 h-4 w-4" /> PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* All invoices */}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                All Invoices ({displayed.length})
              </div>
              <DropdownMenuItem onClick={exportCSV}>
                <FileJson className="mr-2 h-4 w-4" /> CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportJSON}>
                <FileJson className="mr-2 h-4 w-4" /> JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF}>
                <FileText className="mr-2 h-4 w-4" /> PDF
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

        {/* Label filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Tag className="h-3.5 w-3.5 mr-1" />
              {labelFilter ? (labels.find((l) => l.id === labelFilter)?.name || 'Label') : 'All labels'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>Filter by label</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setLabelFilter(null)}>
              <span className="flex items-center gap-2 w-full">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                <span className="flex-1">All invoices</span>
                {!labelFilter && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
              </span>
            </DropdownMenuItem>
            {labels.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">No labels yet</div>
            )}
            {labels.map((label) => (
              <DropdownMenuItem key={label.id} onClick={() => setLabelFilter(label.id)}>
                <span className="flex items-center gap-2 w-full">
                  <span className={`h-2 w-2 rounded-full ${LABEL_DOT_CLASSES[label.color] || 'bg-gray-400'}`} />
                  <span className="flex-1 truncate">{label.name}</span>
                  {labelFilter === label.id && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                </span>
              </DropdownMenuItem>
            ))}
            {labels.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setCreateLabelOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> New label
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

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

      <div className="rounded-lg border overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
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
                <th className="text-left px-3 py-2 font-medium">Vendor</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Invoice #</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">
                  {showNormalized ? 'Norm. Vendor' : 'Date'}
                </th>
                <th className="text-right px-3 py-2 font-medium whitespace-nowrap">
                  {showNormalized ? 'Norm. Total' : 'Total'}
                </th>
                <th className="text-center px-3 py-2 font-medium whitespace-nowrap">Confidence</th>
                <th className="text-center px-3 py-2 font-medium whitespace-nowrap">Aging</th>
                <th className="text-center px-3 py-2 font-medium whitespace-nowrap">Proc. Time</th>
                <th className="text-center px-3 py-2 font-medium whitespace-nowrap">Processed</th>
                <th className="text-center px-3 py-2 font-medium whitespace-nowrap">Lifecycle</th>
                {/* Action column: single sticky column — inline buttons on md+, 3-dot dropdown on mobile */}
                <th className="px-2 py-3 sticky right-0 bg-card z-10 w-[88px]"></th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-muted-foreground">
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
                    <td className="px-3 py-2">
                      <div className="font-medium flex flex-wrap items-center gap-1">
                        <span className="truncate">{showNormalized && inv.normalizedVendor ? inv.normalizedVendor : inv.vendor}</span>
                        {(inv.customFields as Record<string, unknown> | null)?.source === 'email' && (
                          <Badge
                            variant="secondary"
                            className="bg-amber-500/10 text-amber-600 border-0 text-[10px] px-1.5 py-0 gap-0.5 shrink-0"
                            title={`From email: ${(inv.customFields as Record<string, unknown> | null)?.emailFromAddress || 'unknown sender'}`}
                          >
                            <Mail className="h-2.5 w-2.5" />
                            Email
                          </Badge>
                        )}
                        {inv.isDuplicate && (
                          <Badge
                            variant="secondary"
                            className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-0 text-[10px] px-1.5 py-0 shrink-0"
                            title="This invoice matches another invoice from the same vendor with the same total and date"
                          >
                            <Copy className="h-2.5 w-2.5" />
                            Duplicate
                          </Badge>
                        )}
                        {/* Approval badge — merged from the Approval column to save space */}
                        {renderApprovalBadge(inv.approvalStatus)}
                      </div>
                      {/* Label badges under vendor name — visible on ALL screen sizes */}
                      {(inv.labels || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(inv.labels || []).map(({ label }) => (
                            <span
                              key={label.id}
                              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: `${LABEL_COLOR_HEX[label.color] || '#9ca3af'}1a`,
                                color: LABEL_COLOR_HEX[label.color] || '#6b7280',
                                borderColor: `${LABEL_COLOR_HEX[label.color] || '#9ca3af'}40`,
                              }}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${LABEL_DOT_CLASSES[label.color] || 'bg-gray-400'}`} />
                              {label.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground md:hidden">{inv.invNumber}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {inv.invNumber}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {showNormalized && inv.normalizedInvDate ? inv.normalizedInvDate : inv.invDate}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {showNormalized && inv.normalizedTotal != null
                        ? fmtCurrency(inv.normalizedTotal, inv.normalizedCurrency || inv.currency)
                        : fmtCurrency(inv.total, inv.currency)}
                    </td>
                    {/* Confidence */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <ConfidenceMeter confidence={inv.confidence} fieldConfidence={inv.fieldConfidence} />
                    </td>
                    {/* Aging */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {renderAging(inv)}
                    </td>
                    {/* Processing Time */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {renderProcessingTime(inv)}
                    </td>
                    {/* Processed At — smart timestamp: time today, date otherwise */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      <span className="text-xs text-muted-foreground" title={new Date(inv.createdAt).toLocaleString()}>
                        {fmtRelativeTime(inv.createdAt)}
                      </span>
                    </td>
                    {/* Lifecycle Status */}
                    <td className="px-3 py-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                    {/* Actions: single sticky column — inline icon buttons on ALL screen sizes.
                        Replaces the previous 3-dot dropdown. Putting every toggle inline
                        keeps the column roughly the same width while making every action
                        one click away — no need to open a menu first. Each button has a
                        tooltip so the icon alone is enough to identify the action.
                        Order: View → Mark Checked → Labels (still a dropdown, since the
                        list of labels can be long) → Delete. */}
                    <td className="px-2 py-3 sticky right-0 bg-card z-10" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        {/* View details */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openDetail(inv)}
                              aria-label="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View details</TooltipContent>
                        </Tooltip>

                        {/* Mark as checked / needs review — icon reflects current state */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={reviewing === inv.id}
                              onClick={() => toggleReviewed(inv.id, isReviewed(inv))}
                              aria-label={isReviewed(inv) ? 'Mark as needs review' : 'Mark as checked'}
                            >
                              {reviewing === inv.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : isReviewed(inv) ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isReviewed(inv) ? 'Mark as needs review' : 'Mark as checked'}
                          </TooltipContent>
                        </Tooltip>

                        {/* Labels — still a dropdown because there can be many.
                            Trigger is a Tag icon, with the count of assigned labels
                            shown as a small superscript-style badge when > 0. */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 relative"
                              aria-label="Labels"
                            >
                              <Tag className="h-4 w-4" />
                              {(inv.labels || []).length > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                                  {(inv.labels || []).length}
                                </span>
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Labels</DropdownMenuLabel>
                            {labels.length === 0 && (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">No labels yet</div>
                            )}
                            {labels.map((label) => {
                              const assigned = (inv.labels || []).some((l) => l.label.id === label.id);
                              return (
                                <DropdownMenuItem key={label.id} onClick={() => toggleLabel(inv.id, label.id, assigned)}>
                                  <span className="flex items-center gap-2 w-full">
                                    <span className={`h-2 w-2 rounded-full ${LABEL_DOT_CLASSES[label.color] || 'bg-gray-400'}`} />
                                    <span className="flex-1 truncate">{label.name}</span>
                                    {assigned && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                                  </span>
                                </DropdownMenuItem>
                              );
                            })}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setNewLabelName(''); setNewLabelColor('amber'); setCreateLabelOpen(true); }}>
                              <Plus className="h-4 w-4 mr-2" /> New label
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Delete */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:text-destructive hover:bg-destructive/10"
                              disabled={deleting === inv.id}
                              onClick={(e) => deleteInvoice(inv.id, e)}
                              aria-label="Delete invoice"
                            >
                              {deleting === inv.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </div>
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
              {/* Export Selected — CSV / Excel / PDF / JSON dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={selectedIds.size === 0}>
                    <FileDown className="h-4 w-4 mr-1" />
                    Export Selected
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={exportSelectedCSV}>
                    <FileJson className="mr-2 h-4 w-4" /> CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportSelectedExcel}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportSelectedPDF}>
                    <FileText className="mr-2 h-4 w-4" /> PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportSelectedJSON}>
                    <FileJson className="mr-2 h-4 w-4" /> JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Label All — bulk assign a label to all selected invoices */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={selectedIds.size === 0}>
                    <Tag className="h-4 w-4 mr-1" />
                    Label All
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Apply label to {selectedIds.size} invoice{selectedIds.size !== 1 ? 's' : ''}</DropdownMenuLabel>
                  {labels.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No labels yet</div>
                  )}
                  {labels.map((label) => (
                    <DropdownMenuItem key={label.id} onClick={() => bulkLabel(label.id)}>
                      <span className="flex items-center gap-2 w-full">
                        <span className={`h-2 w-2 rounded-full ${LABEL_DOT_CLASSES[label.color] || 'bg-gray-400'}`} />
                        <span className="flex-1 truncate">{label.name}</span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setCreateLabelOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> New label
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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

      {/* Delete confirmation — single invoice */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the invoice from <strong>{deleteConfirm?.vendor}</strong>?
              This action cannot be undone. The extracted data and any associated file will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteInvoice}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation — bulk */}
      <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} invoices?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} invoice{selectedIds.size !== 1 ? 's' : ''}?
              This action cannot be undone. All selected invoices and their associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete {selectedIds.size} invoice{selectedIds.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Label Dialog */}
      <Dialog open={createLabelOpen} onOpenChange={setCreateLabelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create new label</DialogTitle>
            <DialogDescription>
              Labels help you organize and filter invoices. Choose a name and a color.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-label-name" className="text-sm font-medium">Name</Label>
              <Input
                id="new-label-name"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="e.g. Urgent, House Renovation, FY2024"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newLabelName.trim()) {
                    createLabel(newLabelName.trim(), newLabelColor).then((created) => {
                      if (created) {
                        setNewLabelName('');
                        setNewLabelColor('amber');
                        setCreateLabelOpen(false);
                      }
                    });
                  }
                }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {LABEL_COLOR_NAMES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewLabelColor(color)}
                    className={`h-7 w-7 rounded-full flex items-center justify-center transition-all ${newLabelColor === color ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground' : ''}`}
                    style={{ backgroundColor: LABEL_COLOR_HEX[color] }}
                    title={color}
                  >
                    {newLabelColor === color && <CheckCircle2 className="h-4 w-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => { setCreateLabelOpen(false); setNewLabelName(''); setNewLabelColor('amber'); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!newLabelName.trim()}
              onClick={async () => {
                const created = await createLabel(newLabelName.trim(), newLabelColor);
                if (created) {
                  setNewLabelName('');
                  setNewLabelColor('amber');
                  setCreateLabelOpen(false);
                }
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Create label
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
