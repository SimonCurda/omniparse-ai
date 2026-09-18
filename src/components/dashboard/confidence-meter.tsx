'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const FIELD_LABELS: Record<string, string> = {
  vendor: 'Vendor',
  invoiceNumber: 'Invoice #',
  invoiceDate: 'Date',
  dueDate: 'Due Date',
  amount: 'Amount',
  vatAmount: 'VAT',
  total: 'Total',
  currency: 'Currency',
};

function confColor(pct: number): string {
  if (pct >= 90) return 'bg-emerald-500';
  if (pct >= 75) return 'bg-amber-500';
  return 'bg-red-500';
}

function confTextColor(pct: number): string {
  if (pct >= 90) return 'text-emerald-500';
  if (pct >= 75) return 'text-amber-500';
  return 'text-red-500';
}

export function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return <span className="text-xs text-muted-foreground">N/A</span>;
  const pct = Math.round(confidence * 100);
  return (
    <span className={"text-xs font-medium " + confTextColor(pct)}>
      {pct}%
    </span>
  );
}

export function ConfidenceMeter({
  confidence,
  fieldConfidence,
}: {
  confidence: number | null;
  fieldConfidence?: Record<string, number> | null;
}) {
  if (confidence === null) return <span className="text-xs text-muted-foreground">N/A</span>;

  const pct = Math.round(confidence * 100);
  const fields = fieldConfidence
    ? Object.entries(fieldConfidence).filter(([key]) => FIELD_LABELS[key])
    : [];

  // No per-field data — show simple badge
  if (fields.length === 0) {
    return <ConfidenceBadge confidence={confidence} />;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="flex items-center gap-2 group cursor-default">
            {/* Overall confidence bar */}
            <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={"h-full rounded-full transition-all " + confColor(pct)}
                style={{ width: pct + '%' }}
              />
            </div>
            <span className={"text-xs font-medium " + confTextColor(pct)}>{pct}%</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="w-56 p-3">
          <p className="text-xs font-medium mb-2">AI Extraction Confidence</p>
          <div className="space-y-1.5">
            {fields.map(([key, val]) => {
              const v = Math.round(val * 100);
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">{FIELD_LABELS[key] || key}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={"h-full rounded-full " + confColor(v)} style={{ width: v + '%' }} />
                  </div>
                  <span className={"text-xs font-mono w-8 text-right " + confTextColor(v)}>{v}%</span>
                </div>
              );
            })}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
