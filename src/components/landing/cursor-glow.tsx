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

        // Corner proximity: compute distance from cursor to the nearest corner.
        // The closer the cursor is to a corner, the brighter --corner-glow gets.
        const corners = [
          { x: 0, y: 0 },           // top-left
          { x: rect.width, y: 0 },   // top-right
          { x: 0, y: rect.height },  // bottom-left
          { x: rect.width, y: rect.height }, // bottom-right
        ];

        // Find distance to nearest corner
        let minDist = Infinity;
        for (const c of corners) {
          const dist = Math.sqrt((localX - c.x) ** 2 + (localY - c.y) ** 2);
          if (dist < minDist) minDist = dist;
        }

        // Map distance to 0-1 range. When cursor is right at a corner (dist=0),
        // corner-glow = 1 (max brightness). When cursor is in the opposite
        // corner (dist = diagonal), corner-glow = 0.
        const diagonal = Math.sqrt(rect.width ** 2 + rect.height ** 2);
        const cornerGlow = Math.max(0, 1 - (minDist / diagonal) * 1.5);
        glowEl.style.setProperty('--corner-glow', cornerGlow.toFixed(3));
      }

      // Fade out cards we've left
      document.querySelectorAll('[data-glow]').forEach((el) => {
        if (el !== glowEl) {
          (el as HTMLElement).style.setProperty('--glow-strength', '0');
          (el as HTMLElement).style.setProperty('--corner-glow', '0');
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
