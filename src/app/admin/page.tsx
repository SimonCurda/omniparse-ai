'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, ShieldAlert, ShieldCheck, Snowflake, Trash2, RefreshCw,
  Search, AlertTriangle, Users, FileText, MessageSquare, Mail, Loader2,
  ArrowUpDown, ArrowUp, ArrowDown, History, EyeOff, Eye,
} from 'lucide-react';
import { toast } from 'sonner';

interface AccountStats {
  invoices: number;
  chatSessions: number;
  emailInboxes: number;
  pendingReviews: number;
  auditLogs: number;
}

interface AbuseRisk {
  score: number;
  level: 'high' | 'medium' | 'low';
  factors: string[];
}

interface Account {
  id: string;
  email: string;
  name: string;
  plan: string;
  createdAt: string;
  ageDays: number;
  active: boolean;
  hidden: boolean;
  stats: AccountStats;
  abuseRisk: AbuseRisk;
}

interface DeletionLog {
  id: string;
  deletedUserId: string;
  email: string;
  name: string;
  plan: string;
  stats: { invoices: number; chatSessions: number; emailInboxes: number; pendingReviews: number };
  reason: string | null;
  deletedBy: string;
  deletedAt: string;
}

interface Summary {
  totalAccounts: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  totalInvoices: number;
  totalChatSessions: number;
  totalEmailInboxes: number;
  frozenAccounts: number;
}

