'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FEATURES, type Feature } from './landing-data';

function FeatureCard({ icon: Icon, title, description }: Feature) {
  return (
    <Card className="border-border/50 bg-card hover:border-border hover:bg-muted/50 transition-all h-full">
      <CardHeader>
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
          <Icon className="h-5 w-5 text-amber-500" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">What OmniParse Does</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Here is exactly what the application can do right now. No inflated claims.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
          ))}
        </div>
      </div>
    </section>
  );
}