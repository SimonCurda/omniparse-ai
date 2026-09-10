'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Loader2,
  Lock,
  Inbox,
  CheckCircle,
  XCircle,
  ShieldBan,
  Clock,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/app-store';

function getToken(): string | null {
  return localStorage.getItem('op_token');
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  plus: 'Plus',
  business: 'Business',
  enterprise: 'Enterprise',
};

const MAX_RULES = 20;

interface ApprovalRule {
  id: string;
  name: string;
  minAmount?: number | null;
  maxAmount?: number | null;
  action: 'auto_approve' | 'flag_for_review' | 'block';
  active: boolean;
}

interface PendingApproval {
  id: string;
  filename: string;
  vendor: string;
  total: number;
  invDate: string;
  approvalStatus: string;
  approvalNote?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  ruleName?: string | null;
}

export function ApprovalsTab() {
  const plan = useAppStore((s) => s.user?.plan) || 'free';
  const hasApprovalAccess = ['plus', 'business', 'enterprise'].includes(plan);

  if (!hasApprovalAccess) {
    return <LockedState plan={plan} />;
  }

  return <ApprovalsContent plan={plan} />;
}

function LockedState({ plan }: { plan: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
        <Lock className="h-8 w-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-bold mb-2">Approval Workflows</h2>
      <p className="text-muted-foreground max-w-md mb-4">
        Automated approval rules and manual review workflows are available on Plus and higher plans.
      </p>
      <Badge variant="secondary" className="text-sm">
        Current plan: {PLAN_LABELS[plan] || plan}
      </Badge>
    </div>
  );
}

