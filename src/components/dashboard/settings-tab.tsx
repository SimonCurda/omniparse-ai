'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreditCard, Loader2, Download, Trash2, Shield, Eye, EyeOff, Plus, X, Sparkles, Lock, Clock, GripVertical, ArrowUp, ArrowDown, Keyboard } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/app-store';
import { DEFAULT_SHORTCUTS, saveShortcuts } from '@/lib/shortcuts';

const PLAN_LABELS: Record<string, string> = { free: 'Free', pro: 'Pro', plus: 'Plus', business: 'Business', enterprise: 'Enterprise' };
const PLAN_LIMITS: Record<string, number> = { free: 15, pro: 500, plus: 2000, business: 5000, enterprise: Infinity };

// Available column keys for export templates
const EXPORT_COLUMNS: { key: string; label: string }[] = [
  { key: 'vendor', label: 'Vendor' },
  { key: 'invNumber', label: 'Invoice Number' },
  { key: 'invDate', label: 'Invoice Date' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'vatAmount', label: 'VAT Amount' },
  { key: 'total', label: 'Total' },
  { key: 'currency', label: 'Currency' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'validationStatus', label: 'Validation Status' },
  { key: 'processingTime', label: 'Processing Time' },
  { key: 'approvalStatus', label: 'Approval Status' },
  { key: 'lifecycleStatus', label: 'Lifecycle Status' },
];

type ExportTemplate = {
  id: string;
  name: string;
  columns: { key: string; label: string; width: number }[];
  format: string;
  createdAt: string;
};

type ColumnDraft = { key: string; label: string; width: number };

