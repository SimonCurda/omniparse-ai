'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, ShieldAlert, ShieldCheck, Snowflake, Trash2, RefreshCw,
  Search, AlertTriangle, Users, FileText, MessageSquare, Mail, Loader2,
  ArrowUpDown, ArrowUp, ArrowDown, History, EyeOff, Eye, Star,
  Cpu, CheckCircle2, XCircle, Bug, Activity,
  FlaskConical, BookOpen, DatabaseBackup, Scale, Sparkles,
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
  starred: boolean;
  debugEnabled?: boolean;
  stats: AccountStats;
  abuseRisk: AbuseRisk;
}

interface ProviderInfo {
  provider: string;
  label: string;
  role: string;
  location: string;
  dbEnabled: boolean;
  apiKeySet: boolean;
  effectivelyEnabled: boolean;
  canToggle: boolean;
  envVar: string;
  notes: string;
  color: string;
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

interface FeatureFlag {
  flag: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
  dbEnabled: boolean;
  effectiveEnabled: boolean;
  inDb: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface ModelHealthRow {
  provider: string;
  modelName: string;
  status: string;
  statusCode: number | null;
  responseTimeMs: number | null;
  notes: string | null;
  checkedAt: string | null;
}

interface ModelHealthAlert {
  provider: string;
  modelName: string;
  fromStatus: string;
  toStatus: string;
  checkedAt: string;
  statusCode: number | null;
}

interface ModelHealthPayload {
  latest: ModelHealthRow[];
  deprecations: ModelHealthRow[];
  alertHistory: ModelHealthAlert[];
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
  const [tab, setTab] = useState<'accounts' | 'hidden' | 'deleted' | 'providers' | 'flags' | 'modelhealth'>('accounts');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [featureFlagsLoading, setFeatureFlagsLoading] = useState(false);
  const [modelHealth, setModelHealth] = useState<ModelHealthPayload | null>(null);
  const [modelHealthLoading, setModelHealthLoading] = useState(false);
  const [modelHealthRunning, setModelHealthRunning] = useState(false);
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

  const fetchProviders = useCallback(async () => {
    if (!secret) return;
    setProvidersLoading(true);
    try {
      const res = await fetch(`/api/admin/providers?key=${encodeURIComponent(secret)}`);
      const data = await res.json();
      if (res.ok) {
        setProviders(data.providers || []);
      }
    } catch {
      // ignore
    } finally {
      setProvidersLoading(false);
    }
  }, [secret]);

  useEffect(() => {
    if (tab === 'providers') {
      fetchProviders();
    }
  }, [tab, fetchProviders]);

