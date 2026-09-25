'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FEATURES, type Feature } from './landing-data';

const glassCardStyle = `
  .glass-card {
    --mouse-x: 50%;
    --mouse-y: 50%;
    --border-glow: 0;
    position: relative;
  }

  /* Inner spotlight — soft radial that follows cursor */
  .glass-card::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(
      320px circle at var(--mouse-x) var(--mouse-y),
      rgba(245,158,11,0.10),
      rgba(245,158,11,0.04) 30%,
      transparent 60%
    );
    pointer-events: none;
    z-index: 0;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    filter: blur(8px);
  }
  .glass-card[data-glow-active]::after {
    visibility: visible;
    opacity: 1;
  }

  /* Border glow — single radial-gradient positioned at cursor.
     The mask shows only the 1.5px border ring. The radial gradient
     creates a SMOOTH falloff: the point on the border closest to the
     cursor is brightest, and it smoothly fades to transparent as you
     move along the border away from the cursor. No banding, no segments.
     The radius is tight enough that far walls stay dark. */
  .glass-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1.5px;
    background: radial-gradient(
      180px circle at var(--mouse-x) var(--mouse-y),
      rgba(245,158,11,0.9) 0%,
      rgba(245,158,11,0.5) 25%,
      rgba(245,158,11,0.2) 50%,
      rgba(245,158,11,0.05) 75%,
      transparent 100%
    );
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
    z-index: 1;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .glass-card[data-glow-active]::before {
    visibility: visible;
    opacity: 1;
  }

  .glass-card > * {
    position: relative;
    z-index: 2;
  }
`;

function FeatureCard({ icon: Icon, title, description }: Feature) {
  return (
    <>
      <style>{glassCardStyle}</style>
      <Card
        data-glow
        className="glass-card border-border/50 bg-card transition-all h-full overflow-hidden hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5"
      >
        <CardHeader>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3 transition-transform duration-300 hover:scale-110">
            <Icon className="h-5 w-5 text-amber-500" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </CardContent>
      </Card>
    </>
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