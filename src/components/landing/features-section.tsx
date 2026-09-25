'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FEATURES, type Feature } from './landing-data';

const glassCardStyle = `
  .glass-card {
    --mouse-x: 50%;
    --mouse-y: 50%;
    --glow-strength: 0;
    --edge-top-0: 0;
    --edge-top-25: 0;
    --edge-top-50: 0;
    --edge-top-75: 0;
    --edge-top-100: 0;
    --edge-bottom-0: 0;
    --edge-bottom-25: 0;
    --edge-bottom-50: 0;
    --edge-bottom-75: 0;
    --edge-bottom-100: 0;
    --edge-left-0: 0;
    --edge-left-33: 0;
    --edge-left-66: 0;
    --edge-left-100: 0;
    --edge-right-0: 0;
    --edge-right-33: 0;
    --edge-right-66: 0;
    --edge-right-100: 0;
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
      rgba(245,158,11,calc(0.10 * var(--glow-strength))),
      rgba(245,158,11,calc(0.04 * var(--glow-strength))) 30%,
      transparent 60%
    );
    pointer-events: none;
    z-index: 0;
    opacity: var(--glow-strength);
    transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    filter: blur(8px);
  }

  /* Reactive border — each wall is split into segments. Each segment's
     brightness is independently controlled by a CSS variable that the
     JS sets based on the exact pixel distance from the cursor to that
     point on the wall. This makes every part of every wall dimmer or
     brighter depending on exact distance from cursor. */
  .glass-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1.5px;
    background:
      /* Top wall: 5 segments left-to-right */
      linear-gradient(to right,
        rgba(245,158,11,calc(1.0 * var(--edge-top-0))) 0%,
        rgba(245,158,11,calc(1.0 * var(--edge-top-0))) 20%,
        rgba(245,158,11,calc(1.0 * var(--edge-top-25))) 20%,
        rgba(245,158,11,calc(1.0 * var(--edge-top-25))) 40%,
        rgba(245,158,11,calc(1.0 * var(--edge-top-50))) 40%,
        rgba(245,158,11,calc(1.0 * var(--edge-top-50))) 60%,
        rgba(245,158,11,calc(1.0 * var(--edge-top-75))) 60%,
        rgba(245,158,11,calc(1.0 * var(--edge-top-75))) 80%,
        rgba(245,158,11,calc(1.0 * var(--edge-top-100))) 80%,
        rgba(245,158,11,calc(1.0 * var(--edge-top-100))) 100%
      ),
      /* Bottom wall: 5 segments left-to-right */
      linear-gradient(to right,
        rgba(245,158,11,calc(1.0 * var(--edge-bottom-0))) 0%,
        rgba(245,158,11,calc(1.0 * var(--edge-bottom-0))) 20%,
        rgba(245,158,11,calc(1.0 * var(--edge-bottom-25))) 20%,
        rgba(245,158,11,calc(1.0 * var(--edge-bottom-25))) 40%,
        rgba(245,158,11,calc(1.0 * var(--edge-bottom-50))) 40%,
        rgba(245,158,11,calc(1.0 * var(--edge-bottom-50))) 60%,
        rgba(245,158,11,calc(1.0 * var(--edge-bottom-75))) 60%,
        rgba(245,158,11,calc(1.0 * var(--edge-bottom-75))) 80%,
        rgba(245,158,11,calc(1.0 * var(--edge-bottom-100))) 80%,
        rgba(245,158,11,calc(1.0 * var(--edge-bottom-100))) 100%
      ),
      /* Left wall: 4 segments top-to-bottom */
      linear-gradient(to bottom,
        rgba(245,158,11,calc(1.0 * var(--edge-left-0))) 0%,
        rgba(245,158,11,calc(1.0 * var(--edge-left-0))) 33%,
        rgba(245,158,11,calc(1.0 * var(--edge-left-33))) 33%,
        rgba(245,158,11,calc(1.0 * var(--edge-left-33))) 66%,
        rgba(245,158,11,calc(1.0 * var(--edge-left-66))) 66%,
        rgba(245,158,11,calc(1.0 * var(--edge-left-66))) 100%
      ),
      /* Right wall: 4 segments top-to-bottom */
      linear-gradient(to bottom,
        rgba(245,158,11,calc(1.0 * var(--edge-right-0))) 0%,
        rgba(245,158,11,calc(1.0 * var(--edge-right-0))) 33%,
        rgba(245,158,11,calc(1.0 * var(--edge-right-33))) 33%,
        rgba(245,158,11,calc(1.0 * var(--edge-right-33))) 66%,
        rgba(245,158,11,calc(1.0 * var(--edge-right-66))) 66%,
        rgba(245,158,11,calc(1.0 * var(--edge-right-66))) 100%
      );
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
    z-index: 1;
    opacity: var(--glow-strength);
    transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
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