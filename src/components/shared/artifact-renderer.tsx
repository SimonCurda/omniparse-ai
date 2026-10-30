'use client';

// ============================================================================
// ArtifactRenderer — shared chart/table/summary renderer for AI chat artifacts
//
// Used by:
//   • Model Tester (admin)  — renders artifacts the tested model produces
//   • Production chat-tab   — (can be migrated to this shared component later)
//
// Supports the 5 artifact types the chatbot system prompt defines:
//   table, chart-bar, chart-line, chart-pie, summary
//
// Any unknown type falls back to a raw JSON view so the admin can still
// inspect what the model emitted.
//
// NOTE on CSS variables: this project uses Tailwind 4 with direct-value CSS
// variables (--border: #d6d0c8, NOT hsl-wrapped). So recharts stroke/fill
// props use `var(--border)` directly. The older `hsl(var(--border))` syntax
// (still in the production chat-tab) produces invalid CSS and invisible axes.
// ============================================================================

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Loose artifact shape — title is optional (models don't always include it).
 * The production `Artifact` type (with required title) is structurally
 * compatible with this, so both can use the same renderer.
 */
export interface RenderableArtifact {
  type: string;
  title?: string;
  data: Record<string, unknown>;
}

/**
 * Type guard: validates that an unknown value (from `parsed.artifact`) has
 * the minimum shape needed to render. The caller passes the result of this
 * guard before handing the artifact to <ArtifactRenderer/>.
 */
export function isRenderableArtifact(a: unknown): a is RenderableArtifact {
  if (typeof a !== 'object' || a === null) return false;
  const obj = a as Record<string, unknown>;
  return (
    typeof obj.type === 'string' &&
    typeof obj.data === 'object' &&
    obj.data !== null
  );
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PIE_COLORS = [
  '#f59e0b', '#10b981', '#6366f1', '#ef4444',
  '#71717a', '#06b6d4', '#f97316', '#8b5cf6',
];

const SUPPORTED_TYPES = new Set([
  'table', 'chart-bar', 'chart-line', 'chart-pie', 'summary',
]);

// ─── Sub-renderers ──────────────────────────────────────────────────────────

function ArtifactTable({ data }: { data: Record<string, unknown> }) {
  const columns = (data.columns as string[]) || [];
  const rows = (data.rows as Array<Record<string, unknown>>) || [];

  // If the model didn't provide explicit columns, derive them from the first row.
  const effectiveColumns =
    columns.length > 0
      ? columns
      : rows.length > 0
        ? Object.keys(rows[0])
        : [];

  if (effectiveColumns.length === 0 || rows.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        Empty table (no columns or rows in artifact data).
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className="border-b border-border bg-muted/50">
              {effectiveColumns.map((c) => (
                <th key={c} className="text-left px-3 py-2 font-medium whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                {effectiveColumns.map((c) => (
                  <td key={c} className="px-3 py-2 break-words">
                    {String(row[c] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ArtifactBarChart({ data }: { data: Record<string, unknown> }) {
  const chartData = (data.data as Array<Record<string, unknown>>) || [];
  const xKey = (data.xKey as string) || 'name';
  const yKeys = (data.yKeys as string[]) || ['value'];
  const colors = (data.colors as string[]) || ['#f59e0b'];

  if (chartData.length === 0) {
    return <div className="text-xs text-muted-foreground py-2">No data points in chart.</div>;
  }

  return (
    <div className="mt-2 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey={xKey} stroke="var(--muted-foreground)" fontSize={11} />
          <YAxis stroke="var(--muted-foreground)" fontSize={11} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'var(--card-foreground)',
            }}
          />
          {yKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={colors[i] || colors[0]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ArtifactLineChart({ data }: { data: Record<string, unknown> }) {
  const chartData = (data.data as Array<Record<string, unknown>>) || [];
  const xKey = (data.xKey as string) || 'name';
  const yKeys = (data.yKeys as string[]) || ['value'];
  const colors = (data.colors as string[]) || ['#f59e0b'];

  if (chartData.length === 0) {
    return <div className="text-xs text-muted-foreground py-2">No data points in chart.</div>;
  }

  return (
    <div className="mt-2 h-64">
      <ResponsiveContainer width="100%" height="100%">
        {/* AreaChart is used for "chart-line" — same as production chat-tab.
            Gives a filled area under the line, which looks better than a
            bare line for invoice trends. */}
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey={xKey} stroke="var(--muted-foreground)" fontSize={11} />
          <YAxis stroke="var(--muted-foreground)" fontSize={11} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'var(--card-foreground)',
            }}
          />
          {yKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[i] || colors[0]}
              fill={colors[i] || colors[0]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ArtifactPieChart({ data }: { data: Record<string, unknown> }) {
  const chartData = (data.data as Array<Record<string, unknown>>) || [];
  const nameKey = (data.nameKey as string) || 'name';
  const valueKey = (data.valueKey as string) || 'value';
  const colors = (data.colors as string[]) || PIE_COLORS;

  if (chartData.length === 0) {
    return <div className="text-xs text-muted-foreground py-2">No data points in chart.</div>;
  }

  return (
    <div className="mt-2 h-64 flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            dataKey={valueKey}
            nameKey={nameKey}
            label={({ name, percent }) =>
              `${name} ${((percent as number) * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'var(--card-foreground)',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ArtifactSummary({ data }: { data: Record<string, unknown> }) {
  const metrics =
    (data.metrics as Array<{ label: string; value: string; description?: string }>) || [];

  if (metrics.length === 0) {
    return <div className="text-xs text-muted-foreground py-2">No metrics in summary.</div>;
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-3">
      {metrics.map((m, i) => (
        <div key={i} className="bg-background rounded-lg p-3 border border-border/50">
          <div className="text-xs text-muted-foreground">{m.label}</div>
          <div className="text-lg font-bold mt-1">{m.value}</div>
          {m.description && (
            <div className="text-xs text-muted-foreground mt-1">{m.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main renderer ──────────────────────────────────────────────────────────

export function ArtifactRenderer({ artifact }: { artifact: RenderableArtifact }) {
  const [open, setOpen] = useState(true);
  const title = artifact.title || artifact.type;
  const isSupported = SUPPORTED_TYPES.has(artifact.type);

  return (
    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-amber-500/5 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span className="truncate">{title}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] border border-border text-muted-foreground shrink-0">
            {artifact.type}
          </span>
          {!isSupported && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              unsupported type
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-3">
          {artifact.type === 'table' && <ArtifactTable data={artifact.data} />}
          {artifact.type === 'chart-bar' && <ArtifactBarChart data={artifact.data} />}
          {artifact.type === 'chart-line' && <ArtifactLineChart data={artifact.data} />}
          {artifact.type === 'chart-pie' && <ArtifactPieChart data={artifact.data} />}
          {artifact.type === 'summary' && <ArtifactSummary data={artifact.data} />}
          {!isSupported && (
            <div className="text-xs text-muted-foreground py-2">
              This artifact type (&ldquo;{artifact.type}&rdquo;) is not supported by the
              renderer. Check the JSON below to inspect the raw output.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
