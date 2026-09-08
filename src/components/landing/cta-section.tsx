'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CtaSection({ onAuth }: { onAuth: (v: 'login' | 'signup') => void }) {
  return (
    <section className="bg-gradient-to-b from-background via-primary/5 to-background py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
          Ready to get started?
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Start parsing invoices in minutes. Free forever for up to 15 invoices per month.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" onClick={() => onAuth('signup')}>
            Get Started Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => onAuth('login')}>
            Sign In
          </Button>
        </div>
      </div>
    </section>
  );
}
