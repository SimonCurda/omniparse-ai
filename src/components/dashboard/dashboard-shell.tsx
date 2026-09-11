'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/stores/app-store';
import { loadShortcuts, DEFAULT_SHORTCUTS } from '@/lib/shortcuts';

const PLAN_LIMITS: Record<string, number> = { free: 15, pro: 500, plus: 2000, business: 10000, enterprise: Infinity };
const PLAN_LABELS: Record<string, string> = { free: 'Free', pro: 'Pro', plus: 'Plus', business: 'Business', enterprise: 'Enterprise' };

import {
  Search, LogOut, ChevronDown, User,
  Upload, FileText, BarChart3, Bot, Settings, ShieldCheck, CheckCircle2,
  Sun, Moon, Building2, Crown, Inbox,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UploadTab } from './upload-tab';
import { InvoicesTab } from './invoices-tab';
import { AnalyticsTab } from './analytics-tab';
import { ChatTab } from './chat-tab';
import { SettingsTab } from './settings-tab';
import { ValidationTab } from './validation-tab';
import { ApprovalsTab } from './approvals-tab';
import { PendingReviewTab } from './pending-review-tab';

interface TabItem {
  key: string;
  label: string;
  icon: typeof Upload;
  minPlan?: string; // minimum plan to show this tab
}

const TAB_ITEMS: TabItem[] = [
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'invoices', label: 'Invoices', icon: FileText },
  { key: 'pending', label: 'Pending', icon: Inbox },
  { key: 'validation', label: 'Validation', icon: ShieldCheck, minPlan: 'pro' },
  { key: 'approvals', label: 'Approvals', icon: CheckCircle2, minPlan: 'plus' },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'chat', label: 'AI Chat', icon: Bot },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const PLAN_ORDER = ['free', 'pro', 'plus', 'business', 'enterprise'];

