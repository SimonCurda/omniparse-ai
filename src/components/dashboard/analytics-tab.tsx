'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  FileText, DollarSign, TrendingUp, TrendingDown, Receipt, BarChart3 as BarChart3Icon,
  AlertTriangle, CheckCircle, Clock, Zap, Users, ShieldAlert, ShieldCheck, Lock,
  Building2, Loader2,
} from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import type { InvoiceRow } from '@/stores/app-store';
import {
  calculateMetrics,
  analyzeBatch,
  detectPatterns,
  type PatternAnomaly,
  type BatchAnalysisResult,
  type ProcessingMetrics,
} from '@/lib/invoice-engine';

const PIE_COLORS = ['#f59e0b', '#10b981', '#6366f1', '#ef4444', '#71717a', '#06b6d4', '#f97316', '#8b5cf6'];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
};

// ─── Currency-aware formatting ────────────────────────────────────────────
// Renders a number using the correct narrow symbol for the given ISO 4217 code.
// e.g. fmtCurrency(1234.56, 'CZK') → "Kč 1,234.56"
//      fmtCurrency(1234.56, 'EUR') → "€1,234.56"
//      fmtCurrency(1234.56, 'USD') → "$1,234.56"
// Falls back to "<code> <number>" if Intl doesn't recognise the code.
function fmtCurrency(value: number, currency?: string | null): string {
  const code = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

// Returns the narrow symbol for a currency code, e.g. 'CZK' → 'Kč'.
// Used for chart axis labels where we don't have a number to format yet.
function currencySymbol(currency?: string | null): string {
  const code = (currency || 'USD').toUpperCase();
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    const symbol = parts.find((p) => p.type === 'currency')?.value;
    return symbol || code;
  } catch {
    return code;
  }
}

