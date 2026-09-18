// ============================================================================
// Client-side crash logger — persists to localStorage so errors survive page reloads
// ============================================================================

type LogEntry = {
  timestamp: string;
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  extra?: Record<string, unknown>;
};

const STORAGE_KEY = 'op_crash_log';
const MAX_ENTRIES = 50;

function getLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLogs(logs: LogEntry[]) {
  try {
    // Keep only last MAX_ENTRIES
    const trimmed = logs.slice(-MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full — clear old logs
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }
}

export function logCrash(error: Error, errorInfo?: { componentStack?: string }, extra?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo?.componentStack,
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    extra,
  };
  const logs = getLogs();
  logs.push(entry);
  saveLogs(logs);
}

export function logInfo(message: string, extra?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    message,
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    extra,
  };
  const logs = getLogs();
  logs.push(entry);
  saveLogs(logs);
}

export function getCrashLogs(): LogEntry[] {
  return getLogs();
}

export function clearCrashLogs() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

/** Initialize global error handlers (call once in app root) */
export function initCrashLogger() {
  if (typeof window === 'undefined') return;

  // Catch unhandled React errors
  window.addEventListener('error', (event) => {
    logCrash(
      new Error(event.message || 'Unhandled error'),
      undefined,
      { filename: event.filename, lineno: event.lineno, colno: event.colno },
    );
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const err = event.reason;
    const message = err instanceof Error ? err.message : String(err);
    logCrash(new Error(`Unhandled rejection: ${message}`), undefined, {
      reason: err instanceof Error ? err.stack : String(err),
    });
  });

  // Check for previous crash on load
  const logs = getLogs();
  const recentCrash = logs.length > 0
    ? logs[logs.length - 1]
    : null;

  if (recentCrash && recentCrash.stack) {
    const age = Date.now() - new Date(recentCrash.timestamp).getTime();
    if (age < 60_000) { // Within last minute = likely the crash that caused reload
      console.warn('[CrashLogger] Previous crash detected:', recentCrash.message);
      console.warn('[CrashLogger] Stack:', recentCrash.stack);
      console.warn('[CrashLogger] Component stack:', recentCrash.componentStack);
      console.warn('[CrashLogger] All logs:', JSON.stringify(logs, null, 2));
    }
  }
}
