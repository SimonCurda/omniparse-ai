'use client';

// ─── Theme toggle ───────────────────────────────────────────────────────────
//
// Light/dark mode switch for the admin panel. Wired to next-themes, which is
// already set up in src/app/layout.tsx (<ThemeProvider attribute="class"
// defaultTheme="system" enableSystem>). Clicking flips between explicit
// `light` and `dark` (overriding the system default for that session).
//
// The button style mirrors the existing header buttons (e.g. "Refresh") so it
// sits naturally next to them. A stable placeholder is rendered until mount to
// avoid a hydration mismatch — next-themes can't know the resolved theme on the
// server, so reading it before mount would produce markup that differs from
// the SSR output.

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Stable placeholder pre-mount — prevents layout shift / hydration warning.
  if (!mounted) {
    return (
      <div
        className="h-[26px] w-[68px] rounded-lg border border-border"
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted/50 transition-colors"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
      <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
