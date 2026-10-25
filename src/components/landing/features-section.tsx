'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FEATURES } from './landing-data';
import { useI18n } from '@/lib/i18n';

// Map each feature in landing-data.ts to a translation key. The
// landing-data.ts file keeps the canonical English copy + icons; this
// component looks up the translated title/description by index.
const FEATURE_KEYS = [
  { title: 'features.upload.title',        description: 'features.upload.description' },
  { title: 'features.extraction.title',    description: 'features.extraction.description' },
  { title: 'features.tampering.title',     description: 'features.tampering.description' },
  { title: 'features.chat.title',          description: 'features.chat.description' },
  { title: 'features.export.title',        description: 'features.export.description' },
  { title: 'features.analytics.title',     description: 'features.analytics.description' },
];

export function FeaturesSection() {
  const { t } = useI18n();

  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl 2xl:max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{t('features.section.title')}</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('features.section.subtitle')}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            const keys = FEATURE_KEYS[i] ?? FEATURE_KEYS[0];
            return (
              <Card
                key={i}
                data-glow
                className="glass-card border-border/50 bg-card transition-all h-full overflow-hidden hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5"
              >
                <CardHeader>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3 transition-transform duration-300 hover:scale-110">
                    <Icon className="h-5 w-5 text-amber-500" />
                  </div>
                  <CardTitle className="text-lg">{t(keys.title)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(keys.description)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
