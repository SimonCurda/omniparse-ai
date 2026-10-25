'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

export function CtaSection({ onAuth }: { onAuth: (v: 'login' | 'signup') => void }) {
  const { t } = useI18n();
  return (
    <section className="bg-gradient-to-b from-background via-primary/5 to-background py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
          {t('cta.title')}
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          {t('cta.subtitle')}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" onClick={() => onAuth('signup')}>
            {t('cta.button.signup')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => onAuth('login')}>
            {t('cta.button.signin')}
          </Button>
        </div>
      </div>
    </section>
  );
}