function ApprovalsContent({ plan }: { plan: string }) {
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(true);
  const [approvalFilter, setApprovalFilter] = useState('all');

  // Add rule dialog
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState<{ name: string; minAmount: string; maxAmount: string; action: 'auto_approve' | 'flag_for_review' | 'block' }>({ name: '', minAmount: '', maxAmount: '', action: 'flag_for_review' });
  const [savingRule, setSavingRule] = useState(false);

  // Approve/Reject dialog
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    approvalId: string;
    action: 'approve' | 'reject';
  }>({ open: false, approvalId: '', action: 'approve' });
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRules = useCallback(() => {
    const token = getToken();
    if (!token) return;
    setRulesLoading(true);
    fetch('/api/approval-rules', { headers: { Authorization: 'Bearer ' + token } })
      .then((r) => (r.ok ? r.json() : { rules: [] }))
      .then((data) => setRules(Array.isArray(data) ? data : (data.rules || [])))
      .catch(() => {})
      .finally(() => setRulesLoading(false));
  }, []);

  const fetchApprovals = useCallback((status?: string) => {
    const token = getToken();
    if (!token) return;
    setApprovalsLoading(true);
    const params = status && status !== 'all' ? `?status=${status}` : '';
    fetch('/api/approvals' + params, { headers: { Authorization: 'Bearer ' + token } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setApprovals(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setApprovalsLoading(false));
  }, []);

  useEffect(() => {
    fetchRules();
    fetchApprovals();
  }, [fetchRules, fetchApprovals]);

  const handleAddRule = async () => {
    if (!newRule.name.trim()) {
      toast.error('Rule name is required');
      return;
    }
    const token = getToken();
    if (!token) return;

    if (rules.length >= MAX_RULES) {
      toast.error(`Maximum ${MAX_RULES} rules allowed`);
      return;
    }

    setSavingRule(true);
    try {
      const res = await fetch('/api/approval-rules', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRule.name,
          minAmount: newRule.minAmount ? Number(newRule.minAmount) : null,
          maxAmount: newRule.maxAmount ? Number(newRule.maxAmount) : null,
          action: newRule.action,
        }),
      });
      if (res.ok) {
        toast.success('Rule created');
        setShowAddRule(false);
        setNewRule({ name: '', minAmount: '', maxAmount: '', action: 'flag_for_review' });
        fetchRules();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create rule');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingRule(false);
    }
  };

  const toggleRule = async (rule: ApprovalRule) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/approval-rules', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, active: !rule.active }),
      });
      if (res.ok) {
        setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r)));
      }
    } catch {
      toast.error('Failed to toggle rule');
    }
  };

  const deleteRule = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/approval-rules?id=' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== id));
        toast.success('Rule deleted');
      }
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const handleApprovalAction = async () => {
    const token = getToken();
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/approvals/${actionDialog.approvalId}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionDialog.action, note: actionNote.trim() || undefined }),
      });
      if (res.ok) {
        toast.success(actionDialog.action === 'approve' ? 'Invoice approved' : 'Invoice rejected');
        setActionDialog({ open: false, approvalId: '', action: 'approve' });
        setActionNote('');
        fetchApprovals(approvalFilter);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Action failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCount = approvals.filter((a) => a.approvalStatus === 'pending_review').length;

  const filteredApprovals = approvalFilter === 'all'
    ? approvals
    : approvals.filter((a) => a.approvalStatus === approvalFilter);

  const fmtCurrency = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Section A: Approval Rules */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Approval Rules</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {rules.length}/{MAX_RULES} rules used ({PLAN_LABELS[plan] || plan})
              </span>
              <Button size="sm" onClick={() => setShowAddRule(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Rule
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rulesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8">
              <Inbox className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">No approval rules yet. Create one to automate invoice processing.</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center gap-4 rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{rule.name}</span>
                      <ActionBadge action={rule.action} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rule.minAmount != null && rule.maxAmount != null
                        ? `${fmtCurrency(rule.minAmount)} — ${fmtCurrency(rule.maxAmount)}`
                        : rule.minAmount != null
                          ? `Above ${fmtCurrency(rule.minAmount)}`
                          : rule.maxAmount != null
                            ? `Up to ${fmtCurrency(rule.maxAmount)}`
                            : 'Any amount'}
                    </p>
                  </div>
                  <Switch checked={rule.active} onCheckedChange={() => toggleRule(rule)} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section B: Pending Approvals */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              Pending Approvals
              {pendingCount > 0 && (
                <Badge className="bg-amber-500 text-white border-0">{pendingCount}</Badge>
              )}
            </CardTitle>
          </div>
          <Tabs value={approvalFilter} onValueChange={(v) => { setApprovalFilter(v); fetchApprovals(v === 'all' ? undefined : v); }}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending_review">Pending Review</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="blocked">Blocked</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {approvalsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredApprovals.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">
                {approvalFilter === 'all'
                  ? 'No approvals yet.'
                  : `No ${approvalFilter.replace('_', ' ')} invoices.`}
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-4 py-2.5 font-medium">Vendor</th>
                        <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">Total</th>
                        <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Date</th>
                        <th className="text-center px-4 py-2.5 font-medium">Status</th>
                        <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Rule</th>
                        <th className="text-right px-4 py-2.5 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApprovals.map((a) => (
                        <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 font-medium">{a.vendor}</td>
                          <td className="px-4 py-2.5 text-right font-mono hidden sm:table-cell">{fmtCurrency(a.total)}</td>
                          <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{a.invDate || '—'}</td>
                          <td className="px-4 py-2.5 text-center">
                            <ApprovalStatusBadge status={a.approvalStatus} />
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">{a.ruleName || '—'}</td>
                          <td className="px-4 py-2.5 text-right">
                            {(a.approvalStatus === 'pending_review') && (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700"
                                  onClick={() => setActionDialog({ open: true, approvalId: a.id, action: 'approve' })}
                                >
                                  <CheckCircle className="h-3 w-3" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 text-red-500 hover:text-red-600"
                                  onClick={() => setActionDialog({ open: true, approvalId: a.id, action: 'reject' })}
                                >
                                  <XCircle className="h-3 w-3" /> Reject
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Rule Dialog */}
      <Dialog open={showAddRule} onOpenChange={(open) => { if (!open) setShowAddRule(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Approval Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Name *</Label>
              <Input
                id="rule-name"
                placeholder="e.g. High value review"
                value={newRule.name}
                onChange={(e) => setNewRule((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-amount">Min Amount</Label>
                <Input
                  id="min-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={newRule.minAmount}
                  onChange={(e) => setNewRule((prev) => ({ ...prev, minAmount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-amount">Max Amount</Label>
                <Input
                  id="max-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="No limit"
                  value={newRule.maxAmount}
                  onChange={(e) => setNewRule((prev) => ({ ...prev, maxAmount: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={newRule.action}
                onValueChange={(v) => setNewRule((prev) => ({ ...prev, action: v as 'auto_approve' | 'flag_for_review' | 'block' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto_approve">Auto Approve</SelectItem>
                  <SelectItem value="flag_for_review">Flag for Review</SelectItem>
                  <SelectItem value="block">Block</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRule(false)}>Cancel</Button>
            <Button onClick={handleAddRule} disabled={savingRule}>
              {savingRule ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve/Reject Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => { if (!open) { setActionDialog({ open: false, approvalId: '', action: 'approve' }); setActionNote(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionDialog.action === 'approve' ? (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              {actionDialog.action === 'approve' ? 'Approve Invoice' : 'Reject Invoice'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="action-note">Note (optional)</Label>
            <Input
              id="action-note"
              placeholder={actionDialog.action === 'approve' ? 'Approved reason...' : 'Rejection reason...'}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApprovalAction(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog({ open: false, approvalId: '', action: 'approve' }); setActionNote(''); }}>
              Cancel
            </Button>
            <Button
              onClick={handleApprovalAction}
              disabled={actionLoading}
              variant={actionDialog.action === 'reject' ? 'destructive' : 'default'}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              {actionDialog.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  if (action === 'auto_approve') {
    return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-0 text-xs">Auto Approve</Badge>;
  }
  if (action === 'flag_for_review') {
    return <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-0 text-xs">Flag for Review</Badge>;
  }
  if (action === 'block') {
    return <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-0 text-xs">Block</Badge>;
  }
  return <Badge variant="secondary" className="text-xs">{action}</Badge>;
}

function ApprovalStatusBadge({ status }: { status: string }) {
  if (status === 'pending_review') {
    return (
      <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-0 gap-1">
        <Clock className="h-3 w-3" /> Review
      </Badge>
    );
  }
  if (status === 'auto_approved') {
    return (
      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-0 gap-1">
        <CheckCircle className="h-3 w-3" /> Auto
      </Badge>
    );
  }
  if (status === 'approved') {
    return (
      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-0 gap-1">
        <CheckCircle className="h-3 w-3" /> Approved
      </Badge>
    );
  }
  if (status === 'rejected') {
    return (
      <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-0 gap-1">
        <XCircle className="h-3 w-3" /> Rejected
      </Badge>
    );
  }
  if (status === 'blocked') {
    return (
      <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-0 gap-1">
        <ShieldBan className="h-3 w-3" /> Blocked
      </Badge>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}
