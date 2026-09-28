'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { HeroVisual } from './hero-visual';

// ─── Rotating taglines ────────────────────────────────────────────────────
// Each phrase completes the sentence "Invoice parsing, ___" and highlights
// a different value prop. They rotate every 2.8s with a smooth fade+slide.
// Keep them short (2-5 words), punchy, and confident — this is the first
// thing visitors see.
const ROTATING_TAGLINES: string[] = [
  'powered by AI',
  'reimagined',
  'at the speed of thought',
  'without the busywork',
  'in seconds, not hours',
  'that actually gets it right',
  'built for finance teams',
  'with zero setup',
];

function RotatingHeadline() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % ROTATING_TAGLINES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
      Invoice parsing,{' '}
      <span className="relative inline-block">
        {/* The rotating phrase — keyed by index so it re-mounts and replays
            the CSS animation on each change. */}
        <span
          key={index}
          className="text-amber-500 inline-block animate-headline-fade"
        >
          {ROTATING_TAGLINES[index]}
        </span>
      </span>
    </h1>
  );
}

export function Hero({ onAuth }: { onAuth: (v: 'login' | 'signup') => void }) {
  return (
    <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <RotatingHeadline />
        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Upload invoices and receipts. Our AI extracts vendor details, amounts, line items, and more — with
          real-time confidence scores. Chat with your data, generate charts, and export results.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="text-base px-8" onClick={() => onAuth('signup')}>
            Get Started <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-base px-8"
            onClick={() => onAuth('login')}
          >
            Sign In
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Free forever for up to 15 invoices/month. No credit card required.{' '}
          <a
            href="#pricing"
            className="text-amber-500 hover:text-amber-600 underline underline-offset-2 transition-colors"
          >
            View plans →
          </a>
        </p>
        <HeroVisual />
      </div>
    </section>
  );
}
