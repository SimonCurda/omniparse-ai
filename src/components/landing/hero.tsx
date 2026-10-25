'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { HeroVisual } from './hero-visual';
import { useI18n } from '@/lib/i18n';

// ─── Rotating taglines ────────────────────────────────────────────────────
// Each phrase completes the sentence "Invoice parsing, ___" and highlights
// a different value prop. They rotate every 2.8s with a smooth fade+slide.
// Keep them short (2-5 words), punchy, and confident — this is the first
// thing visitors see.
//
// Taglines are translated via t('hero.tagline.N') so each language has its
// own idiomatic version. Missing keys fall back to English.
const TAGLINE_KEYS = [
  'hero.tagline.1', 'hero.tagline.2', 'hero.tagline.3', 'hero.tagline.4',
  'hero.tagline.5', 'hero.tagline.6', 'hero.tagline.7', 'hero.tagline.8',
  'hero.tagline.9', 'hero.tagline.10', 'hero.tagline.11', 'hero.tagline.12',
  'hero.tagline.13', 'hero.tagline.14', 'hero.tagline.15', 'hero.tagline.16',
];

function RotatingHeadline() {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % TAGLINE_KEYS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight text-foreground">
      {t('hero.title.prefix')}{' '}
      <span className="relative inline-block">
        {/* The rotating phrase — keyed by index so it re-mounts and replays
            the CSS animation on each change. */}
        <span
          key={index}
          className="text-primary inline-block animate-headline-fade"
        >
          {t(TAGLINE_KEYS[index])}
        </span>
      </span>
    </h1>
  );
}

export function Hero({ onAuth }: { onAuth: (v: 'login' | 'signup') => void }) {
  const { t } = useI18n();

  // The hero subtitle has inline {strong}...{/strong} markers around the
  // "any currency" phrase. We split on those markers and wrap the middle
  // chunk in <strong>. The strong text itself lives INSIDE the translation
  // string (between the markers), so we don't need a separate key for it.
  // Using [\s\S] instead of /s flag so this works on older TS targets.
  const subtitle = t('hero.subtitle');
  const strongMatch = subtitle.match(/^([\s\S]*?)\{strong\}([\s\S]+?)\{\/strong\}([\s\S]*)$/);

  return (
    <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl 2xl:max-w-5xl mx-auto text-center">
        <RotatingHeadline />
        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {strongMatch ? (
            <>
              {strongMatch[1]}
              <strong className="text-foreground">{strongMatch[2]}</strong>
              {strongMatch[3]}
            </>
          ) : subtitle}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="text-base px-8" onClick={() => onAuth('signup')}>
            {t('hero.cta.signup')} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-base px-8"
            onClick={() => onAuth('login')}
          >
            {t('hero.cta.signin')}
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {t('hero.free.note')}{' '}
          <a
            href="#pricing"
            className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
          >
            {t('hero.view.plans')}
          </a>
        </p>
        <HeroVisual />
      </div>
    </section>
  );
}