  // --- Feature flags fetch ---
  // GET /api/admin/feature-flags?key=CRON_SECRET returns the full list of
  // known flags with their DB state + metadata for rendering the admin UI.
  const fetchFeatureFlags = useCallback(async () => {
    if (!secret) return;
    setFeatureFlagsLoading(true);
    try {
      const res = await fetch(`/api/admin/feature-flags?key=${encodeURIComponent(secret)}`);
      const data = await res.json();
      if (res.ok) {
        setFeatureFlags(data.flags || []);
      } else {
        toast.error(data.error || 'Failed to load feature flags');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setFeatureFlagsLoading(false);
    }
  }, [secret]);

  useEffect(() => {
    if (tab === 'flags') fetchFeatureFlags();
  }, [tab, fetchFeatureFlags]);

  const handleToggleFlag = async (flag: string, nextEnabled: boolean) => {
    // Optimistically flip the local row so the toggle feels instant; revert
    // on error.
    const prev = featureFlags;
    setFeatureFlags((cur) =>
      cur.map((f) =>
        f.flag === flag
          ? { ...f, dbEnabled: nextEnabled, effectiveEnabled: nextEnabled, updatedAt: new Date().toISOString(), updatedBy: 'admin' }
          : f,
      ),
    );
    try {
      const res = await fetch(`/api/admin/feature-flags?key=${encodeURIComponent(secret)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag, enabled: nextEnabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeatureFlags(prev);
        toast.error(data.error || 'Failed to toggle flag');
      } else {
        toast.success(`${flag} ${nextEnabled ? 'enabled' : 'disabled'}`);
      }
    } catch {
      setFeatureFlags(prev);
      toast.error('Network error');
    }
  };

  // --- Model health fetch ---
  // GET /api/admin/model-health?key=CRON_SECRET returns the latest probe row
  // per (provider, model), the list of decommissioned models, and the recent
  // alert history (status transitions within the last 30 days).
  const fetchModelHealth = useCallback(async () => {
    if (!secret) return;
    setModelHealthLoading(true);
    try {
      const res = await fetch(`/api/admin/model-health?key=${encodeURIComponent(secret)}`);
      const data = await res.json();
      if (res.ok) {
        setModelHealth({
          latest: Array.isArray(data.latest) ? data.latest : [],
          deprecations: Array.isArray(data.deprecations) ? data.deprecations : [],
          alertHistory: Array.isArray(data.alertHistory) ? data.alertHistory : [],
        });
      } else {
        toast.error(data.error || 'Failed to load model health');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setModelHealthLoading(false);
    }
  }, [secret]);

  useEffect(() => {
    if (tab === 'modelhealth') fetchModelHealth();
  }, [tab, fetchModelHealth]);

  const runHealthCheckNow = async () => {
    if (modelHealthRunning) return;
    setModelHealthRunning(true);
    try {
      const res = await fetch(`/api/admin/model-health?key=${encodeURIComponent(secret)}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Health check complete');
        // Refresh the data so the new probe rows show up.
        fetchModelHealth();
      } else {
        toast.error(data.error || 'Health check failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setModelHealthRunning(false);
    }
  };

  // --- Admin debug toggle for an account ---
  // POST /api/admin/accounts/[id]/debug?key=CRON_SECRET with
  // body { enabled: boolean }. Flips user.debugEnabled which surfaces the
  // "Debug Logs" button on the upload tab for that user.
  const handleToggleDebug = async (acc: Account) => {
    const next = !acc.debugEnabled;
    setActionLoading(acc.id + ':debug');
    try {
      const res = await fetch(`/api/admin/accounts/${acc.id}/debug?key=${encodeURIComponent(secret)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `Debug mode ${next ? 'enabled' : 'disabled'}`);
        fetchAccounts();
      } else {
        toast.error(data.error || 'Failed to toggle debug mode');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setActionLoading(null);
    }
  };

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
      // Starred accounts always at top, regardless of sort field
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;
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

  const handleStar = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/accounts/${id}/star?key=${encodeURIComponent(secret)}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) { toast.success(data.message || 'Starred'); fetchAccounts(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
    finally { setActionLoading(null); }
  };

  const handleUnstar = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/accounts/${id}/unstar?key=${encodeURIComponent(secret)}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) { toast.success(data.message || 'Unstarred'); fetchAccounts(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Network error'); }
    finally { setActionLoading(null); }
  };

  // --- Reset password for an account ---
  // POST /api/admin/accounts/[id]/reset-password?key=CRON_SECRET with
  // body { password }. Prompts for a new password and pushes it to the
  // backend. If the endpoint doesn't exist (yet), the fetch surfaces the
  // error in a toast — no silent failure.
  const handleResetPassword = async (id: string, email: string) => {
    const password = prompt(`Reset password for "${email}".\n\nEnter new password (min 8 characters):`);
    if (password === null) return; // user cancelled
    if (!password) { toast.error('Password cannot be empty'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/accounts/${id}/reset-password?key=${encodeURIComponent(secret)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(data.message || 'Password reset successfully');
      } else {
        toast.error(data.error || `Failed to reset password (HTTP ${res.status})`);
      }
    } catch {
      toast.error('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  // --- Backup trigger ---
  // The database backup is handled by a server-side cron job (see vercel.json
  // / scheduled tasks). There's no manual endpoint to hit from the browser —
  // surfacing a toast lets admins know the mechanism without implying a
  // one-click download.
  const handleBackup = () => {
    toast.info('Backup script runs via cron — no manual trigger needed.');
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

        {/* Risk summary — clickable to filter */}
        {summary && (
          <div className="grid grid-cols-4 gap-3">
            <RiskCard label="High Risk" value={summary.highRisk} color="text-red-500" bg="bg-red-500/10" icon={ShieldAlert}
              active={filter === 'high'} onClick={() => { setTab('accounts'); setFilter(filter === 'high' ? 'all' : 'high'); }} />
            <RiskCard label="Medium Risk" value={summary.mediumRisk} color="text-amber-500" bg="bg-amber-500/10" icon={AlertTriangle}
              active={filter === 'medium'} onClick={() => { setTab('accounts'); setFilter(filter === 'medium' ? 'all' : 'medium'); }} />
            <RiskCard label="Low Risk" value={summary.lowRisk} color="text-emerald-500" bg="bg-emerald-500/10" icon={ShieldCheck}
              active={filter === 'low'} onClick={() => { setTab('accounts'); setFilter(filter === 'low' ? 'all' : 'low'); }} />
            <RiskCard label="Frozen" value={summary.frozenAccounts} color="text-blue-500" bg="bg-blue-500/10" icon={Snowflake}
              active={filter === 'frozen'} onClick={() => { setTab('accounts'); setFilter(filter === 'frozen' ? 'all' : 'frozen'); }} />
          </div>
        )}

        {/* Tabs + external tool links */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-border">
          <div className="flex gap-2 overflow-x-auto pb-px">
            <button onClick={() => setTab('accounts')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === 'accounts' ? 'border-amber-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              <Users className="h-4 w-4 inline mr-1.5" /> Active ({sortedAccounts.length})
            </button>
            <button onClick={() => setTab('hidden')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === 'hidden' ? 'border-amber-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              <EyeOff className="h-4 w-4 inline mr-1.5" /> Hidden ({hiddenAccounts.length})
            </button>
            <button onClick={() => setTab('deleted')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === 'deleted' ? 'border-amber-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              <History className="h-4 w-4 inline mr-1.5" /> Deleted ({deletionLogs.length})
            </button>
            <button onClick={() => setTab('providers')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === 'providers' ? 'border-amber-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              <Cpu className="h-4 w-4 inline mr-1.5" /> AI Providers
            </button>
            <button onClick={() => setTab('flags')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === 'flags' ? 'border-amber-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              <ShieldCheck className="h-4 w-4 inline mr-1.5" /> Feature Flags
            </button>
            <button onClick={() => setTab('modelhealth')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === 'modelhealth' ? 'border-amber-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              <Activity className="h-4 w-4 inline mr-1.5" /> Model Health
            </button>
          </div>

          {/* External tools + legal docs — top-right toolbar */}
          <div className="flex flex-wrap gap-1.5 pb-1">
            <a href="/api-test"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/50 transition-colors"
              title="Open the API tester playground">
              <FlaskConical className="h-3 w-3" /> API Tester
            </a>
            <a href="/api-docs"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/50 transition-colors"
              title="Open the API documentation">
              <BookOpen className="h-3 w-3" /> API Docs
            </a>
            <button onClick={handleBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/50 transition-colors"
              title="Database backups run on a cron schedule">
              <DatabaseBackup className="h-3 w-3" /> Backup
            </button>
            <a href="/legal"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/50 transition-colors"
              title="View legal documents (privacy policy, terms, DPA)">
              <Scale className="h-3 w-3" /> Legal Docs
            </a>
          </div>
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
                            {acc.starred && (<span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded"><Star className="h-2.5 w-2.5 fill-current" />STARRED</span>)}
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
                                <button onClick={() => acc.starred ? handleUnstar(acc.id) : handleStar(acc.id)} title={acc.starred ? 'Unstar' : 'Star for easy spotting'} className={`p-1.5 rounded hover:bg-amber-500/20 ${acc.starred ? 'text-amber-500' : 'text-muted-foreground'}`}><Star className={`h-4 w-4 ${acc.starred ? 'fill-current' : ''}`} /></button>
                                {acc.active ? (
                                  <button onClick={() => handleFreeze(acc.id, acc.email)} title="Freeze" className="p-1.5 rounded hover:bg-blue-500/20 text-blue-500"><Snowflake className="h-4 w-4" /></button>
                                ) : (
                                  <button onClick={() => handleUnfreeze(acc.id, acc.email)} title="Unfreeze" className="p-1.5 rounded hover:bg-emerald-500/20 text-emerald-500"><ShieldCheck className="h-4 w-4" /></button>
                                )}
                                <button onClick={() => handleHide(acc.id, acc.email)} title="Hide from active view" className="p-1.5 rounded hover:bg-muted text-muted-foreground"><EyeOff className="h-4 w-4" /></button>
                                <button onClick={() => handleToggleDebug(acc)} title={acc.debugEnabled ? 'Disable debug mode (hides Debug Logs button on upload tab)' : 'Enable debug mode (shows Debug Logs button on upload tab)'} className={`p-1.5 rounded hover:bg-amber-500/20 ${acc.debugEnabled ? 'text-amber-500' : 'text-muted-foreground'}`}><Bug className="h-4 w-4" /></button>
                                <button onClick={() => handleResetPassword(acc.id, acc.email)} title="Reset password" className="p-1.5 rounded hover:bg-amber-500/20 text-amber-600"><Shield className="h-4 w-4" /></button>
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

        {/* === PROVIDERS TAB === */}
        {tab === 'providers' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-semibold">AI Provider Status</h3>
                <button onClick={fetchProviders} disabled={providersLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/50 disabled:opacity-50">
                  {providersLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Toggle providers on or off instantly — no redeploy needed. Changes take effect within 30 seconds
                (config cache). A provider only works if both the toggle is ON and the API key is set in Vercel env vars.
              </p>

              {/* Provider cards — dynamic from API */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {providersLoading && providers.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading provider status...
                  </div>
                )}
                {providers.map((p) => (
                  <ProviderToggleCard
                    key={p.provider}
                    provider={p.provider}
                    label={p.label}
                    role={p.role}
                    location={p.location}
                    dbEnabled={p.dbEnabled}
                    apiKeySet={p.apiKeySet}
                    effectivelyEnabled={p.effectivelyEnabled}
                    canToggle={p.canToggle}
                    envVar={p.envVar}
                    notes={p.notes}
                    color={p.color as 'emerald' | 'amber' | 'blue'}
                    onToggle={async (enabled) => {
                      try {
                        const res = await fetch(`/api/admin/providers?key=${encodeURIComponent(secret)}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ provider: p.provider, enabled }),
                        });
                        if (!res.ok) {
                          const data = await res.json();
                          toast.error(data.error || 'Failed to toggle provider');
                          return;
                        }
                        toast.success(`${p.label} ${enabled ? 'enabled' : 'disabled'}`);
                        fetchProviders();
                      } catch {
                        toast.error('Network error');
                      }
                    }}
                  />
                ))}
              </div>

              <div className="mt-6 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <p className="text-sm text-amber-700 dark:text-amber-500">
                  <strong>To enable a disabled provider:</strong> Set the environment variable to
                  <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs">true</code>
                  in the Vercel dashboard (Settings → Environment Variables), then redeploy.
                  Before enabling, complete the review steps described in the Privacy Policy §6.
                </p>
              </div>

              <div className="mt-4 p-4 rounded-lg bg-muted/30">
                <h4 className="text-sm font-semibold mb-2">Production Cascade (default configuration)</h4>
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">Mistral (EU)</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">Groq (US, SCCs)</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 font-medium line-through">OpenRouter</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 font-medium line-through">Google Gemini</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  OpenRouter and Google Gemini are skipped unless explicitly enabled. If both Mistral and Groq
                  fail, the chat returns an error (no fallback to disabled providers).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* === FEATURE FLAGS TAB === */}
        {tab === 'flags' && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Feature Flags</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Toggle feature flags instantly — no redeploy needed. Changes take effect within 30 seconds
                  (config cache). A flag only takes effect if the underlying code path exists.
                </p>
              </div>
              <button onClick={fetchFeatureFlags} disabled={featureFlagsLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/50 disabled:opacity-50 shrink-0">
                {featureFlagsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
              </button>
            </div>

            {featureFlagsLoading && featureFlags.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Loading feature flags...
              </div>
            ) : featureFlags.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No feature flags configured.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {featureFlags.map((f) => (
                  <div
                    key={f.flag}
                    className={
                      'rounded-xl border p-4 ' +
                      (f.effectiveEnabled
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-muted/5 border-border')
                    }
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm">{f.label}</h4>
                        <code className="text-[11px] text-muted-foreground">{f.flag}</code>
                      </div>
                      <button
                        onClick={() => handleToggleFlag(f.flag, !f.dbEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 cursor-pointer hover:opacity-80 ${
                          f.dbEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/20'
                        }`}
                        title={`Click to ${f.dbEnabled ? 'disable' : 'enable'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${f.dbEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {f.effectiveEnabled ? (
                          <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Enabled
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> Disabled
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          default: {f.defaultEnabled ? 'on' : 'off'}
                        </span>
                        {f.updatedAt && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            updated {new Date(f.updatedAt).toLocaleDateString()} by {f.updatedBy || '—'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === MODEL HEALTH TAB === */}
        {tab === 'modelhealth' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <h3 className="text-lg font-semibold">AI Model Health</h3>
                <div className="flex items-center gap-2">
                  <button onClick={fetchModelHealth} disabled={modelHealthLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/50 disabled:opacity-50">
                    {modelHealthLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
                  </button>
                  <button onClick={runHealthCheckNow} disabled={modelHealthRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs hover:bg-amber-600 disabled:opacity-50">
                    {modelHealthRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />} Run Check Now
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Probes each AI model endpoint with a 1-token request and records the status. Decommissioned
                models are surfaced here so they can be removed from the cascade, and new models detected in
                each provider's catalog are flagged for review. A daily cron at 06:00 UTC also runs this check
                and emails alerts on status transitions.
              </p>

              {/* Summary cards */}
              {(() => {
                const rows = modelHealth?.latest ?? [];
                const counts = {
                  ok: rows.filter((r) => r.status === 'ok').length,
                  decommissioned: rows.filter((r) => r.status === 'decommissioned').length,
                  rate_limited: rows.filter((r) => r.status === 'rate_limited').length,
                  error: rows.filter((r) => r.status === 'error').length,
                  new_model: rows.filter((r) => r.status === 'new_model').length,
                  unknown: rows.filter((r) => r.status === 'unknown' || !r.status).length,
                };
                const summaryItems = [
                  { label: 'OK', value: counts.ok, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                  { label: 'Decommissioned', value: counts.decommissioned, color: 'text-red-500', bg: 'bg-red-500/10' },
                  { label: 'Rate Limited', value: counts.rate_limited, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                  { label: 'Errors', value: counts.error, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                  { label: 'New Models', value: counts.new_model, color: 'text-violet-500', bg: 'bg-violet-500/10' },
                  { label: 'Deprecations', value: (modelHealth?.deprecations ?? []).length, color: 'text-red-500', bg: 'bg-red-500/5' },
                ];
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                    {summaryItems.map((s) => (
                      <div key={s.label} className={`rounded-lg border border-border p-3 ${s.bg}`}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
                        <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Model list */}
              {modelHealthLoading && !modelHealth ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading model health...
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Provider</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Model</th>
                        <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                        <th className="text-center px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">HTTP</th>
                        <th className="text-center px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Latency</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Checked At</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(modelHealth?.latest ?? []).length === 0 && (
                        <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No probes recorded yet. Click "Run Check Now" to start.</td></tr>
                      )}
                      {(modelHealth?.latest ?? []).map((row, i) => {
                        const color =
                          row.status === 'ok' ? 'text-emerald-500'
                          : row.status === 'decommissioned' ? 'text-red-500'
                          : row.status === 'rate_limited' ? 'text-amber-500'
                          : row.status === 'error' ? 'text-orange-500'
                          : row.status === 'new_model' ? 'text-violet-500'
                          : 'text-muted-foreground';
                        const bg =
                          row.status === 'ok' ? 'bg-emerald-500/10'
                          : row.status === 'decommissioned' ? 'bg-red-500/10'
                          : row.status === 'rate_limited' ? 'bg-amber-500/10'
                          : row.status === 'error' ? 'bg-orange-500/10'
                          : row.status === 'new_model' ? 'bg-violet-500/10'
                          : 'bg-muted';
                        return (
                          <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-2.5 font-medium capitalize">{row.provider}</td>
                            <td className="px-4 py-2.5 font-mono text-xs">{row.modelName}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded ${bg} ${color}`}>
                                {row.status || 'unknown'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center text-xs font-mono hidden md:table-cell">
                              {row.statusCode != null ? row.statusCode : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-center text-xs font-mono hidden md:table-cell">
                              {row.responseTimeMs != null ? `${row.responseTimeMs}ms` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                              {row.checkedAt ? new Date(row.checkedAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : 'never'}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell max-w-[220px] truncate" title={row.notes || ''}>
                              {row.notes || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Upcoming deprecations */}
              {modelHealth && modelHealth.deprecations.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Upcoming Deprecations ({modelHealth.deprecations.length})
                  </h4>
                  <div className="space-y-2">
                    {modelHealth.deprecations.map((d, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-sm">
                        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="font-medium capitalize">{d.provider}</span>
                          <span className="text-muted-foreground mx-1">·</span>
                          <span className="font-mono text-xs">{d.modelName}</span>
                          {d.notes && <p className="text-xs text-muted-foreground mt-0.5">{d.notes}</p>}
                        </div>
                        {d.checkedAt && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            last seen {new Date(d.checkedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New models — candidates for the cascade */}
              {modelHealth && (modelHealth.latest ?? []).some((r) => r.status === 'new_model') && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    New Models Available ({
                      (modelHealth.latest ?? []).filter((r) => r.status === 'new_model').length
                    })
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    These chat-capable models exist in the provider's catalog but aren't in our
                    cascade yet. Probe them manually before adding to MISTRAL_MODELS / GROQ_MODELS.
                  </p>
                  <div className="space-y-2">
                    {(modelHealth.latest ?? [])
                      .filter((r) => r.status === 'new_model')
                      .map((d, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-violet-500/5 border border-violet-500/20 rounded-lg text-sm">
                          <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="font-medium capitalize">{d.provider}</span>
                            <span className="text-muted-foreground mx-1">·</span>
                            <span className="font-mono text-xs">{d.modelName}</span>
                            {d.notes && <p className="text-xs text-muted-foreground mt-0.5">{d.notes}</p>}
                          </div>
                          {d.checkedAt && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              seen {new Date(d.checkedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Alert history */}
              {modelHealth && modelHealth.alertHistory.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <History className="h-4 w-4 text-amber-500" />
                    Alert History (last 30 days, max 50)
                  </h4>
                  <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Provider</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Model</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Transition</th>
                          <th className="text-center px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">HTTP</th>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modelHealth.alertHistory.map((a, i) => (
                          <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="px-3 py-2 capitalize">{a.provider}</td>
                            <td className="px-3 py-2 font-mono">{a.modelName}</td>
                            <td className="px-3 py-2">
                              <span className="font-medium text-muted-foreground">{a.fromStatus || '—'}</span>
                              <span className="mx-1 text-muted-foreground">→</span>
                              <span className={
                                a.toStatus === 'ok' ? 'text-emerald-500 font-medium'
                                : a.toStatus === 'decommissioned' ? 'text-red-500 font-medium'
                                : a.toStatus === 'error' ? 'text-orange-500 font-medium'
                                : 'text-amber-500 font-medium'
                              }>{a.toStatus}</span>
                            </td>
                            <td className="px-3 py-2 text-center font-mono hidden md:table-cell">{a.statusCode ?? '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {new Date(a.checkedAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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

function RiskCard({ label, value, color, bg, icon: Icon, active, onClick }: { label: string; value: number; color: string; bg: string; icon: any; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-all ${bg} ${active ? 'border-amber-500 ring-2 ring-amber-500/30' : 'border-border hover:border-muted-foreground/30'}`}
    >
      <div className="flex items-center gap-1.5 mb-1"><Icon className={`h-3.5 w-3.5 ${color}`} /><span className="text-xs text-muted-foreground">{label}</span></div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </button>
  );
}

function ProviderToggleCard({ label, role, location, dbEnabled, apiKeySet, effectivelyEnabled, canToggle, envVar, notes, color, onToggle }: {
  label: string;
  role: string;
  location: string;
  dbEnabled: boolean;
  apiKeySet: boolean;
  effectivelyEnabled: boolean;
  canToggle: boolean;
  envVar: string;
  notes: string;
  color: 'emerald' | 'amber' | 'blue';
  onToggle: (enabled: boolean) => void;
}) {
  const colorClasses = {
    emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-600', icon: 'text-emerald-500' },
    amber: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-600', icon: 'text-amber-500' },
    blue: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-600', icon: 'text-blue-500' },
  };
  const c = colorClasses[color];

  return (
    <div className={`rounded-xl border p-4 ${effectivelyEnabled ? c.bg : 'bg-muted/5'} ${effectivelyEnabled ? c.border : 'border-border'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="font-semibold text-sm">{label}</h4>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
        {/* Toggle switch */}
        <button
          onClick={() => canToggle && onToggle(!dbEnabled)}
          disabled={!canToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
            dbEnabled ? c.icon : 'bg-muted-foreground/20'
          } ${!canToggle ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
          title={canToggle ? `Click to ${dbEnabled ? 'disable' : 'enable'}` : 'API key not set in Vercel — cannot toggle'}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${dbEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {effectivelyEnabled ? (
            <span className={`text-xs font-medium ${c.text} flex items-center gap-1`}>
              <CheckCircle2 className="h-3 w-3" /> Active
            </span>
          ) : (
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <XCircle className="h-3 w-3" /> {dbEnabled ? 'Enabled but no API key' : 'Disabled'}
            </span>
          )}
          {!apiKeySet && (
            <span className="text-xs text-amber-500">⚠ API key not set</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Location:</span> {location}
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Env var:</span>{' '}
          <code className="px-1 py-0.5 rounded bg-muted text-[11px]">{envVar}</code>
        </p>
        <p className="text-xs text-muted-foreground mt-1">{notes}</p>
      </div>
    </div>
  );
}