export function DashboardShell() {
  const { user, logout, invoices, setInvoices, activeDashTab, setActiveDashTab } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMobileOpen, setSearchMobileOpen] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load invoices from API on mount
  useEffect(() => {
    const token = localStorage.getItem('op_token');
    if (token) {
      fetch('/api/invoices', { headers: { Authorization: 'Bearer ' + token } })
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setInvoices(data.map((inv: Record<string, unknown>) => ({
          id: inv.id, filename: inv.filename, vendor: inv.vendor,
          invNumber: inv.invNumber, invDate: inv.invDate, dueDate: inv.dueDate,
          amount: inv.amount, vatAmount: inv.vatAmount, total: inv.total,
          currency: inv.currency, status: inv.status, isDuplicate: Boolean(inv.isDuplicate),
          confidence: inv.confidence, fieldConfidence: inv.fieldConfidence,
          createdAt: inv.createdAt,
          validationResults: inv.validationResults,
          validationStatus: inv.validationStatus,
          normalizedVendor: inv.normalizedVendor,
          normalizedInvDate: inv.normalizedInvDate,
          normalizedDueDate: inv.normalizedDueDate,
          normalizedAmount: inv.normalizedAmount,
          normalizedTotal: inv.normalizedTotal,
          normalizedCurrency: inv.normalizedCurrency,
          processingTime: inv.processingTime,
          customFields: inv.customFields,
          approvalStatus: inv.approvalStatus,
          lifecycleStatus: inv.lifecycleStatus,
          entityId: inv.entityId,
          lineItems: inv.lineItems,
        }))))
        .catch(() => {});

      // Fetch pending approvals count (Plus/Business/Enterprise only)
      if (user && ['plus', 'business', 'enterprise'].includes(user.plan)) {
        fetch('/api/approvals?status=pending_review', { headers: { Authorization: 'Bearer ' + token } })
          .then((r) => r.ok ? r.json() : [])
          .then((data) => {
            const arr = Array.isArray(data) ? data : [];
            setPendingApprovalsCount(arr.length);
          })
          .catch(() => {});
      }

      // Fetch pending email review count (all plans — email capture is free-tier)
      fetch('/api/pending-review?status=pending', { headers: { Authorization: 'Bearer ' + token } })
        .then((r) => r.ok ? r.json() : [])
        .then((data) => {
          const arr = Array.isArray(data) ? data : [];
          setPendingReviewCount(arr.length);
        })
        .catch(() => {});
    }
  }, []);

  // Keyboard shortcuts (user-configurable)
  const shortcutsRef = useRef<Record<string, string>>(DEFAULT_SHORTCUTS);
  useEffect(() => {
    shortcutsRef.current = loadShortcuts();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      if (e.key === 'Escape') {
        (e.target as HTMLElement).blur();
        setSearchQuery('');
      }
      return;
    }
    if (e.key === 'Escape') {
      setSearchQuery('');
      return;
    }
    const sc = shortcutsRef.current;

    // Ctrl+K or configurable search shortcut
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInputRef.current?.focus();
      return;
    }
    // / for search
    if (e.key === '/') {
      e.preventDefault();
      searchInputRef.current?.focus();
      return;
    }

    // Tab shortcuts
    const tabMap: Record<string, string> = {
      [sc.tabUpload]: 'upload',
      [sc.tabInvoices]: 'invoices',
      [sc.tabAnalytics]: 'analytics',
      [sc.tabChat]: 'chat',
      [sc.tabSettings]: 'settings',
    };
    if (tabMap[e.key]) {
      setActiveDashTab(tabMap[e.key]);
    }
  }, [setActiveDashTab]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const plan = user?.plan || 'free';
  const planIndex = PLAN_ORDER.indexOf(plan);
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const planLabel = PLAN_LABELS[plan] || 'Free';

  // Filter tabs by plan
  const visibleTabs = TAB_ITEMS.filter((tab) => {
    if (!tab.minPlan) return true;
    return PLAN_ORDER.indexOf(tab.minPlan) <= planIndex;
  });

  // Count validation issues for badge
  const failCount = invoices.filter((i) => i.validationStatus === 'fail').length;
  const warnCount = invoices.filter((i) => i.validationStatus === 'warning').length;
  const validationBadge = failCount > 0
    ? { count: failCount, color: 'bg-red-500 text-white' }
    : warnCount > 0
    ? { count: warnCount, color: 'bg-amber-500 text-white' }
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-amber-500 flex items-center justify-center">
            <span className="text-white font-bold text-xs">OP</span>
          </div>
          <span className="font-semibold text-sm hidden sm:inline">OmniParse</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Desktop Search — always visible */}
          <div className="relative hidden md:flex">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              placeholder="Search invoices... (Ctrl+K)"
              className="pl-9 w-64 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search invoices"
            />
          </div>

          {/* Mobile Search — toggle */}
          <div className="md:hidden">
            {searchMobileOpen ? (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Search invoices..."
                    className="pl-9 w-48 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search invoices"
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setSearchMobileOpen(false); setSearchQuery(''); }} aria-label="Close search">
                  ✕
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSearchMobileOpen(true)} aria-label="Open search">
                <Search className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Plan badge + progress - desktop */}
          <div className="hidden lg:flex items-center gap-2">
            <Badge
              variant="secondary"
              className={"text-xs " + (plan === 'enterprise' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' : plan !== 'free' ? 'bg-primary/10 text-primary border border-primary/20' : '')}
            >
              {plan !== 'free' && <Crown className="h-3 w-3 mr-1" />}
              {planLabel}
            </Badge>
            <span className="text-xs text-muted-foreground">{invoices.length}/{limit === Infinity ? '∞' : limit}</span>
            <Progress value={limit === Infinity ? 0 : Math.min(100, (invoices.length / limit) * 100)} className="w-16 h-1" />
          </div>

          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <span className="hidden sm:inline text-sm max-w-24 truncate">{user?.name}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-xs text-muted-foreground truncate max-w-60">{user?.email}</div>
              <DropdownMenuSeparator />
              {/* Mobile plan info */}
              <div className="lg:hidden px-2 py-1.5">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="secondary" className="text-xs">{planLabel}</Badge>
                  <span className="text-xs text-muted-foreground">{invoices.length}/{limit === Infinity ? '∞' : limit}</span>
                </div>
                <Progress value={limit === Infinity ? 0 : Math.min(100, (invoices.length / limit) * 100)} className="h-1" />
              </div>
              <DropdownMenuSeparator className="lg:hidden" />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Entity selector (Business+ only) */}
      {(plan === 'business' || plan === 'enterprise') && (
        <div className="border-b border-border px-4 py-2 bg-background/80 flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <Select defaultValue="default">
            <SelectTrigger className="h-8 text-sm w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Entity</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Tab Navigation Bar */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-14 z-30">
        <div ref={tabsScrollRef} className="overflow-x-auto scrollbar-none">
          <div className="flex w-full px-2 sm:px-4">
            {visibleTabs.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveDashTab(item.key)}
                className={
                  "relative flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap " +
                  (activeDashTab === item.key
                    ? 'border-amber-500 text-amber-500'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30')
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {/* Badges */}
                {item.key === 'validation' && validationBadge && (
                  <span className={"ml-1 text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full " + validationBadge.color}>
                    {validationBadge.count}
                  </span>
                )}
                {item.key === 'approvals' && pendingApprovalsCount > 0 && (
                  <span className="ml-1 text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full bg-amber-500 text-white">
                    {pendingApprovalsCount}
                  </span>
                )}
                {item.key === 'pending' && pendingReviewCount > 0 && (
                  <span className="ml-1 text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full bg-amber-500 text-white">
                    {pendingReviewCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content — pass ALL invoices + searchQuery to InvoicesTab (single filter) */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        {activeDashTab === 'upload' && <UploadTab />}
        {activeDashTab === 'invoices' && <InvoicesTab invoices={invoices} searchQuery={searchQuery} />}
        {activeDashTab === 'pending' && <PendingReviewTab />}
        {activeDashTab === 'validation' && <ValidationTab />}
        {activeDashTab === 'approvals' && <ApprovalsTab />}
        {activeDashTab === 'analytics' && <AnalyticsTab invoices={invoices} />}
        {activeDashTab === 'chat' && <ChatTab />}
        {activeDashTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
}
