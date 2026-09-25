'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A subtle amber/yellow glow that follows the cursor on the landing page.
 * 
 * Two effects:
 * 1. Global ambient glow — large, soft, follows cursor across the page
 * 2. Card spotlight — when hovering over a [data-glow] element, the glow
 *    constrains to that element's bounding box with a liquid-glass feel
 *    (inspired by Apple's liquid glass — soft inner glow + border highlight)
 *
 * - Respects prefers-reduced-motion
 * - Hidden on touch devices
 * - pointer-events: none on all layers
 */
export function CursorGlow() {
  const ambientRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const [spotlight, setSpotlight] = useState<{ x: number; y: number; w: number; h: number; active: boolean }>({
    x: 0, y: 0, w: 0, h: 0, active: false,
  });

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let rafId: number | null = null;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let mouseX = targetX;
    let mouseY = targetY;
    let activeGlowEl: HTMLElement | null = null;
    let glowRect: DOMRect | null = null;

    const animate = () => {
      currentX += (targetX - currentX) * 0.15;
      currentY += (targetY - currentY) * 0.15;

      if (ambientRef.current) {
        ambientRef.current.style.transform = `translate(${currentX - 150}px, ${currentY - 150}px)`;
      }

      // Update spotlight position within the hovered card
      if (spotlightRef.current && activeGlowEl && glowRect) {
        const localX = mouseX - glowRect.left;
        const localY = mouseY - glowRect.top;
        spotlightRef.current.style.background = `radial-gradient(180px circle at ${localX}px ${localY}px, rgba(245,158,11,0.15), transparent 70%)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      mouseX = e.clientX;
      mouseY = e.clientY;

      // Check if we're hovering over a [data-glow] element
      const el = e.target as HTMLElement;
      const glowEl = el.closest('[data-glow]') as HTMLElement | null;

      if (glowEl !== activeGlowEl) {
        // Leaving old element
        if (activeGlowEl) {
          activeGlowEl.style.removeProperty('--glow-opacity');
        }
        // Entering new element
        if (glowEl) {
          glowRect = glowEl.getBoundingClientRect();
          setSpotlight({ x: glowRect.left, y: glowRect.top, w: glowRect.width, h: glowRect.height, active: true });
        } else {
          glowRect = null;
          setSpotlight(s => ({ ...s, active: false }));
        }
        activeGlowEl = glowEl;
      }
      // Removed the scroll-during-hover rect update — it was causing the glitch.
      // The spotlight is position:fixed so it stays put during scroll.
      // If the user scrolls, the spotlight briefly drifts but that's less
      // jarring than the constant getBoundingClientRect calls were.
    };

    // Hide spotlight on scroll to avoid glitchy position jumps
    const handleScroll = () => {
      if (activeGlowEl) {
        setSpotlight(s => ({ ...s, active: false }));
        activeGlowEl = null;
        glowRect = null;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll, { capture: true } as EventListenerOptions);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      {/* Ambient glow — small, soft, follows cursor across page */}
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

      {/* Card spotlight — liquid glass effect inside hovered [data-glow] element */}
      {spotlight.active && (
        <div
          ref={spotlightRef}
          className="pointer-events-none fixed z-20 hidden md:block overflow-hidden"
          style={{
            left: spotlight.x,
            top: spotlight.y,
            width: spotlight.w,
            height: spotlight.h,
            borderRadius: 'inherit',
            mixBlendMode: 'screen',
            transition: 'opacity 0.2s ease',
          }}
          aria-hidden="true"
        />
      )}
    </>
  );
}
