'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Sliders,
  Timer,
  Loader2,
  CalendarDays,
  FileWarning,
  CheckCircle,
  XCircle,
  Lock,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore, type InvoiceRow } from '@/stores/app-store';
import { ConfidenceMeter, ConfidenceBadge } from './confidence-meter';
import {
  calculateAging,
  analyzeBatch,
  detectPatterns,
  calculateMetrics,
  DEFAULT_SETTINGS,
  type UserSettings,
  type ValidationRuleResult,
  type VarianceCheck,
  type TamperingCheck,
} from '@/lib/invoice-engine';

// ---- Helpers ----

function getAuthHeaders(): Record<string, string> | null {
  const token = localStorage.getItem('op_token');
  if (!token) return null;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const RULE_LABELS: Record<string, { label: string; description: string }> = {
  date_order: {
    label: 'Invoice Date < Due Date',
    description: 'Catches extraction errors where dates are swapped',
  },
  line_total_match: {
    label: 'Line Items Sum Check',
    description: 'Validates line items sum matches invoice amount',
  },
  future_date: {
    label: 'Future Date Detection',
    description: 'Flags invoices dated in the future',
  },
  negative_amount: {
    label: 'Negative Amount Check',
    description: 'Catches credit notes or extraction errors',
  },
  blank_vendor: {
    label: 'Vendor Name Required',
    description: 'Ensures vendor is not blank',
  },
  amount_format: {
    label: 'Amount Format Validation',
    description: 'Verifies amounts are valid numbers',
  },
  due_date_reasonable: {
    label: 'Reasonable Due Date',
    description: 'Flags payment terms over 365 days',
  },
  vat_reasonable: {
    label: 'VAT Rate Reasonableness',
    description: 'Flags VAT rates exceeding 30%',
  },
};

const THRESHOLD_LABELS: Record<string, { label: string; description: string; unit: string }> = {
  line_item: {
    label: 'Line Item Variance',
    description: '% threshold for flagging unusual line items',
    unit: '%',
  },
  total: {
    label: 'Total Variance',
    description: '$ absolute threshold for amount+VAT vs total mismatch',
    unit: '',
  },
  unit_price: {
    label: 'Unit Price Variance',
    description: '% threshold for abnormally priced items',
    unit: '%',
  },
};

type AgingBucket = 'current' | '1-15' | '16-30' | '31-60' | '61-90' | '90+';

const AGING_BUCKET_CONFIG: Record<AgingBucket, { label: string; color: string; textColor: string; bgColor: string }> = {
  current: { label: 'Current', color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10' },
  '1-15': { label: '1-15 days', color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10' },
  '16-30': { label: '16-30 days', color: 'bg-orange-500', textColor: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-500/10' },
  '31-60': { label: '31-60 days', color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/10' },
  '61-90': { label: '61-90 days', color: 'bg-red-600', textColor: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/10' },
  '90+': { label: '90+ days', color: 'bg-red-700', textColor: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-500/10' },
};

const AGING_BUCKETS: AgingBucket[] = ['current', '1-15', '16-30', '31-60', '61-90', '90+'];

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---- Component ----

export function ValidationTab() {
  const { invoices } = useAppStore();

  // Settings state
  const [validationRules, setValidationRules] = useState<Record<string, boolean>>(
    () => ({ ...DEFAULT_SETTINGS.validationRules })
  );
  const [varianceThresholds, setVarianceThresholds] = useState<
    Record<string, { type: 'percent' | 'absolute'; value: number }>
  >(() => JSON.parse(JSON.stringify(DEFAULT_SETTINGS.varianceThresholds)));
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [savingThresholds, setSavingThresholds] = useState(false);

  // Load settings from API on mount
  useEffect(() => {
    const loadSettings = async () => {
      const headers = getAuthHeaders();
      if (!headers) {
        // Fallback to defaults if not authenticated
        setSettingsLoaded(true);
        return;
      }
      try {
        const res = await fetch('/api/settings', { headers });
        if (res.ok) {
          const settings: UserSettings = await res.json();
          setValidationRules({ ...DEFAULT_SETTINGS.validationRules, ...settings.validationRules });
          setVarianceThresholds({
            ...DEFAULT_SETTINGS.varianceThresholds,
            ...settings.varianceThresholds,
          });
        }
      } catch {
        // Silently fall back to defaults
      } finally {
        setSettingsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  // Toggle a validation rule
  const handleToggleRule = useCallback(
    async (ruleKey: string, enabled: boolean) => {
      const newRules = { ...validationRules, [ruleKey]: enabled };
      setValidationRules(newRules);
      setSavingRules(true);
      try {
        const headers = getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ validationRules: newRules }),
        });
        if (res.ok) {
          toast.success(
            enabled
              ? `"${RULE_LABELS[ruleKey]?.label ?? ruleKey}" enabled`
              : `"${RULE_LABELS[ruleKey]?.label ?? ruleKey}" disabled`
          );
        } else {
          // Revert on failure
          setValidationRules(validationRules);
          toast.error('Failed to save rule setting');
        }
      } catch {
        setValidationRules(validationRules);
        toast.error('Network error. Setting not saved.');
      } finally {
        setSavingRules(false);
      }
    },
    [validationRules]
  );

  // Update a variance threshold
  const handleThresholdChange = useCallback(
    (key: string, rawValue: string) => {
      const parsed = parseFloat(rawValue);
      if (isNaN(parsed) || parsed < 0) return;
      const updated = {
        ...varianceThresholds,
        [key]: { ...varianceThresholds[key], value: parsed },
      };
      setVarianceThresholds(updated);
    },
    [varianceThresholds]
  );

  // Save threshold changes on blur
  const handleThresholdBlur = useCallback(
    async (key: string) => {
      setSavingThresholds(true);
      try {
        const headers = getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ varianceThresholds }),
        });
        if (res.ok) {
          toast.success('Threshold saved');
        } else {
          toast.error('Failed to save threshold');
        }
      } catch {
        toast.error('Network error. Threshold not saved.');
      } finally {
        setSavingThresholds(false);
      }
    },
    [varianceThresholds]
  );

  // ---- Computed Data ----

  // Validation summary stats
  const validationStats = useMemo(() => {
    let pass = 0;
    let warning = 0;
    let fail = 0;
    for (const inv of invoices) {
      const status = inv.validationStatus;
      if (status === 'pass') pass++;
      else if (status === 'warning') warning++;
      else if (status === 'fail') fail++;
    }
    return { total: invoices.length, pass, warning, fail };
  }, [invoices]);

  // Recent validation issues list (flattened from all invoices)
  const recentIssues = useMemo(() => {
    const issues: Array<{
      vendor: string;
      rule: string;
      message: string;
      severity: 'error' | 'warning';
      timestamp: string;
    }> = [];

    for (const inv of invoices) {
      const results = inv.validationResults;
      if (!results || !results.rules || results.rules.length === 0) continue;

      for (const rule of results.rules) {
        if (rule.severity === 'error' || rule.severity === 'warning') {
          issues.push({
            vendor: inv.vendor || 'Unknown Vendor',
            rule: rule.rule,
            message: rule.message,
            severity: rule.severity as 'error' | 'warning',
            timestamp: inv.createdAt,
          });
        }
      }
    }

    // Sort by timestamp descending (most recent first)
    issues.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return issues;
  }, [invoices]);

  // Aging buckets
  const agingBuckets = useMemo(() => {
    const counts: Record<AgingBucket, number> = {
      current: 0,
      '1-15': 0,
      '16-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
    };
    let overdueCount = 0;

    for (const inv of invoices) {
      try {
        const aging = calculateAging({
          invDate: inv.invDate,
          dueDate: inv.dueDate,
          createdAt: inv.createdAt,
        });
        counts[aging.agingBucket]++;
        if (aging.status === 'overdue') overdueCount++;
      } catch {
        // Skip invoices that cause errors
      }
    }

    return { counts, overdueCount };
  }, [invoices]);

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-amber-500" />
          Validation
        </h2>
        <p className="text-muted-foreground mt-1">
          Configure validation rules, review results, and monitor invoice aging.
        </p>
      </div>

      {/* Section 1: Validation Rules Manager */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-amber-500" />
                Validation Rules Manager
              </CardTitle>
              <CardDescription className="mt-1">
                Enable or disable validation rules applied to uploaded invoices
              </CardDescription>
            </div>
            {savingRules && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!settingsLoaded ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-5 w-9 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(RULE_LABELS).map(([key, meta]) => (
                <div
                  key={key}
                  className="flex items-start sm:items-center justify-between gap-4 py-1"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{meta.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {meta.description}
                    </p>
                  </div>
                  <div className="shrink-0 pt-0.5 sm:pt-0">
                    <Switch
                      checked={validationRules[key] ?? true}
                      onCheckedChange={(checked) => handleToggleRule(key, checked)}
                      disabled={savingRules}
                      aria-label={`Toggle ${meta.label}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Variance Thresholds */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sliders className="h-5 w-5 text-amber-500" />
                Variance Thresholds
              </CardTitle>
              <CardDescription className="mt-1">
                Configure sensitivity for flagging unusual invoice values
              </CardDescription>
            </div>
            {savingThresholds && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!settingsLoaded ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-end justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-9 w-24 rounded-md" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Object.entries(THRESHOLD_LABELS).map(([key, meta]) => {
                const threshold = varianceThresholds[key];
                if (!threshold) return null;
                return (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`threshold-${key}`} className="text-sm font-medium">
                      {meta.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                    <div className="relative">
                      <Input
                        id={`threshold-${key}`}
                        type="number"
                        min={0}
                        step={meta.unit === '%' ? 1 : 10}
                        value={threshold.value}
                        onChange={(e) => handleThresholdChange(key, e.target.value)}
                        onBlur={() => handleThresholdBlur(key)}
                        disabled={savingThresholds}
                        className="pr-10"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleThresholdBlur(key);
                          }
                        }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        {meta.unit || '$'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Validation Results Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Summary Stats Cards */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-500" />
                Summary
              </CardTitle>
              <CardDescription>Validation results across all invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Total */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                      <FileWarning className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Total Invoices</p>
                      <p className="text-xs text-muted-foreground">All uploaded</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-foreground">
                    {validationStats.total}
                  </span>
                </div>

                {/* Pass */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        Passed
                      </p>
                      <p className="text-xs text-muted-foreground">All checks OK</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {validationStats.pass}
                  </span>
                </div>

                {/* Warning */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        Warnings
                      </p>
                      <p className="text-xs text-muted-foreground">Needs review</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {validationStats.warning}
                  </span>
                </div>

                {/* Fail */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        Failed
                      </p>
                      <p className="text-xs text-muted-foreground">Critical issues</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-red-600 dark:text-red-400">
                    {validationStats.fail}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Validation Issues */}
        <div className="lg:col-span-2">
          <Card className="border-border/50 h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Recent Issues
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {recentIssues.length === 0
                      ? 'No validation issues found'
                      : `${recentIssues.length} issue${recentIssues.length !== 1 ? 's' : ''} across all invoices`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {recentIssues.some((i) => i.severity === 'error') && (
                    <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                      <XCircle className="h-3 w-3 mr-1" />
                      {recentIssues.filter((i) => i.severity === 'error').length} Errors
                    </Badge>
                  )}
                  {recentIssues.some((i) => i.severity === 'warning') && (
                    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {recentIssues.filter((i) => i.severity === 'warning').length} Warnings
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recentIssues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium text-foreground">All Clear</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No validation issues detected in your invoices
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-96 overflow-y-auto">
                  <div className="space-y-2 pr-4">
                    {recentIssues.slice(0, 50).map((issue, idx) => (
                      <div
                        key={`${issue.vendor}-${issue.rule}-${idx}`}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50 hover:bg-muted transition-colors"
                      >
                        <div
                          className={
                            issue.severity === 'error'
                              ? 'mt-0.5 shrink-0'
                              : 'mt-0.5 shrink-0'
                          }
                        >
                          {issue.severity === 'error' ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground truncate">
                              {issue.vendor}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                issue.severity === 'error'
                                  ? 'border-red-500/30 text-red-600 dark:text-red-400 text-[10px] px-1.5'
                                  : 'border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] px-1.5'
                              }
                            >
                              {RULE_LABELS[issue.rule]?.label ?? issue.rule}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {issue.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                            {formatTimestamp(issue.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 4: Invoice Aging Overview */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-amber-500" />
                Invoice Aging Overview
              </CardTitle>
              <CardDescription className="mt-1">
                Distribution of invoices by aging bucket
              </CardDescription>
            </div>
            {agingBuckets.overdueCount > 0 && (
              <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                <Timer className="h-3 w-3 mr-1" />
                {agingBuckets.overdueCount} Overdue
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No Invoices Yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload invoices to see aging analysis
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {AGING_BUCKETS.map((bucket) => {
                const config = AGING_BUCKET_CONFIG[bucket];
                const count = agingBuckets.counts[bucket];
                const maxCount = Math.max(...Object.values(agingBuckets.counts), 1);
                const pct = invoices.length > 0 ? Math.round((count / invoices.length) * 100) : 0;

                return (
                  <div
                    key={bucket}
                    className="rounded-lg border border-border/50 bg-background p-4 text-center space-y-2 hover:border-border transition-colors"
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {config.label}
                    </p>
                    <p className={`text-2xl font-bold ${config.textColor}`}>
                      {count}
                    </p>
                    {/* Visual bar */}
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${config.color}`}
                        style={{
                          width: `${Math.max(count > 0 ? 8 : 0, (count / maxCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {pct}% of total
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Overdue highlight bar */}
          {agingBuckets.overdueCount > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {agingBuckets.overdueCount} invoice{agingBuckets.overdueCount !== 1 ? 's' : ''} overdue
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {invoices.length > 0
                    ? `${Math.round((agingBuckets.overdueCount / invoices.length) * 100)}% of total invoices`
                    : ''}
                </span>
              </div>
            </div>
          )}

          {/* ============ Custom Validation Rules Builder ============ */}
          <CustomRulesBuilder />
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Custom Validation Rules Builder ============
const CUSTOM_FIELDS = ['vendor', 'total', 'amount', 'vatAmount', 'invDate', 'dueDate', 'currency', 'invNumber'];
const CUSTOM_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'contains', label: 'contains' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'not_empty', label: 'is not empty' },
  { value: 'is_empty', label: 'is empty' },
];
const CUSTOM_ACTIONS = [
  { value: 'flag_as_warning', label: 'Flag as Warning', color: 'bg-amber-500/10 text-amber-600' },
  { value: 'flag_as_error', label: 'Flag as Error', color: 'bg-red-500/10 text-red-600' },
  { value: 'block', label: 'Block Approval', color: 'bg-red-500/10 text-red-600' },
];

interface CustomRule {
  id: string;
  name: string;
  conditionJson: { type: string; conditions: Array<{ field: string; operator: string; value?: string | number }> };
  action: string;
  active: boolean;
}

function CustomRulesBuilder() {
  const plan = useAppStore((s) => s.user?.plan);
  const [rules, setRules] = useState<CustomRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formConditions, setFormConditions] = useState<Array<{ field: string; operator: string; value: string }>>([{ field: 'vendor', operator: 'equals', value: '' }]);
  const [formAction, setFormAction] = useState('flag_as_warning');
  const [formLogic, setFormLogic] = useState<'and' | 'or'>('and');

  const loadRules = useCallback(async () => {
 const token = localStorage.getItem('op_token');
    if (!token) return;
    try {
      const res = await fetch('/api/custom-rules', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) setRules((await res.json()).rules || []);
    } catch {}
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const maxRules = plan === 'enterprise' ? Infinity : plan === 'business' ? 50 : 20;
  const isLocked = !['plus', 'business', 'enterprise'].includes(plan || '');

  const handleSave = async () => {
    if (!formName.trim()) { toast.error('Rule name is required'); return; }
    const token = localStorage.getItem('op_token');
    if (!token) return;
    setLoading(true);
    try {
      const conditionJson = {
        type: formLogic,
        conditions: formConditions.map(c => ({
          field: c.field,
          operator: c.operator,
          ...(c.operator !== 'not_empty' && c.operator !== 'is_empty' ? { value: ['greater_than', 'less_than'].includes(c.operator) ? Number(c.value) : c.value } : {}),
        })),
      };
      const res = await fetch('/api/custom-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name: formName, conditionJson, action: formAction }),
      });
      if (res.ok) {
        toast.success('Rule created');
        setFormName('');
        setFormConditions([{ field: 'vendor', operator: 'equals', value: '' }]);
        setFormAction('flag_as_warning');
        setShowForm(false);
        loadRules();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to create rule');
      }
    } catch { toast.error('Network error'); }
    setLoading(false);
  };

  const handleToggle = async (rule: CustomRule) => {
    const token = localStorage.getItem('op_token');
    if (!token) return;
    try {
      await fetch('/api/custom-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ id: rule.id, active: !rule.active }),
      });
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r));
    } catch {}
  };

  const handleDelete = async (id: string) => {
    const token = localStorage.getItem('op_token');
    if (!token) return;
    try {
      await fetch('/api/custom-rules?id=' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
      setRules(prev => prev.filter(r => r.id !== id));
      toast.success('Rule deleted');
    } catch {}
  };

  return (
    <div className="mt-6 pt-6 border-t">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">Custom Validation Rules</h3>
          {isLocked && <Badge variant="secondary" className="text-xs"><Lock className="h-3 w-3 mr-1" /> Plus</Badge>}
          {!isLocked && <Badge variant="secondary" className="text-xs">{rules.length}/{maxRules === Infinity ? '∞' : maxRules}</Badge>}
        </div>
        {!isLocked && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)} disabled={rules.length >= maxRules}>
            {showForm ? 'Cancel' : '+ Add Rule'}
          </Button>
        )}
      </div>

      {isLocked && (
        <p className="text-sm text-muted-foreground text-center py-4">Upgrade to Plus to create custom IF/THEN validation rules with no coding needed.</p>
      )}

      {showForm && !isLocked && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Rule Name</Label>
                <Input placeholder="e.g. High-value Acme" value={formName} onChange={(e) => setFormName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Action</Label>
                <div className="flex gap-2 mt-1">
                  {CUSTOM_ACTIONS.map(a => (
                    <button key={a.value} type="button" onClick={() => setFormAction(a.value)}
                      className={"px-3 py-1.5 rounded-md text-xs font-medium border transition-colors " + (formAction === a.value ? a.color + ' border-current' : 'border-border text-muted-foreground hover:text-foreground')}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Conditions</Label>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <button type="button" onClick={() => setFormLogic('and')} className={formLogic === 'and' ? 'text-amber-500 font-semibold' : ''}>AND</button>
                  <span>/</span>
                  <button type="button" onClick={() => setFormLogic('or')} className={formLogic === 'or' ? 'text-amber-500 font-semibold' : ''}>OR</button>
                </div>
              </div>
              {formConditions.map((c, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <select value={c.field} onChange={(e) => {
                    const nc = [...formConditions]; nc[i] = { ...nc[i], field: e.target.value }; setFormConditions(nc);
                  }} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                    {CUSTOM_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select value={c.operator} onChange={(e) => {
                    const nc = [...formConditions]; nc[i] = { ...nc[i], operator: e.target.value }; setFormConditions(nc);
                  }} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                    {CUSTOM_OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {!['not_empty', 'is_empty'].includes(c.operator) && (
                    <Input placeholder={['greater_than', 'less_than'].includes(c.operator) ? 'Number' : 'Value'} value={c.value} onChange={(e) => {
                      const nc = [...formConditions]; nc[i] = { ...nc[i], value: e.target.value }; setFormConditions(nc);
                    }} className="h-9 flex-1" />
                  )}
                  {formConditions.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setFormConditions(prev => prev.filter((_, j) => j !== i))}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setFormConditions(prev => [...prev, { field: 'vendor', operator: 'equals', value: '' }])}>
                + Add condition
              </Button>
            </div>

            <Button onClick={handleSave} disabled={loading || !formName.trim()} size="sm">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Save Rule
            </Button>
          </CardContent>
        </Card>
      )}

      {rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((rule) => {
            const actionInfo = CUSTOM_ACTIONS.find(a => a.value === rule.action);
            return (
              <div key={rule.id} className={"flex items-center justify-between p-3 rounded-lg border " + (rule.active ? 'border-border' : 'border-border opacity-60')}>
                <div className="flex items-center gap-3 min-w-0">
                  <Switch checked={rule.active} onCheckedChange={() => handleToggle(rule)} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{rule.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {rule.conditionJson.conditions.map(c => `${c.field} ${c.operator} ${c.value ?? ''}`).join(` ${rule.conditionJson.type.toUpperCase()} `)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {actionInfo && <Badge variant="secondary" className={"text-xs " + actionInfo.color}>{actionInfo.label}</Badge>}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(rule.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLocked && rules.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-4">No custom rules yet. Create one to flag specific invoice patterns automatically.</p>
      )}
    </div>
  );
}
