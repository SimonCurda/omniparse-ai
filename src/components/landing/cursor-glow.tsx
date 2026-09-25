'use client';

import { useEffect, useRef } from 'react';

/**
 * Ambient cursor glow + liquid-glass spotlight on [data-glow] elements.
 *
 * Approach:
 * - Ambient: a fixed div that follows the cursor globally (smooth lerp)
 * - Spotlight: injected as a CSS variable (--mouse-x, --mouse-y) directly
 *   onto each [data-glow] element. The element itself renders the spotlight
 *   via a ::before pseudo-element using those variables. This means:
 *   - No separate fixed div to track
 *   - No scroll listener needed
 *   - No glitch — the spotlight is part of the card, moves with it
 *   - Pure CSS rendering, no JS per-frame updates for the spotlight
 */
export function CursorGlow() {
  const ambientRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let rafId: number | null = null;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;

    const animate = () => {
      currentX += (targetX - currentX) * 0.15;
      currentY += (targetY - currentY) * 0.15;

      if (ambientRef.current) {
        ambientRef.current.style.transform = `translate(${currentX - 150}px, ${currentY - 150}px)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;

      const el = e.target as HTMLElement;
      const glowEl = el.closest('[data-glow]') as HTMLElement | null;

      if (glowEl) {
        const rect = glowEl.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;

        glowEl.style.setProperty('--mouse-x', `${localX}px`);
        glowEl.style.setProperty('--mouse-y', `${localY}px`);
        glowEl.style.setProperty('--glow-strength', '1');

        // Compute brightness at specific points along each wall.
        // For each sample point, compute the Euclidean distance from
        // the cursor to that point, then map to 0-1 with a falloff.
        const maxDist = Math.sqrt(rect.width ** 2 + rect.height ** 2);

        const brightnessAt = (px: number, py: number) => {
          const dist = Math.sqrt((localX - px) ** 2 + (localY - py) ** 2);
          // Falloff: 1.0 at distance 0, ~0.15 at half-diagonal, 0 at full diagonal
          return Math.max(0, 1 - (dist / maxDist) * 1.3);
        };

        // Top wall: 5 sample points at 0%, 25%, 50%, 75%, 100% of width (y=0)
        glowEl.style.setProperty('--edge-top-0', brightnessAt(0, 0).toFixed(3));
        glowEl.style.setProperty('--edge-top-25', brightnessAt(rect.width * 0.25, 0).toFixed(3));
        glowEl.style.setProperty('--edge-top-50', brightnessAt(rect.width * 0.5, 0).toFixed(3));
        glowEl.style.setProperty('--edge-top-75', brightnessAt(rect.width * 0.75, 0).toFixed(3));
        glowEl.style.setProperty('--edge-top-100', brightnessAt(rect.width, 0).toFixed(3));

        // Bottom wall: 5 sample points (y = height)
        glowEl.style.setProperty('--edge-bottom-0', brightnessAt(0, rect.height).toFixed(3));
        glowEl.style.setProperty('--edge-bottom-25', brightnessAt(rect.width * 0.25, rect.height).toFixed(3));
        glowEl.style.setProperty('--edge-bottom-50', brightnessAt(rect.width * 0.5, rect.height).toFixed(3));
        glowEl.style.setProperty('--edge-bottom-75', brightnessAt(rect.width * 0.75, rect.height).toFixed(3));
        glowEl.style.setProperty('--edge-bottom-100', brightnessAt(rect.width, rect.height).toFixed(3));

        // Left wall: 4 sample points at 0%, 33%, 66%, 100% of height (x=0)
        glowEl.style.setProperty('--edge-left-0', brightnessAt(0, 0).toFixed(3));
        glowEl.style.setProperty('--edge-left-33', brightnessAt(0, rect.height * 0.33).toFixed(3));
        glowEl.style.setProperty('--edge-left-66', brightnessAt(0, rect.height * 0.66).toFixed(3));
        glowEl.style.setProperty('--edge-left-100', brightnessAt(0, rect.height).toFixed(3));

        // Right wall: 4 sample points (x = width)
        glowEl.style.setProperty('--edge-right-0', brightnessAt(rect.width, 0).toFixed(3));
        glowEl.style.setProperty('--edge-right-33', brightnessAt(rect.width, rect.height * 0.33).toFixed(3));
        glowEl.style.setProperty('--edge-right-66', brightnessAt(rect.width, rect.height * 0.66).toFixed(3));
        glowEl.style.setProperty('--edge-right-100', brightnessAt(rect.width, rect.height).toFixed(3));
      }

      // Fade out cards we've left
      document.querySelectorAll('[data-glow]').forEach((el) => {
        if (el !== glowEl) {
          const e = el as HTMLElement;
          e.style.setProperty('--glow-strength', '0');
          ['--edge-top-0','--edge-top-25','--edge-top-50','--edge-top-75','--edge-top-100',
           '--edge-bottom-0','--edge-bottom-25','--edge-bottom-50','--edge-bottom-75','--edge-bottom-100',
           '--edge-left-0','--edge-left-33','--edge-left-66','--edge-left-100',
           '--edge-right-0','--edge-right-33','--edge-right-66','--edge-right-100'
          ].forEach(v => e.style.setProperty(v, '0'));
        }
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={ambientRef}
      className="pointer-events-none fixed left-0 top-0 z-0 h-[300px] w-[300px] rounded-full hidden md:block"
      style={{
        background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, rgba(245,158,11,0.02) 40%, transparent 65%)',
        willChange: 'transform',
        filter: 'blur(12px)',
      }}
      aria-hidden="true"
    />
  );
}