type SortField = 'risk' | 'invoices' | 'chat' | 'inboxes' | 'age' | 'email' | 'plan';
type SortDir = 'asc' | 'desc';

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ArrowUpDown className="h-3 w-3 inline opacity-30" />;
  return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 inline" /> : <ArrowDown className="h-3 w-3 inline" />;
}

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [deletionLogs, setDeletionLogs] = useState<DeletionLog[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'frozen'>('all');
  const [tab, setTab] = useState<'accounts' | 'hidden' | 'deleted'>('accounts');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('risk');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const key = urlParams.get('key');
    if (key) {
      setSecret(key);
      try { localStorage.setItem('op_admin_key', key); } catch {}
    } else {
      try {
        const saved = localStorage.getItem('op_admin_key');
        if (saved) setSecret(saved);
      } catch {}
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    if (!secret) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/accounts?key=${encodeURIComponent(secret)}`);
      const data = await res.json();
      if (res.ok) {
        setAccounts(data.accounts || []);
        setDeletionLogs(data.deletionLogs || []);
        setSummary(data.summary || null);
        setAuthed(true);
        try { localStorage.setItem('op_admin_key', secret); } catch {}
      } else {
        toast.error(data.error || 'Failed to load accounts');
        if (res.status === 401) setAuthed(false);
      }
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }, [secret]);

  useEffect(() => {
    if (secret && !authed) fetchAccounts();
  }, [secret, authed, fetchAccounts]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'email' ? 'asc' : 'desc');
    }
  };

  const sortedAccounts = useMemo(() => {
    const filtered = accounts.filter((acc) => {
      if (acc.hidden) return false;
      if (filter === 'high' && acc.abuseRisk.level !== 'high') return false;
      if (filter === 'medium' && acc.abuseRisk.level !== 'medium') return false;
      if (filter === 'low' && acc.abuseRisk.level !== 'low') return false;
      if (filter === 'frozen' && acc.active) return false;
      if (search) {
        const q = search.toLowerCase();
        return acc.email.toLowerCase().includes(q) || acc.name.toLowerCase().includes(q) || acc.id.includes(q);
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'risk': cmp = a.abuseRisk.score - b.abuseRisk.score; break;
        case 'invoices': cmp = a.stats.invoices - b.stats.invoices; break;
        case 'chat': cmp = a.stats.chatSessions - b.stats.chatSessions; break;
        case 'inboxes': cmp = a.stats.emailInboxes - b.stats.emailInboxes; break;
        case 'age': cmp = a.ageDays - b.ageDays; break;
        case 'email': cmp = a.email.localeCompare(b.email); break;
        case 'plan': {
          const planRank: Record<string, number> = { free: 0, pro: 1, plus: 2, business: 3, enterprise: 4 };
          cmp = (planRank[a.plan] ?? 0) - (planRank[b.plan] ?? 0);
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [accounts, filter, search, sortField, sortDir]);

  const hiddenAccounts = useMemo(() => accounts.filter((a) => a.hidden), [accounts]);

  const handleFreeze = async (id: string, email: string) => {
    const reason = prompt(`Freeze account "${email}".\n\nReason:`, 'Account frozen by administrator due to suspected abuse.');
    if (!reason) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/accounts/${id}/freeze?key=${encodeURIComponent(secret)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message || 'Account frozen'); fetchAccounts(); }
      else toast.error(data.error || 'Failed to freeze');
    } catch { toast.error('Network error'); }
    finally { setActionLoading(null); }
  };

  const handleUnfreeze = async (id: string, email: string) => {
    if (!confirm(`Unfreeze account "${email}"?`)) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/accounts/${id}/unfreeze?key=${encodeURIComponent(secret)}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) { toast.success(data.message || 'Account unfrozen'); fetchAccounts(); }
      else toast.error(data.error || 'Failed to unfreeze');
    } catch { toast.error('Network error'); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async (id: string, email: string) => {
    const reason = prompt(`DELETE account "${email}".\n\nThis is IRREVERSIBLE.\n\nReason (for audit log):`, 'Suspected abuse — account deleted by administrator');
    if (!reason) return;
    const confirmText = prompt(`Type DELETE to confirm:`);
    if (confirmText !== 'DELETE') { if (confirmText !== null) toast.error('Must type DELETE'); return; }
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/accounts/${id}?key=${encodeURIComponent(secret)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message || 'Account deleted'); fetchAccounts(); }
      else toast.error(data.error || 'Failed to delete');
    } catch { toast.error('Network error'); }
    finally { setActionLoading(null); }
  };

  const handlePlanChange = async (id: string, email: string, currentPlan: string) => {
    const plans = ['free', 'pro', 'plus', 'business', 'enterprise'];
    const planStr = prompt(`Change plan for "${email}".\n\nCurrent plan: ${currentPlan}\n\nEnter new plan (${plans.join(', ')}):`, currentPlan);
    if (!planStr || planStr.toLowerCase() === currentPlan) return;
    if (!plans.includes(planStr.toLowerCase())) {
      toast.error(`Invalid plan. Must be one of: ${plans.join(', ')}`);
      return;
    }
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/accounts/${id}/plan?key=${encodeURIComponent(secret)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planStr.toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message || 'Plan changed'); fetchAccounts(); }
      else toast.error(data.error || 'Failed to change plan');
    } catch { toast.error('Network error'); }
    finally { setActionLoading(null); }
  };

  const handleHide = async (id: string, email: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/accounts/${id}/hide?key=${encodeURIComponent(secret)}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) { toast.success(data.message || 'Account hidden'); fetchAccounts(); }
      else toast.error(data.error || 'Failed to hide');
    } catch { toast.error('Network error'); }
    finally { setActionLoading(null); }
  };

  const handleUnhide = async (id: string, email: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/accounts/${id}/unhide?key=${encodeURIComponent(secret)}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) { toast.success(data.message || 'Account restored'); fetchAccounts(); }
      else toast.error(data.error || 'Failed to unhide');
    } catch { toast.error('Network error'); }
    finally { setActionLoading(null); }
  };

  // Login screen
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center"><Shield className="h-5 w-5 text-white" /></div>
            <h1 className="text-xl font-bold">OmniParse Admin</h1>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Enter your CRON_SECRET to access the admin dashboard.</p>
            <input type="password" placeholder="CRON_SECRET" value={secret}
              onChange={(e) => setSecret(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchAccounts()}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" />
            <button onClick={fetchAccounts} disabled={!secret || loading}
              className="w-full px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
              {loading ? 'Loading...' : 'Access Dashboard'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center"><Shield className="h-4 w-4 text-white" /></div>
            <span className="font-semibold text-sm">OmniParse Admin</span>
          </div>
          <button onClick={fetchAccounts} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/50 disabled:opacity-50">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Users} label="Total Accounts" value={summary.totalAccounts} />
            <StatCard icon={FileText} label="Total Invoices" value={summary.totalInvoices} />
            <StatCard icon={MessageSquare} label="Chat Sessions" value={summary.totalChatSessions} />
            <StatCard icon={Mail} label="Email Inboxes" value={summary.totalEmailInboxes} />
          </div>
        )}

        {/* Risk summary */}
        {summary && (
          <div className="grid grid-cols-4 gap-3">
            <RiskCard label="High Risk" value={summary.highRisk} color="text-red-500" bg="bg-red-500/10" icon={ShieldAlert} />
            <RiskCard label="Medium Risk" value={summary.mediumRisk} color="text-amber-500" bg="bg-amber-500/10" icon={AlertTriangle} />
            <RiskCard label="Low Risk" value={summary.lowRisk} color="text-emerald-500" bg="bg-emerald-500/10" icon={ShieldCheck} />
            <RiskCard label="Frozen" value={summary.frozenAccounts} color="text-blue-500" bg="bg-blue-500/10" icon={Snowflake} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          <button onClick={() => setTab('accounts')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'accounts' ? 'border-amber-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Users className="h-4 w-4 inline mr-1.5" /> Active ({sortedAccounts.length})
          </button>
          <button onClick={() => setTab('hidden')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'hidden' ? 'border-amber-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <EyeOff className="h-4 w-4 inline mr-1.5" /> Hidden ({hiddenAccounts.length})
          </button>
          <button onClick={() => setTab('deleted')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'deleted' ? 'border-amber-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <History className="h-4 w-4 inline mr-1.5" /> Deleted ({deletionLogs.length})
          </button>
        </div>

        {/* === ACCOUNTS TAB === */}
        {tab === 'accounts' && (
          <>
            {/* Search + filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search by email, name, or ID..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm" />
              </div>
              <div className="flex gap-1.5">
                {(['all', 'high', 'medium', 'low', 'frozen'] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${filter === f ? 'bg-amber-500 text-white' : 'bg-card border border-border text-muted-foreground hover:bg-muted/50'}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Accounts table */}
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort('email')}>
                        Account <SortIcon field="email" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort('plan')}>
                        Plan <SortIcon field="plan" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort('risk')}>
                        Risk <SortIcon field="risk" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort('invoices')}>
                        Invoices <SortIcon field="invoices" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground hidden md:table-cell" onClick={() => handleSort('chat')}>
                        Chat <SortIcon field="chat" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground hidden lg:table-cell" onClick={() => handleSort('inboxes')}>
                        Inboxes <SortIcon field="inboxes" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground hidden lg:table-cell" onClick={() => handleSort('age')}>
                        Age <SortIcon field="age" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (<tr><td colSpan={8} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>)}
                    {!loading && sortedAccounts.length === 0 && (<tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No accounts found</td></tr>)}
                    {!loading && sortedAccounts.map((acc) => (
                      <tr key={acc.id} className={`border-b border-border hover:bg-muted/30 ${!acc.active ? 'bg-blue-500/5' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium truncate flex items-center gap-1.5">
                            {acc.email}
                            {!acc.active && (<span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded"><Snowflake className="h-2.5 w-2.5" />FROZEN</span>)}
                          </div>
                          <div className="text-xs text-muted-foreground">{acc.name} · ...{acc.id.slice(-8)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handlePlanChange(acc.id, acc.email, acc.plan)}
                            title="Click to change plan"
                            className="text-xs font-medium capitalize bg-muted px-2 py-0.5 rounded hover:bg-amber-500/20 hover:text-amber-600 cursor-pointer transition-colors"
                          >
                            {acc.plan} ✎
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-lg ${acc.abuseRisk.level === 'high' ? 'text-red-500' : acc.abuseRisk.level === 'medium' ? 'text-amber-500' : 'text-emerald-500'}`}>{acc.abuseRisk.score}</span>
                            {acc.abuseRisk.factors.length > 0 && (
                              <div className="group relative">
                                <AlertTriangle className={`h-3.5 w-3.5 cursor-help ${acc.abuseRisk.level === 'high' ? 'text-red-500' : acc.abuseRisk.level === 'medium' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                                <div className="hidden group-hover:block absolute z-50 left-0 top-5 w-64 p-2 rounded-lg border border-border bg-popover shadow-lg text-xs">
                                  <p className="font-semibold mb-1">Risk factors:</p>
                                  <ul className="space-y-0.5 text-muted-foreground">{acc.abuseRisk.factors.map((f, i) => <li key={i}>• {f}</li>)}</ul>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs">{acc.stats.invoices}</td>
                        <td className="px-4 py-3 text-center font-mono text-xs hidden md:table-cell">{acc.stats.chatSessions}</td>
                        <td className="px-4 py-3 text-center font-mono text-xs hidden lg:table-cell">{acc.stats.emailInboxes}</td>
                        <td className="px-4 py-3 text-center font-mono text-xs hidden lg:table-cell">{acc.ageDays}d</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {actionLoading === acc.id ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (
                              <>
                                {acc.active ? (
                                  <button onClick={() => handleFreeze(acc.id, acc.email)} title="Freeze" className="p-1.5 rounded hover:bg-blue-500/20 text-blue-500"><Snowflake className="h-4 w-4" /></button>
                                ) : (
                                  <button onClick={() => handleUnfreeze(acc.id, acc.email)} title="Unfreeze" className="p-1.5 rounded hover:bg-emerald-500/20 text-emerald-500"><ShieldCheck className="h-4 w-4" /></button>
                                )}
                                <button onClick={() => handleHide(acc.id, acc.email)} title="Hide from active view" className="p-1.5 rounded hover:bg-muted text-muted-foreground"><EyeOff className="h-4 w-4" /></button>
                                <button onClick={() => handleDelete(acc.id, acc.email)} title="Delete" className="p-1.5 rounded hover:bg-red-500/20 text-red-500"><Trash2 className="h-4 w-4" /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* === HIDDEN ACCOUNTS TAB === */}
        {tab === 'hidden' && (
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Account</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Plan</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Invoices</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Chat</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hiddenAccounts.length === 0 && (<tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No hidden accounts</td></tr>)}
                  {hiddenAccounts.map((acc) => (
                    <tr key={acc.id} className="border-b border-border hover:bg-muted/30 opacity-60">
                      <td className="px-4 py-3">
                        <div className="font-medium truncate flex items-center gap-1.5">
                          {acc.email}
                          {!acc.active && (<span className="text-[10px] font-bold text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded">FROZEN</span>)}
                        </div>
                        <div className="text-xs text-muted-foreground">{acc.name} · ...{acc.id.slice(-8)}</div>
                      </td>
                      <td className="px-4 py-3 text-center"><span className="text-xs font-medium capitalize bg-muted px-2 py-0.5 rounded">{acc.plan}</span></td>
                      <td className="px-4 py-3 text-center font-mono text-xs hidden md:table-cell">{acc.stats.invoices}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs hidden md:table-cell">{acc.stats.chatSessions}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">HIDDEN</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {actionLoading === acc.id ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (
                            <>
                              <button onClick={() => handleUnhide(acc.id, acc.email)} title="Restore to active view" className="p-1.5 rounded hover:bg-emerald-500/20 text-emerald-500"><Eye className="h-4 w-4" /></button>
                              <button onClick={() => handleDelete(acc.id, acc.email)} title="Delete" className="p-1.5 rounded hover:bg-red-500/20 text-red-500"><Trash2 className="h-4 w-4" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === DELETED ACCOUNTS TAB === */}
        {tab === 'deleted' && (
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Deleted Account</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Plan</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Invoices</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Chat</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Inboxes</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reason</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Deleted At</th>
                  </tr>
                </thead>
                <tbody>
                  {deletionLogs.length === 0 && (<tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No deleted accounts yet</td></tr>)}
                  {deletionLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium truncate">{log.email}</div>
                        <div className="text-xs text-muted-foreground">{log.name} · ...{log.deletedUserId.slice(-8)}</div>
                      </td>
                      <td className="px-4 py-3 text-center"><span className="text-xs font-medium capitalize bg-muted px-2 py-0.5 rounded">{log.plan}</span></td>
                      <td className="px-4 py-3 text-center font-mono text-xs hidden md:table-cell">{log.stats.invoices}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs hidden md:table-cell">{log.stats.chatSessions}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs hidden lg:table-cell">{log.stats.emailInboxes}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate" title={log.reason || ''}>{log.reason || '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(log.deletedAt).toLocaleDateString()} {new Date(log.deletedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          OmniParse Admin Dashboard · {tab === 'accounts' ? `Sorted by ${sortField} (${sortDir})` : 'Deleted accounts audit trail'}
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-1"><Icon className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">{label}</span></div>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}

function RiskCard({ label, value, color, bg, icon: Icon }: { label: string; value: number; color: string; bg: string; icon: any }) {
  return (
    <div className={`rounded-xl border border-border p-3 ${bg}`}>
      <div className="flex items-center gap-1.5 mb-1"><Icon className={`h-3.5 w-3.5 ${color}`} /><span className="text-xs text-muted-foreground">{label}</span></div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
