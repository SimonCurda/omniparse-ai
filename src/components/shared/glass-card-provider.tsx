'use client';

import { useEffect } from 'react';

/**
 * Lightweight glass-card mouse tracker for dashboard/auth pages.
 * Tracks mouse position and updates --mouse-x/--mouse-y + data-glow-active
 * on any [data-glow] element. No ambient glow (that's landing-only).
 */
export function GlassCardProvider() {
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const handleMouseMove = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      const glowEl = el.closest('[data-glow]') as HTMLElement | null;

      if (glowEl) {
        const rect = glowEl.getBoundingClientRect();
        glowEl.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        glowEl.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
        glowEl.setAttribute('data-glow-active', '');
      }

      document.querySelectorAll('[data-glow][data-glow-active]').forEach((el) => {
        if (el !== glowEl) {
          (el as HTMLElement).removeAttribute('data-glow-active');
        }
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return null;
}
