'use client';

import { FileText, ArrowRight, Sparkles, Table2, BarChart3, Shield } from 'lucide-react';

/**
 * Animated hero visual showing the invoice processing flow.
 * 5-step pipeline: Upload → AI Processing → Extracted Data → Confidence → Valid
 * Staggered CSS animations, responsive layout, theme-aware.
 */
export function HeroVisual() {
  return (
    <>
      {/* ---------- inline keyframes (no globals.css changes) ---------- */}
      <style>{`
        @keyframes hero-fade-up {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes hero-pulse-glow {
          0%, 100% { opacity: .45; transform: scale(1); }
          50%      { opacity: .75; transform: scale(1.15); }
        }
        @keyframes hero-dash {
          to { stroke-dashoffset: -16; }
        }
        @keyframes hero-sparkle-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: .7; transform: scale(1.18); }
        }
        .hero-step {
          opacity: 0;
          animation: hero-fade-up 0.6s ease-out forwards;
        }
        .hero-step-1 { animation-delay: 0ms; }
        .hero-step-2 { animation-delay: 200ms; }
        .hero-step-3 { animation-delay: 400ms; }
        .hero-step-4 { animation-delay: 600ms; }
        .hero-step-5 { animation-delay: 800ms; }
        .hero-connector {
          opacity: 0;
          animation: hero-fade-up 0.4s ease-out forwards;
        }
        .hero-conn-1 { animation-delay: 100ms; }
        .hero-conn-2 { animation-delay: 300ms; }
        .hero-conn-3 { animation-delay: 500ms; }
        .hero-conn-4 { animation-delay: 700ms; }
        .hero-glow {
          animation: hero-pulse-glow 3s ease-in-out infinite;
        }
        .hero-sparkle {
          animation: hero-sparkle-pulse 2.4s ease-in-out infinite;
        }
        .hero-dash-line {
          stroke-dasharray: 6 10;
          animation: hero-dash 1.2s linear infinite;
        }
      `}</style>

      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* ---- Desktop horizontal flow (lg+) ---- */}
        <div className="hidden lg:flex items-center justify-center gap-2">
          {/* Step 1 – Upload */}
          <StepCard
            step={1}
            label="Upload"
            icon={<FileText className="h-6 w-6 text-amber-500" />}
          />

          <Connector step={1} />

          {/* Step 2 – AI Processing (with glow) */}
          <div className="relative">
            {/* glow blob */}
            <span className="hero-glow pointer-events-none absolute -inset-4 rounded-full bg-amber-500/15 blur-2xl" />
            <StepCard
              step={2}
              label="AI Processing"
              icon={<Sparkles className="h-6 w-6 text-amber-500 hero-sparkle" />}
              glow
            />
          </div>

          <Connector step={2} />

          {/* Step 3 – Extracted Data */}
          <StepCard
            step={3}
            label="Extracted Data"
            detail
          />

          <Connector step={3} />

          {/* Step 4 – Confidence */}
          <StepCard
            step={4}
            label="Confidence"
            icon={<BarChart3 className="h-6 w-6 text-emerald-500" />}
            bar
          />

          <Connector step={4} />

          {/* Step 5 – Valid */}
          <StepCard
            step={5}
            label="Valid"
            icon={
              <span className="relative">
                <Shield className="h-6 w-6 text-emerald-500" />
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card flex items-center justify-center">
                  <span className="text-[7px] font-bold text-white leading-none">✓</span>
                </span>
              </span>
            }
          />
        </div>

        {/* ---- Mobile / tablet stacked flow ---- */}
        <div className="flex flex-col items-center gap-4 lg:hidden">
          <div className="relative">
            <StepCard
              step={1}
              label="Upload"
              icon={<FileText className="h-6 w-6 text-amber-500" />}
            />
          </div>
          <MobileConnector step={1} />

          <div className="relative">
            <span className="hero-glow pointer-events-none absolute -inset-4 rounded-full bg-amber-500/15 blur-2xl" />
            <StepCard
              step={2}
              label="AI Processing"
              icon={<Sparkles className="h-6 w-6 text-amber-500 hero-sparkle" />}
              glow
            />
          </div>
          <MobileConnector step={2} />

          <StepCard
            step={3}
            label="Extracted Data"
            detail
          />
          <MobileConnector step={3} />

          <StepCard
            step={4}
            label="Confidence"
            icon={<BarChart3 className="h-6 w-6 text-emerald-500" />}
            bar
          />
          <MobileConnector step={4} />

          <StepCard
            step={5}
            label="Valid"
            icon={
              <span className="relative">
                <Shield className="h-6 w-6 text-emerald-500" />
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card flex items-center justify-center">
                  <span className="text-[7px] font-bold text-white leading-none">✓</span>
                </span>
              </span>
            }
          />
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StepCard({
  step,
  label,
  icon,
  glow,
  detail,
  bar,
}: {
  step: number;
  label: string;
  icon?: React.ReactNode;
  glow?: boolean;
  detail?: boolean;
  bar?: boolean;
}) {
  return (
    <div className={`hero-step hero-step-${step} flex flex-col items-center gap-2`}>
      <div
        className={`
          relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border
          ${glow ? 'border-amber-500/30 bg-amber-500/10' : 'border-border bg-card'}
          transition-colors
        `}
      >
        {detail ? (
          /* Mini JSON-like extracted data card */
          <div className="flex flex-col gap-0.5 text-[9px] leading-tight font-mono">
            <span className="text-muted-foreground">{'{ '}</span>
            <span className="text-amber-500">vendor</span>
            <span className="text-foreground/80 ml-1">"Acme Ltd"</span>
            <span className="text-amber-500">total</span>
            <span className="text-foreground/80 ml-1">1,240.00</span>
            <span className="text-muted-foreground">{ '}' }</span>
          </div>
        ) : bar ? (
          /* Mini confidence bar */
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-end gap-0.5 h-7">
              {[4, 7, 5, 9, 6, 8].map((h, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-sm bg-emerald-500/70"
                  style={{ height: `${h * 3}px` }}
                />
              ))}
            </div>
            <span className="text-[8px] font-semibold text-emerald-500">98%</span>
          </div>
        ) : (
          icon
        )}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

/** Horizontal dashed-line connector (desktop) */
function Connector({ step }: { step: number }) {
  return (
    <div className={`hero-connector hero-conn-${step} flex-1 max-w-[56px] mx-1`}>
      <svg
        className="w-full h-4"
        viewBox="0 0 56 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <line
          x1="0" y1="8" x2="56" y2="8"
          className="hero-dash-line stroke-border"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/** Vertical dashed-line connector (mobile) */
function MobileConnector({ step }: { step: number }) {
  return (
    <div className={`hero-connector hero-conn-${step} flex flex-col items-center h-8`}>
      <svg
        className="h-full w-4"
        viewBox="0 0 16 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <line
          x1="8" y1="0" x2="8" y2="32"
          className="hero-dash-line stroke-border"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