function getAuthHeaders(): Record<string, string> | null {
  const token = localStorage.getItem('op_token');
  if (!token) return null;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export function SettingsTab() {
  const { user, invoices, setUser, logout } = useAppStore();

  // Custom fields state
  const [customFields, setCustomFields] = useState<Array<{ name: string; instruction: string; enabled: boolean }>>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldInstruction, setNewFieldInstruction] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('op_token');
    if (!token) return;
    // Load settings
    fetch('/api/settings', { headers: { Authorization: 'Bearer ' + token } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.customFields) {
          setCustomFields(data.customFields);
        }
        if (data?.retentionDays !== undefined) {
          setRetentionDays(data.retentionDays);
        }
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));
    // Load export templates
    fetch('/api/export-templates', { headers: { Authorization: 'Bearer ' + token } })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (Array.isArray(data)) setExportTemplates(data);
      })
      .catch(() => {});
  }, []);

  const saveCustomFields = async (fields: Array<{ name: string; instruction: string; enabled: boolean }>) => {
    const token = localStorage.getItem('op_token');
    if (!token) { toast.error('Please log in again.'); return; }
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ customFields: fields }),
      });
      if (res.ok) {
        toast.success('Custom fields updated. New uploads will extract these fields.');
      } else {
        toast.error('Failed to save custom fields.');
      }
    } catch {
      toast.error('Network error.');
    }
  };

  const addCustomField = () => {
    if (!newFieldName.trim() || !newFieldInstruction.trim()) {
      toast.error('Both field name and instruction are required.');
      return;
    }
    const updated = [...customFields, { name: newFieldName.trim(), instruction: newFieldInstruction.trim(), enabled: true }];
    setCustomFields(updated);
    setNewFieldName('');
    setNewFieldInstruction('');
    saveCustomFields(updated);
  };

  const removeCustomField = (index: number) => {
    const updated = customFields.filter((_, i) => i !== index);
    setCustomFields(updated);
    saveCustomFields(updated);
  };

  const toggleCustomField = (index: number) => {
    const updated = customFields.map((f, i) => i === index ? { ...f, enabled: !f.enabled } : f);
    setCustomFields(updated);
    saveCustomFields(updated);
  };

  const plan = user?.plan ?? 'free';
  const planLabel = PLAN_LABELS[plan] ?? plan;
  const planLimit = PLAN_LIMITS[plan] ?? 25;
  const invoiceCount = invoices.length;

  // Profile state
  const [editName, setEditName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  // Security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Billing state
  const [upgrading, setUpgrading] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Delete account state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Export templates state
  const [exportTemplates, setExportTemplates] = useState<ExportTemplate[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateFormat, setTemplateFormat] = useState('csv');
  const [templateColumns, setTemplateColumns] = useState<ColumnDraft[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  // Data retention state
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [savingRetention, setSavingRetention] = useState(false);

  // Handlers

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error('Name cannot be empty.');
      return;
    }
    if (trimmed === user?.name) {
      toast.info('Name unchanged.');
      return;
    }
    setSavingName(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) {
        toast.error('Please log in again.');
        return;
      }
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to update name.');
        return;
      }
      toast.success('Name updated successfully.');
      if (user) setUser({ ...user, name: trimmed });
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) {
        toast.error('Please log in again.');
        return;
      }
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to change password.');
        return;
      }
      toast.success('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) {
        toast.error('Please log in again to upgrade.');
        return;
      }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan: 'pro' }),
      });
      if (res.status === 503) {
        toast.info(
          'Billing is ready to connect. Set your STRIPE_SECRET_KEY and STRIPE_PRO_PRICE_ID environment variables to enable paid plans.'
        );
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Something went wrong. Please try again.');
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) {
        toast.error('Please log in again.');
        return;
      }
      const res = await fetch('/api/auth/export-data', {
        method: 'GET',
        headers,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to export data.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omniparse-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully.');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // --- Export template handlers ---

  const openNewTemplateDialog = useCallback(() => {
    setTemplateName('');
    setTemplateFormat('csv');
    setTemplateColumns([]);
    setTemplateDialogOpen(true);
  }, []);

  const toggleTemplateColumn = (key: string, label: string) => {
    setTemplateColumns((prev) => {
      const exists = prev.some((c) => c.key === key);
      if (exists) {
        return prev.filter((c) => c.key !== key);
      }
      return [...prev, { key, label, width: 120 }];
    });
  };

  const moveTemplateColumn = (index: number, direction: 'up' | 'down') => {
    setTemplateColumns((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Template name is required.');
      return;
    }
    if (templateColumns.length === 0) {
      toast.error('Select at least one column.');
      return;
    }
    const token = localStorage.getItem('op_token');
    if (!token) { toast.error('Please log in again.'); return; }
    setSavingTemplate(true);
    try {
      const res = await fetch('/api/export-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name: templateName.trim(), format: templateFormat, columns: templateColumns }),
      });
      if (res.ok) {
        const created = await res.json();
        setExportTemplates((prev) => [...prev, created]);
        setTemplateDialogOpen(false);
        toast.success('Export template created.');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to create template.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const token = localStorage.getItem('op_token');
    if (!token) { toast.error('Please log in again.'); return; }
    setDeletingTemplateId(id);
    try {
      const res = await fetch(`/api/export-templates?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        setExportTemplates((prev) => prev.filter((t) => t.id !== id));
        toast.success('Template deleted.');
      } else {
        toast.error('Failed to delete template.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setDeletingTemplateId(null);
    }
  };

  // --- Data retention handler ---

  const handleSaveRetention = async (days: number | null) => {
    const token = localStorage.getItem('op_token');
    if (!token) { toast.error('Please log in again.'); return; }
    setSavingRetention(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ retentionDays: days }),
      });
      if (res.ok) {
        setRetentionDays(days);
        toast.success('Data retention setting saved.');
      } else {
        toast.error('Failed to save retention setting.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setSavingRetention(false);
    }
  };

  const openDeleteDialog = useCallback(() => {
    setDeleteEmail('');
    setDeletePassword('');
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteAccount = async () => {
    if (deleteEmail !== user?.email) {
      toast.error('Please type your email address to confirm.');
      return;
    }
    if (!deletePassword) {
      toast.error('Please enter your password.');
      return;
    }
    setDeleting(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) {
        toast.error('Please log in again.');
        return;
      }
      const res = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to delete account.');
        return;
      }
      toast.success('Account deleted successfully.');
      setDeleteDialogOpen(false);
      localStorage.clear();
      logout();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground mt-1">Account management and configuration.</p>
      </div>

      {/* Profile Card */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <div className="flex gap-2">
              <Input
                id="profile-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={savingName}
                placeholder="Your name"
                className="flex-1"
              />
              <Button onClick={handleSaveName} disabled={savingName || editName.trim() === user?.name}>
                {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-medium mt-1 text-sm">{user?.email ?? '-'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Cannot be changed for security</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Plan</Label>
              <p className="font-medium mt-1">
                <Badge variant="secondary">{planLabel}</Badge>
              </p>
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground">Member Since</Label>
            <p className="font-medium mt-1">
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : '-'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Change your password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={changingPassword}
                placeholder="Enter current password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                tabIndex={-1}
                aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
              >
                {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={changingPassword}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowNewPw(!showNewPw)}
                tabIndex={-1}
                aria-label={showNewPw ? 'Hide password' : 'Show password'}
              >
                {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={changingPassword}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                tabIndex={-1}
                aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
              >
                {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="w-full sm:w-auto"
          >
            {changingPassword ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Changing Password...
              </>
            ) : (
              'Change Password'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Billing Card */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Billing</CardTitle>
          <CardDescription>Manage your subscription and usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Current Plan</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {plan === 'free'
                  ? `Free plan. ${invoiceCount} of ${planLimit} invoices used this month.`
                  : `${planLabel} plan active. ${invoiceCount === 0 ? 'No' : invoiceCount} invoices processed.`}
              </p>
            </div>
            <Badge
              variant="secondary"
              className={
                plan === 'free'
                  ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }
            >
              {planLabel}
            </Badge>
          </div>

          {plan === 'free' && (
            <Button onClick={handleUpgrade} disabled={upgrading} className="w-full sm:w-auto">
              {upgrading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Upgrade to Pro
                </>
              )}
            </Button>
          )}

          <div className="rounded-lg bg-muted/50 p-4 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Invoices this period</span>
              <span className="font-medium">
                {invoiceCount}/{planLimit}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (invoiceCount / planLimit) * 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Field Extraction Templates Card — Quick Win #6 */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Custom Field Extraction
          </CardTitle>
          <CardDescription>
            Define extra fields the AI should extract from every invoice. For example: "Project Code", "Department", "Cost Center".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {customFields.length > 0 && (
            <div className="space-y-2">
              {customFields.map((field, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{field.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{field.instruction}</p>
                  </div>
                  <span className={"text-[10px] font-medium px-2 py-0.5 rounded-full " + (field.enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>
                    {field.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => toggleCustomField(i)}>
                    {field.enabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-red-500 hover:text-red-600" onClick={() => removeCustomField(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-medium">Add New Custom Field</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Field Name</Label>
                <Input
                  placeholder="e.g. Project Code"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomField()}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Extraction Instruction</Label>
                <Input
                  placeholder="e.g. Find the project or cost center code"
                  value={newFieldInstruction}
                  onChange={(e) => setNewFieldInstruction(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomField()}
                />
              </div>
            </div>
            <Button onClick={addCustomField} disabled={!newFieldName.trim() || !newFieldInstruction.trim()} size="sm">
              <Plus className="mr-1 h-3.5 w-3.5" /> Add Field
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Custom fields are appended to the AI prompt and extracted from all future uploads. Values appear in the invoice detail view.
          </p>
        </CardContent>
      </Card>

      {/* Custom Export Templates Card — Plus+ */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5 text-amber-500" />
            Custom Export Templates
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 ml-auto text-xs">Plus+</Badge>
          </CardTitle>
          <CardDescription>
            Create reusable export templates with custom column selection and ordering.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan !== 'business' && plan !== 'enterprise' ? (
            <div className="flex items-center gap-3 p-6 rounded-lg bg-muted/50 border border-dashed border-border/50 justify-center">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Upgrade to Plus</p>
                <p className="text-xs text-muted-foreground">Custom export templates are available on Business &amp; Enterprise plans.</p>
              </div>
            </div>
          ) : (
            <>
              {exportTemplates.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {exportTemplates.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase">{t.format}</Badge>
                          <span className="text-xs text-muted-foreground">{t.columns.length} column{t.columns.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-red-500 hover:text-red-600"
                        disabled={deletingTemplateId === t.id}
                        onClick={() => handleDeleteTemplate(t.id)}
                      >
                        {deletingTemplateId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {exportTemplates.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No export templates yet. Create one to get started.</p>
              )}
              <Button onClick={openNewTemplateDialog} size="sm" className="w-full sm:w-auto">
                <Plus className="mr-1 h-3.5 w-3.5" /> New Template
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Data Retention Control Card — Plus+ */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Data Retention Control
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 ml-auto text-xs">Plus+</Badge>
          </CardTitle>
          <CardDescription>
            Automatically delete old invoice data after a set period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan !== 'business' && plan !== 'enterprise' ? (
            <div className="flex items-center gap-3 p-6 rounded-lg bg-muted/50 border border-dashed border-border/50 justify-center">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Upgrade to Plus</p>
                <p className="text-xs text-muted-foreground">Data retention control is available on Business &amp; Enterprise plans.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: null, label: 'Keep Forever' },
                  { value: 90, label: '90 Days' },
                  { value: 365, label: '1 Year' },
                  { value: 730, label: '2 Years' },
                ] as const).map((opt) => {
                  const isActive = retentionDays === opt.value;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={savingRetention}
                      onClick={() => handleSaveRetention(opt.value)}
                      className={
                        'text-left p-3 rounded-lg border text-sm font-medium transition-colors ' +
                        (isActive
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border/50 bg-muted/30 hover:bg-muted/50 text-foreground')
                      }
                    >
                      {opt.label}
                      {isActive && (
                        <span className="block text-[10px] font-normal text-primary/70 mt-0.5">Current</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {savingRetention && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Invoices older than the retention period will be automatically purged. Export your data before changing this setting.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts Card */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Keyboard Shortcuts
          </CardTitle>
          <CardDescription>Configure keyboard shortcuts for quick navigation. Press a key to change it.</CardDescription>
        </CardHeader>
        <CardContent>
          <KeyboardShortcutsEditor />
        </CardContent>
      </Card>

      {/* Data & Privacy Card */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Data & Privacy</CardTitle>
          <CardDescription>Export or delete your personal data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Export All Data</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Download all your data (invoices, chat history, profile) as JSON. GDPR right to data portability.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleExportData}
              disabled={exporting}
              className="w-full sm:w-auto"
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export Data
                </>
              )}
            </Button>
          </div>

          <div className="border-t pt-6 space-y-2">
            <div className="flex items-start gap-3">
              <Trash2 className="h-5 w-5 mt-0.5 text-red-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-500">Delete Account</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
            </div>
            <Button variant="destructive" onClick={openDeleteDialog} className="w-full sm:w-auto">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Card */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Compliance</CardTitle>
          <CardDescription>Legal and regulatory information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            {
              label: 'GDPR Compliant',
              desc: 'EU General Data Protection Regulation (2016/679)',
              href: '/privacy-policy',
            },
            {
              label: 'EU AI Act Notice',
              desc: 'Transparency under Regulation (EU) 2024/1689',
              href: '/ai-act-notice',
            },
            {
              label: 'PIPEDA Compliant',
              desc: 'Canadian Personal Information Protection',
              href: '/privacy-policy',
            },
            {
              label: 'Czech Law',
              desc: 'Act No. 110/2019 Coll. on personal data',
              href: '/privacy-policy',
            },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="flex items-center justify-between py-1.5 group"
            >
              <div>
                <p className="text-sm font-medium group-hover:text-amber-500 transition-colors">
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-500 text-xs shrink-0"
              >
                Compliant
              </Badge>
            </a>
          ))}
          <p className="text-xs text-muted-foreground mt-2">
            View full legal documents from the footer on the landing page.
          </p>
        </CardContent>
      </Card>

      {/* New Export Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Export Template</DialogTitle>
            <DialogDescription>
              Choose a name, format, and select which columns to include.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g. Monthly Finance Report"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={templateFormat} onValueChange={setTemplateFormat}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Columns</Label>
              <p className="text-xs text-muted-foreground">
                Select columns and use the arrows to reorder them.
              </p>
              <div className="space-y-1 border rounded-lg p-2 max-h-60 overflow-y-auto">
                {EXPORT_COLUMNS.map((col) => {
                  const selectedIdx = templateColumns.findIndex((c) => c.key === col.key);
                  const isSelected = selectedIdx >= 0;
                  return (
                    <div
                      key={col.key}
                      className={
                        'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ' +
                        (isSelected ? 'bg-primary/5' : '')
                      }
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleTemplateColumn(col.key, col.label)}
                      />
                      <span className={isSelected ? 'font-medium' : 'text-muted-foreground'}>{col.label}</span>
                      <span className="ml-auto flex items-center gap-0.5">
                        {isSelected && (
                          <>
                            <button
                              type="button"
                              className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                              disabled={selectedIdx === 0}
                              onClick={() => moveTemplateColumn(selectedIdx, 'up')}
                              aria-label="Move up"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                              disabled={selectedIdx === templateColumns.length - 1}
                              onClick={() => moveTemplateColumn(selectedIdx, 'down')}
                              aria-label="Move down"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {isSelected && <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)} disabled={savingTemplate}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={savingTemplate || !templateName.trim() || templateColumns.length === 0}
            >
              {savingTemplate ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This will permanently delete your account, all invoices, chat sessions, and messages. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm-email">
                Type <span className="font-semibold">{user?.email}</span> to confirm
              </Label>
              <Input
                id="delete-confirm-email"
                type="email"
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
                disabled={deleting}
                placeholder={user?.email}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-confirm-password">Enter your password</Label>
              <Input
                id="delete-confirm-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                disabled={deleting}
                placeholder="Your password"
                autoComplete="current-password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleting || deleteEmail !== user?.email || !deletePassword}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Keyboard Shortcuts Editor ----

const SHORTCUT_LABELS: Record<string, { label: string; description: string; fixed?: boolean }> = {
  search: { label: 'Search', description: 'Focus search bar' },
  altSearch: { label: 'Alt Search', description: 'Alternate search shortcut (always /)' },
  tabUpload: { label: 'Upload Tab', description: 'Switch to Upload tab' },
  tabInvoices: { label: 'Invoices Tab', description: 'Switch to Invoices tab' },
  tabAnalytics: { label: 'Analytics Tab', description: 'Switch to Analytics tab' },
  tabChat: { label: 'Chat Tab', description: 'Switch to AI Chat tab' },
  tabSettings: { label: 'Settings Tab', description: 'Switch to Settings tab' },
};

function KeyboardShortcutsEditor() {
  const [shortcuts, setShortcuts] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('op_shortcuts');
      return saved ? { ...DEFAULT_SHORTCUTS, ...JSON.parse(saved) } : { ...DEFAULT_SHORTCUTS };
    } catch {
      return { ...DEFAULT_SHORTCUTS };
    }
  });
  const [listeningKey, setListeningKey] = useState<string | null>(null);

  const startListening = (key: string) => {
    setListeningKey(key);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!listeningKey) return;
    e.preventDefault();
    e.stopPropagation();

    const pressed = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    // Allow Escape to cancel
    if (e.key === 'Escape') {
      setListeningKey(null);
      return;
    }

    // Validate: single letter only (no modifier combos for tab shortcuts)
    if (pressed.length !== 1 || /[a-z0-9]/.test(pressed) === false) {
      toast.error('Please press a single letter or number key');
      setListeningKey(null);
      return;
    }

    // Check for conflicts with other shortcuts
    const otherKeys = Object.entries(shortcuts).filter(([k]) => k !== listeningKey);
    for (const [_, v] of otherKeys) {
      if (v.toLowerCase() === pressed) {
        toast.error(`Key "${pressed.toUpperCase()}" is already used by another shortcut`);
        setListeningKey(null);
        return;
      }
    }

    const updated = { ...shortcuts, [listeningKey]: pressed };
    setShortcuts(updated);
    saveShortcuts(updated);
    setListeningKey(null);
    toast.success(`Shortcut updated to "${pressed.toUpperCase()}"`);
  }, [listeningKey, shortcuts]);

  // Listen for key presses when in recording mode
  useEffect(() => {
    if (!listeningKey) return;
    const handler = (e: KeyboardEvent) => handleKeyDown(e);
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [listeningKey, handleKeyDown]);

  const resetToDefaults = () => {
    setShortcuts({ ...DEFAULT_SHORTCUTS });
    saveShortcuts(DEFAULT_SHORTCUTS);
    toast.success('Shortcuts reset to defaults');
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {Object.entries(SHORTCUT_LABELS).map(([key, info]) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg bg-muted/30 border border-border/50"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{info.label}</p>
              <p className="text-xs text-muted-foreground">{info.description}</p>
            </div>
            <button
              onClick={() => startListening(key)}
              disabled={info.fixed}
              className={
                'shrink-0 min-w-[56px] h-9 px-3 rounded-md border text-sm font-mono font-medium transition-colors ' +
                (listeningKey === key
                  ? 'border-amber-500 bg-amber-500/10 text-amber-500 animate-pulse'
                  : 'border-border bg-background hover:bg-muted/50 text-foreground')
              }
            >
              {listeningKey === key ? 'Press a key...' : key === 'search' ? 'Ctrl+K' : shortcuts[key]?.toUpperCase()}
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Keyboard className="h-3 w-3" />
          Press Escape to close dialogs. / and Ctrl+K always open search.
        </p>
        <Button variant="outline" size="sm" onClick={resetToDefaults}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
