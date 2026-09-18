'use client';

import { useState } from 'react';
import { COMPARISON_DATA, COMPETITORS } from './landing-data';
import { Check, X, Info, ChevronDown } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function CellValue({ value, highlight }: { value: string | boolean; highlight?: boolean }) {
  if (value === true) {
    return <Check className={`h-4 w-4 ${highlight ? 'text-emerald-500' : 'text-emerald-500/70'} mx-auto`} />;
  }
  if (value === false) {
    return <X className="h-4 w-4 text-muted-foreground/50 mx-auto" />;
  }
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

/** Mobile: tappable row that expands to show tooltip text */
function MobileFeatureRow({ row }: { row: typeof COMPARISON_DATA[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        className="w-full px-4 py-3 border-b border-border flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {row.feature}
          {row.tooltip && <Info className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && row.tooltip && (
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
          <p className="text-xs text-muted-foreground leading-relaxed">{row.tooltip}</p>
        </div>
      )}
      <div className="grid grid-cols-2">
        {/* OmniParse - highlighted */}
        <div className="p-3 flex flex-col items-center gap-1 bg-primary/5 border-r border-b border-border">
          <CellValue value={row.omniparse} highlight />
          <span className="text-[11px] font-semibold text-foreground">{COMPETITORS.omniparse}</span>
        </div>
        {/* Competitor 1 */}
        <div className="p-3 flex flex-col items-center gap-1 border-b border-border">
          <CellValue value={row.competitor1} />
          <span className="text-[11px] text-muted-foreground">{COMPETITORS.competitor1}</span>
        </div>
        {/* Competitor 2 */}
        <div className="p-3 flex flex-col items-center gap-1 border-r border-border">
          <CellValue value={row.competitor2} />
          <span className="text-[11px] text-muted-foreground">{COMPETITORS.competitor2}</span>
        </div>
        {/* Competitor 3 */}
        <div className="p-3 flex flex-col items-center gap-1">
          <CellValue value={row.competitor3} />
          <span className="text-[11px] text-muted-foreground">{COMPETITORS.competitor3}</span>
        </div>
      </div>
    </div>
  );
}

export function ComparisonSection() {
  return (
    <section id="comparison" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">See How We Compare</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            A transparent look at how OmniParse stacks up against other invoice parsing tools.
          </p>
        </div>

        {/* Desktop table - hidden on mobile */}
        <div className="hidden lg:block rounded-xl border border-border overflow-hidden bg-card">
          {/* Header row */}
          <div className="grid grid-cols-5 bg-muted/50">
            <div className="p-4 text-sm font-medium text-muted-foreground border-b border-border">
              Feature
            </div>
            <div className="p-4 text-sm font-semibold text-center text-foreground border-b border-border bg-primary/10">
              {COMPETITORS.omniparse}
            </div>
            <div className="p-4 text-sm font-medium text-center text-muted-foreground border-b border-border">
              {COMPETITORS.competitor1}
            </div>
            <div className="p-4 text-sm font-medium text-center text-muted-foreground border-b border-border">
              {COMPETITORS.competitor2}
            </div>
            <div className="p-4 text-sm font-medium text-center text-muted-foreground border-b border-border">
              {COMPETITORS.competitor3}
            </div>
          </div>

          {/* Data rows */}
          {COMPARISON_DATA.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-5 ${i % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'} hover:bg-muted/50 transition-colors`}
            >
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 flex items-center gap-1.5 text-sm cursor-help border-b border-border">
                      {row.feature}
                      <Info className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                    {row.tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="p-3 flex items-center justify-center border-b border-border bg-primary/5">
                <CellValue value={row.omniparse} highlight />
              </div>
              <div className="p-3 flex items-center justify-center border-b border-border">
                <CellValue value={row.competitor1} />
              </div>
              <div className="p-3 flex items-center justify-center border-b border-border">
                <CellValue value={row.competitor2} />
              </div>
              <div className="p-3 flex items-center justify-center border-b border-border">
                <CellValue value={row.competitor3} />
              </div>
            </div>
          ))}
        </div>

        {/* Mobile cards - visible only on mobile, uses tappable accordion */}
        <div className="lg:hidden space-y-3">
          {COMPARISON_DATA.map((row) => (
            <MobileFeatureRow key={row.feature} row={row} />
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Comparison based on publicly available information as of August 2026. Tap any feature name on mobile for a description.
        </p>
      </div>
    </section>
  );
}
