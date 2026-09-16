'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { logCrash, getCrashLogs, clearCrashLogs } from '@/lib/crash-logger';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; lastError: Error | null; errorInfo: React.ErrorInfo | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, lastError: null, errorInfo: null };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    logCrash(error, { componentStack: errorInfo.componentStack ?? undefined });
    this.setState({ lastError: error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, lastError: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.lastError} errorInfo={this.state.errorInfo} onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, errorInfo, onReset }: {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  onReset: () => void;
}) {
  const router = useRouter();
  const [showLog, setShowLog] = React.useState(false);
  const logs = React.useMemo(() => getCrashLogs().slice(-5).reverse(), []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 px-6 text-center max-w-2xl w-full">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive">
          <span className="text-2xl font-bold text-destructive-foreground">!</span>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Something went wrong
          </h1>
          <p className="text-muted-foreground max-w-md">
            {error?.message || 'An unexpected error occurred.'}
          </p>
        </div>

        {/* Crash log toggle */}
        <button
          onClick={() => setShowLog(!showLog)}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          {showLog ? 'Hide' : 'Show'} crash log ({logs.length} entries)
        </button>

        {showLog && (
          <div className="w-full rounded-lg border bg-muted/50 p-4 text-left max-h-60 overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-muted-foreground">Recent crash logs</span>
              <button
                onClick={() => { clearCrashLogs(); setShowLog(false); }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Clear all
              </button>
            </div>
            {logs.map((log, i) => (
              <div key={i} className="mb-3 last:mb-0 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                <div className="text-[10px] text-muted-foreground font-mono">{log.timestamp}</div>
                <div className="text-xs text-red-500 font-medium mt-0.5 break-all">{log.message}</div>
                {log.componentStack && (
                  <pre className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap break-all max-h-20 overflow-y-auto">
                    {log.componentStack}
                  </pre>
                )}
                {log.stack && !log.componentStack && (
                  <pre className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap break-all max-h-20 overflow-y-auto">
                    {log.stack}
                  </pre>
                )}
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-xs text-muted-foreground">No crash logs found.</p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Refresh Page
          </button>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