export function AnalyticsTab({ invoices }: { invoices: InvoiceRow[] }) {
  // --- Top Stats ---
  const totalParsed = invoices.length;
  const avgConfidence =
    invoices.length > 0
      ? invoices.reduce((s, inv) => s + (inv.confidence ?? 0), 0) / invoices.length
      : 0;
  const reviewNeeded = invoices.filter(
    (inv) =>
      inv.validationStatus === 'warning' ||
      inv.validationStatus === 'fail' ||
      inv.status === 'review',
  ).length;

  // --- Per-currency breakdown ---
  // Group invoices by currency so totals are never summed across currencies.
  const byCurrency = useMemo(() => {
    const map: Record<string, { count: number; total: number; avg: number; vendors: Set<string> }> = {};
    for (const inv of invoices) {
      const cur = (inv.currency || 'USD').toUpperCase();
      if (!map[cur]) map[cur] = { count: 0, total: 0, avg: 0, vendors: new Set() };
      map[cur].count++;
      map[cur].total += inv.total ?? 0;
      if (inv.vendor) map[cur].vendors.add(inv.vendor);
    }
    // Compute averages + sort by count desc so dominant currency shows first
    return Object.entries(map)
      .map(([cur, data]) => ({
        currency: cur,
        count: data.count,
        total: data.total,
        avg: data.count > 0 ? data.total / data.count : 0,
        vendorCount: data.vendors.size,
      }))
      .sort((a, b) => b.count - a.count);
  }, [invoices]);

  const currencies = byCurrency.map((c) => c.currency);
  const isMixedCurrency = currencies.length > 1;
  const dominantCurrency = currencies[0] || 'USD';

  // Lookup map: invoice ID → currency code. Used to show the right currency
  // symbol next to each duplicate / outlier (which reference invoice IDs).
  const currencyById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const inv of invoices) m[inv.id] = (inv.currency || 'USD').toUpperCase();
    return m;
  }, [invoices]);

  // Total amount string — per currency, joined with ' + ' when mixed
  const totalAmountStr = byCurrency.length > 0
    ? byCurrency.map((c) => fmtCurrency(c.total, c.currency)).join(' + ')
    : fmtCurrency(0);

  // --- Processing Metrics (invoice-engine) ---
  const metrics: ProcessingMetrics = useMemo(() => calculateMetrics(invoices), [invoices]);

  // --- Chart Data ---
  // Monthly chart — when multiple currencies are present we show one series per
  // currency so amounts are never summed across currencies.
  const monthlyData = useMemo(() => {
    const monthMap: Record<string, { count: number; totals: Record<string, number> }> = {};
    for (const inv of invoices) {
      const month = (inv.invDate || inv.createdAt || '').slice(0, 7);
      if (!month) continue;
      if (!monthMap[month]) monthMap[month] = { count: 0, totals: {} };
      monthMap[month].count++;
      const cur = (inv.currency || 'USD').toUpperCase();
      monthMap[month].totals[cur] = (monthMap[month].totals[cur] || 0) + (inv.total ?? 0);
    }
    return Object.entries(monthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => {
        const row: Record<string, number | string> = {
          month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
          parsed: data.count,
        };
        for (const cur of currencies) {
          row[cur] = Math.round((data.totals[cur] || 0) * 100) / 100;
        }
        return row;
      });
  }, [invoices, currencies]);

  const vendorData = useMemo(() => {
    const vendorMap: Record<string, number> = {};
    for (const inv of invoices) {
      const v = inv.vendor || 'Unknown';
      vendorMap[v] = (vendorMap[v] || 0) + 1;
    }
    return Object.entries(vendorMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [invoices]);

  const confidenceData = useMemo(() => {
    return invoices
      .slice(0, 15)
      .map((inv) => ({
        vendor: (inv.vendor ?? 'Unknown').slice(0, 15),
        confidence: (inv.confidence ?? 0) * 100,
      }));
  }, [invoices]);

  // --- Batch Analysis (invoice-engine) ---
  const batchAnalysis: BatchAnalysisResult | null = useMemo(() => {
    if (invoices.length < 2) return null;
    return analyzeBatch(invoices);
  }, [invoices]);

  // --- Pattern Anomalies (invoice-engine) ---
  const anomalies: PatternAnomaly[] = useMemo(() => {
    if (invoices.length < 3) return [];
    return detectPatterns(invoices);
  }, [invoices]);

  // --- Validation chart data (must be called unconditionally) ---
  const validationChartData = useMemo(() => {
    const map: Record<string, {pass: number; warn: number; fail: number}> = {};
    for (const inv of invoices) {
      const m = (inv.invDate || inv.createdAt || '').slice(0, 7);
      if (!m) continue;
      if (!map[m]) map[m] = {pass: 0, warn: 0, fail: 0};
      if (inv.validationStatus === 'pass') map[m].pass++;
      else if (inv.validationStatus === 'warning') map[m].warn++;
      else if (inv.validationStatus === 'fail') map[m].fail++;
    }
    return Object.entries(map).sort((a,b) => a[0].localeCompare(b[0])).map(([month, d]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', {month:'short'}),
      pass: d.pass, warning: d.warn, fail: d.fail,
    }));
  }, [invoices]);

  // --- Plan gate for Business+ features ---
  const plan = useAppStore((s) => s.user?.plan);
  const isBusiness = ['business', 'enterprise'].includes(plan || '');

  // --- Price Change Alerts (Business+) ---
  const [priceAlerts, setPriceAlerts] = useState<{
    vendor: string;
    type: string;
    description: string;
    oldVal: number;
    newVal: number;
    changePercent: number;
    invDate: string;
    prevDate: string;
  }[]>([]);
  const [priceAlertsMeta, setPriceAlertsMeta] = useState({ totalVendors: 0, analyzedMonths: 0 });
  const [priceAlertsLoading, setPriceAlertsLoading] = useState(false);

  useEffect(() => {
    if (!isBusiness) return;
    setPriceAlertsLoading(true);
    fetch('/api/price-alerts', { headers: { Authorization: 'Bearer ' + localStorage.getItem('op_token') } })
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then((data) => {
        setPriceAlerts(data.alerts ?? []);
        setPriceAlertsMeta({
          totalVendors: data.totalVendors ?? 0,
          analyzedMonths: data.analyzedMonths ?? 0,
        });
      })
      .catch(() => {})
      .finally(() => setPriceAlertsLoading(false));
  }, [isBusiness]);

  // --- Vendor Performance Scorecard (Business+) ---
  const [vendorScorecards, setVendorScorecards] = useState<{
    vendor: string;
    invoiceCount: number;
    totalAmount: number;
    avgAmount: number;
    avgConfidence: number;
    avgProcessingTime: number;
    duplicateCount: number;
    failCount: number;
    warningCount: number;
    passCount: number;
    priceTrend: number;
    invoicingRegularity: number;
    reliabilityScore: number;
    firstInvoiceDate: string;
    lastInvoiceDate: string;
  }[]>([]);
  const [vendorScorecardMeta, setVendorScorecardMeta] = useState({ totalVendors: 0 });
  const [vendorScorecardLoading, setVendorScorecardLoading] = useState(false);

  useEffect(() => {
    if (!isBusiness) return;
    setVendorScorecardLoading(true);
    fetch('/api/vendor-scorecard', { headers: { Authorization: 'Bearer ' + localStorage.getItem('op_token') } })
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then((data) => {
        setVendorScorecards(data.scorecards ?? []);
        setVendorScorecardMeta({ totalVendors: data.totalVendors ?? 0 });
      })
      .catch(() => {})
      .finally(() => setVendorScorecardLoading(false));
  }, [isBusiness]);

  // --- Stats row data ---
  const stats = [
    { label: 'Documents Parsed', value: totalParsed, icon: FileText, color: 'text-amber-500' },
    { label: 'Total Amount', value: totalAmountStr, icon: DollarSign, color: 'text-emerald-500' },
    { label: 'Avg. Confidence', value: (avgConfidence * 100).toFixed(1) + '%', icon: TrendingUp, color: 'text-amber-500' },
    { label: 'Needs Review', value: reviewNeeded, icon: Receipt, color: 'text-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
        <p className="text-muted-foreground mt-1">Overview of your document processing activity.</p>
      </div>

      {invoices.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-12 text-center">
            <BarChart3Icon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="font-medium text-muted-foreground">No data yet</p>
            <p className="text-sm text-muted-foreground mt-1">Upload and parse invoices to see analytics here.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ============ Top Stats Row ============ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => (
              <Card key={s.label} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{s.label}</span>
                    <s.icon className={"h-4 w-4 " + s.color} />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ============ Currencies Breakdown — new ============ */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Currencies
                <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 text-xs ml-auto">
                  {currencies.length} {currencies.length === 1 ? 'currency' : 'currencies'}
                </Badge>
              </CardTitle>
              <CardDescription>
                {isMixedCurrency
                  ? 'Your invoices span multiple currencies — totals are kept separate per currency.'
                  : 'All your invoices are in the same currency.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {byCurrency.map((c, i) => (
                  <div
                    key={c.currency}
                    className="rounded-lg border bg-muted/30 p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">
                        {currencySymbol(c.currency)}
                      </span>
                      <Badge
                        variant="secondary"
                        className="border-0 text-[10px] px-1.5 py-0"
                        style={{ backgroundColor: `${PIE_COLORS[i % PIE_COLORS.length]}20`, color: PIE_COLORS[i % PIE_COLORS.length] }}
                      >
                        {c.currency}
                      </Badge>
                    </div>
                    <div className="text-lg font-bold text-foreground">
                      {fmtCurrency(c.total, c.currency)}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div className="flex justify-between">
                        <span>Invoices</span>
                        <span className="font-medium text-foreground">{c.count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg / invoice</span>
                        <span className="font-medium text-foreground">{fmtCurrency(c.avg, c.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Vendors</span>
                        <span className="font-medium text-foreground">{c.vendorCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ============ Cost Metrics Section ============ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Processing Metrics
                </CardTitle>
                <CardDescription>AI accuracy, speed, and cost per document</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Average AI Accuracy</span>
                    <span className="text-sm font-semibold text-foreground">
                      {(metrics.avgAccuracy * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all"
                      style={{ width: `${metrics.avgAccuracy * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Average Processing Time</span>
                    <span className="text-sm font-semibold text-foreground">
                      {metrics.avgProcessingTime.toFixed(1)}s
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Cost Per Invoice</span>
                    <span className="text-sm font-semibold text-emerald-500">
                      {fmtCurrency(metrics.costPerInvoice, 'USD')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Processed</span>
                    <span className="text-sm font-semibold text-foreground">
                      {metrics.totalProcessed}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  Financial Summary
                </CardTitle>
                <CardDescription>Invoice amounts and totals</CardDescription>
              </CardHeader>
                <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total by Currency</span>
                    <span className="text-sm font-semibold text-foreground">
                      {byCurrency.length === 0
                        ? fmtCurrency(0)
                        : byCurrency.map((c) => fmtCurrency(c.total, c.currency)).join(' + ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Average Invoice Amount</span>
                    <span className="text-sm font-semibold text-foreground">
                      {byCurrency.length === 0
                        ? fmtCurrency(0)
                        : byCurrency.map((c) => fmtCurrency(c.avg, c.currency)).join(' + ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Invoice Count</span>
                    <span className="text-sm font-semibold text-foreground">
                      {invoices.length}
                    </span>
                  </div>
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-xs font-medium text-muted-foreground">Largest Invoice</span>
                    </div>
                    <span className="text-lg font-bold text-foreground">
                      {(() => {
                        if (invoices.length === 0) return fmtCurrency(0);
                        const largest = invoices.reduce((max, inv) =>
                          (inv.total ?? 0) > (max.total ?? 0) ? inv : max,
                          invoices[0]);
                        return fmtCurrency(largest.total ?? 0, largest.currency);
                      })()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ============ Charts Grid (2x2) ============ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {monthlyData.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Monthly Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area
                        type="monotone"
                        dataKey="parsed"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {monthlyData.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Processing Amount{isMixedCurrency ? ' (by currency)' : ''}</CardTitle>
                  {isMixedCurrency && (
                    <p className="text-xs text-muted-foreground">
                      Amounts are shown per currency — never summed across currencies.
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(v) => {
                          if (isMixedCurrency) return (Number(v) / 1000).toFixed(0) + 'k';
                          return currencySymbol(dominantCurrency) + (Number(v) / 1000).toFixed(0) + 'k';
                        }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v, name) => [
                          fmtCurrency(Number(v), String(name)),
                          String(name),
                        ]}
                      />
                      {currencies.map((cur, i) => (
                        <Bar
                          key={cur}
                          dataKey={cur}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                          radius={[4, 4, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {vendorData.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Vendor Distribution</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={vendorData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) =>
                          name + ' ' + (percent * 100).toFixed(0) + '%'
                        }
                        labelLine={false}
                      >
                        {vendorData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {confidenceData.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">AI Confidence Scores</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={confidenceData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis
                        type="category"
                        dataKey="vendor"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        width={100}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v) => [Number(v).toFixed(1) + '%', 'Confidence']}
                      />
                      <Bar dataKey="confidence" radius={[0, 4, 4, 0]}>
                        {confidenceData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={
                              entry.confidence >= 90
                                ? '#10b981'
                                : entry.confidence >= 75
                                  ? '#f59e0b'
                                  : '#ef4444'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ============ Batch Analysis Section ============ */}
          {batchAnalysis && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-500" />
                  Batch Analysis
                </CardTitle>
                <CardDescription>
                  Duplicate detection, outlier analysis, and batch summary for {batchAnalysis.summary.count} invoices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Batch Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Invoices</p>
                    <p className="text-lg font-bold text-foreground">{batchAnalysis.summary.count}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Avg. Amount</p>
                    <p className="text-lg font-bold text-foreground">{fmtCurrency(batchAnalysis.summary.avgAmount, dominantCurrency)}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Total Amount</p>
                    <p className="text-lg font-bold text-foreground">{fmtCurrency(batchAnalysis.summary.totalAmount, dominantCurrency)}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Vendors</p>
                    <p className="text-lg font-bold text-foreground">{batchAnalysis.summary.vendors.length}</p>
                  </div>
                </div>

                {/* Vendor List */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Vendors in Batch</p>
                  <div className="flex flex-wrap gap-2">
                    {batchAnalysis.summary.vendors.map((vendor) => (
                      <Badge key={vendor} variant="secondary" className="text-xs">
                        {vendor}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Duplicates */}
                {batchAnalysis.duplicates.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <p className="text-sm font-medium text-foreground">
                        Duplicates Detected ({batchAnalysis.duplicates.length})
                      </p>
                    </div>
                    <div className="space-y-2">
                      {batchAnalysis.duplicates.map((dup, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-lg"
                        >
                          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{dup.vendor}</p>
                            <p className="text-xs text-muted-foreground">
                              {fmtCurrency(dup.amount, dup.ids?.[0] ? currencyById[dup.ids[0]] : dominantCurrency)} &middot; {dup.reason}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Outliers */}
                {batchAnalysis.outliers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-4 w-4 text-amber-500" />
                      <p className="text-sm font-medium text-foreground">
                        Outliers Detected ({batchAnalysis.outliers.length})
                      </p>
                    </div>
                    <div className="space-y-2">
                      {batchAnalysis.outliers.map((out, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg"
                        >
                          <TrendingUp className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{out.vendor}</p>
                            <p className="text-xs text-muted-foreground">
                              {fmtCurrency(out.amount, out.id ? currencyById[out.id] : dominantCurrency)} &middot; {out.reason}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No issues */}
                {batchAnalysis.duplicates.length === 0 && batchAnalysis.outliers.length === 0 && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    <p className="text-sm text-muted-foreground">
                      No duplicates or outliers detected in this batch.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ============ Vendor Risk Scoring Section ============ */}
          {invoices.length >= 2 && (
            <VendorRiskSection invoices={invoices} />
          )}

          {/* ============ Validation Pass Rate Chart ============ */}
          {invoices.length >= 2 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Validation Pass Rate</CardTitle>
                <CardDescription>How many invoices pass validation each month</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={validationChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="pass" stackId="a" fill="#10b981" name="Pass" radius={[0,0,0,0]} />
                    <Bar dataKey="warning" stackId="a" fill="#f59e0b" name="Warning" />
                    <Bar dataKey="fail" stackId="a" fill="#ef4444" name="Fail" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* ============ Pattern Anomalies Section ============ */}
          {invoices.length >= 3 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Pattern Anomalies
                </CardTitle>
                <CardDescription>
                  Automatically detected patterns and anomalies across your invoices
                </CardDescription>
              </CardHeader>
              <CardContent>
                {anomalies.length > 0 ? (
                  <ScrollArea className="max-h-64">
                    <div className="space-y-3 pr-4">
                      {anomalies.map((anomaly, i) => (
                        <div
                          key={i}
                          className={
                            'flex items-start gap-3 p-3 rounded-lg border ' +
                            (anomaly.severity === 'critical'
                              ? 'bg-red-500/5 border-red-500/20'
                              : 'bg-amber-500/5 border-amber-500/20')
                          }
                        >
                          <AlertTriangle
                            className={
                              'h-4 w-4 mt-0.5 shrink-0 ' +
                              (anomaly.severity === 'critical' ? 'text-red-500' : 'text-amber-500')
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-foreground">{anomaly.vendor}</p>
                              <Badge
                                variant="secondary"
                                className={
                                  'text-xs ' +
                                  (anomaly.severity === 'critical'
                                    ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                    : 'bg-amber-500/10 text-amber-600 border-amber-500/20')
                                }
                              >
                                {anomaly.severity}
                              </Badge>
                            </div>
                            <p className="text-xs font-medium text-foreground/80">{anomaly.anomaly}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{anomaly.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <CheckCircle className="h-10 w-10 text-emerald-500/40 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">No anomalies detected</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      All invoices appear to follow normal patterns.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ============ Cost Optimization & Price Change Alerts (Business+) ============ */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                Cost Optimization & Price Change Alerts
                <Badge variant="secondary" className="text-xs ml-auto"><Lock className="h-3 w-3 mr-1" /> Business</Badge>
              </CardTitle>
              <CardDescription>Track significant price changes across your vendors</CardDescription>
            </CardHeader>
            <CardContent>
              {!isBusiness ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Lock className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Upgrade to Business to see price change alerts</p>
                </div>
              ) : priceAlertsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Summary row */}
                  <div className="flex items-center gap-6 mb-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-foreground">{priceAlerts.length} alert{priceAlerts.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{priceAlertsMeta.totalVendors} vendors analyzed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{priceAlertsMeta.analyzedMonths} months</span>
                    </div>
                  </div>

                  {/* Alerts list */}
                  {priceAlerts.length > 0 ? (
                    <ScrollArea className="max-h-96">
                      <div className="space-y-3 pr-4">
                        {priceAlerts.map((alert, i) => {
                          const isIncrease = alert.changePercent > 0;
                          return (
                            <div
                              key={i}
                              className={
                                'flex items-start gap-3 p-3 rounded-lg border ' +
                                (isIncrease
                                  ? 'bg-red-500/5 border-red-500/20'
                                  : 'bg-emerald-500/5 border-emerald-500/20')
                              }
                            >
                              {isIncrease ? (
                                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <p className="text-sm font-medium text-foreground">{alert.vendor}</p>
                                  <Badge
                                    className={
                                      'text-xs ' +
                                      (isIncrease
                                        ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                        : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20')
                                    }
                                  >
                                    {isIncrease ? '+' : ''}{alert.changePercent.toFixed(1)}%
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">{alert.type}</span>
                                </div>
                                <p className="text-xs text-foreground/80">{alert.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {fmtCurrency(alert.oldVal, dominantCurrency)} → {fmtCurrency(alert.newVal, dominantCurrency)}
                                  <span className="ml-2">{alert.prevDate} → {alert.invDate}</span>
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <CheckCircle className="h-10 w-10 text-emerald-500/40 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">No significant price changes detected</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* ============ Vendor Performance Scorecard (Business+) ============ */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3Icon className="h-4 w-4 text-amber-500" />
                Vendor Performance Scorecard
                <Badge variant="secondary" className="text-xs ml-auto"><Lock className="h-3 w-3 mr-1" /> Business</Badge>
              </CardTitle>
              <CardDescription>Comprehensive vendor metrics and reliability scoring</CardDescription>
            </CardHeader>
            <CardContent>
              {!isBusiness ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Lock className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Upgrade to Business to see vendor scorecard</p>
                </div>
              ) : vendorScorecardLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{vendorScorecardMeta.totalVendors} vendors</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Sorted by total spend</span>
                    </div>
                  </div>

                  {vendorScorecards.length > 0 ? (
                    <ScrollArea className="max-h-96">
                      <div className="space-y-4 pr-4">
                        {vendorScorecards.map((sc, i) => {
                          const relTextColor = sc.reliabilityScore >= 80
                            ? 'text-emerald-500'
                            : sc.reliabilityScore >= 50
                              ? 'text-amber-500'
                              : 'text-red-500';
                          return (
                            <div key={i} className="p-4 rounded-lg border border-border/50 bg-card space-y-3">
                              {/* Vendor header row */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="text-sm font-semibold text-foreground truncate">{sc.vendor}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Price trend badge */}
                                  <Badge
                                    className={
                                      'text-xs ' +
                                      (sc.priceTrend > 0
                                        ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                        : sc.priceTrend < 0
                                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                          : 'bg-muted text-muted-foreground')
                                    }
                                  >
                                    {sc.priceTrend > 0 ? (
                                      <><TrendingUp className="h-3 w-3 mr-1" />+{sc.priceTrend.toFixed(1)}%</>
                                    ) : sc.priceTrend < 0 ? (
                                      <><TrendingDown className="h-3 w-3 mr-1" />{sc.priceTrend.toFixed(1)}%</>
                                    ) : (
                                      '— stable'
                                    )}
                                  </Badge>
                                </div>
                              </div>

                              {/* Reliability score bar */}
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground w-20 shrink-0">Reliability</span>
                                <div className="flex-1">
                                  <Progress value={sc.reliabilityScore} className="h-2" />
                                </div>
                                <span className={`text-sm font-bold w-10 text-right ${relTextColor}`}>
                                  {sc.reliabilityScore}
                                </span>
                              </div>

                              {/* Key metrics grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div>
                                  <p className="text-muted-foreground">Invoices</p>
                                  <p className="font-medium text-foreground">{sc.invoiceCount}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Total Amount</p>
                                  <p className="font-medium text-foreground">{fmtCurrency(sc.totalAmount, dominantCurrency)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Avg Confidence</p>
                                  <p className="font-medium text-foreground">{(sc.avgConfidence * 100).toFixed(1)}%</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Duplicates</p>
                                  <p className={"font-medium " + (sc.duplicateCount > 0 ? 'text-red-500' : 'text-foreground')}>{sc.duplicateCount}</p>
                                </div>
                              </div>

                              {/* Pass/Warn/Fail counts */}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  {sc.passCount} pass
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                                  {sc.warningCount} warn
                                </span>
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-red-500" />
                                  {sc.failCount} fail
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <BarChart3Icon className="h-10 w-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">No vendor scorecard data available</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function VendorRiskSection({ invoices }: { invoices: InvoiceRow[] }) {
  const plan = useAppStore((s) => s.user?.plan);
  const vendorRisk = useMemo(() => {
    const vendorMap: Record<string, { total: number; flagged: number; duplicates: number }> = {};
    for (const inv of invoices) {
      const v = inv.vendor || 'Unknown';
      if (!vendorMap[v]) vendorMap[v] = { total: 0, flagged: 0, duplicates: 0 };
      vendorMap[v].total++;
      if (inv.validationStatus === 'fail' || inv.validationStatus === 'warning') vendorMap[v].flagged++;
      if (inv.isDuplicate) vendorMap[v].duplicates++;
    }
    return Object.entries(vendorMap)
      .map(([vendor, data]) => ({
        vendor,
        riskScore: data.total > 0 ? Math.round((data.flagged / data.total) * 1000) / 10 : 0,
        totalInvoices: data.total,
        flaggedInvoices: data.flagged,
        duplicateAttempts: data.duplicates,
      }))
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [invoices]);

  if (!['plus', 'business', 'enterprise'].includes(plan || '')) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Vendor Risk Scoring
            <Badge variant="secondary" className="text-xs ml-auto"><Lock className="h-3 w-3 mr-1" /> Plus</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Upgrade to Plus to see vendor risk scores based on flagged invoices, duplicate attempts, and tampering detection.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          Vendor Risk Scoring
        </CardTitle>
        <CardDescription>Risk per vendor based on validation failures and duplicate attempts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {vendorRisk.map((v) => {
            const color = v.riskScore >= 50 ? 'text-red-500' : v.riskScore >= 20 ? 'text-amber-500' : 'text-emerald-500';
            const bgColor = v.riskScore >= 50 ? 'bg-red-500' : v.riskScore >= 20 ? 'bg-amber-500' : 'bg-emerald-500';
            return (
              <div key={v.vendor} className="flex items-center gap-4">
                <span className="text-sm font-medium w-32 truncate" title={v.vendor}>{v.vendor}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{v.totalInvoices} invoices, {v.flaggedInvoices} flagged</span>
                    {v.duplicateAttempts > 0 && <span className="text-xs text-amber-500">{v.duplicateAttempts} dup</span>}
                  </div>
                  <Progress value={v.riskScore} className="h-2" />
                </div>
                <span className={`text-sm font-bold w-12 text-right ${color}`}>{v.riskScore}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> 0-20 Low</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 20-50 Medium</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> 50+ High</span>
        </div>
      </CardContent>
    </Card>
  );
}
