'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { HeroVisual } from './hero-visual';

export function Hero({ onAuth }: { onAuth: (v: 'login' | 'signup') => void }) {
  return (
    <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
          Invoice parsing,{' '}
          <span className="text-amber-500">powered by AI</span>
        </h1>
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