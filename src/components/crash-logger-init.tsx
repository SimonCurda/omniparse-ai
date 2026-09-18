'use client';

import { useEffect } from 'react';
import { initCrashLogger } from '@/lib/crash-logger';

export function CrashLoggerInit() {
  useEffect(() => {
    initCrashLogger();
  }, []);
  return null;
}
