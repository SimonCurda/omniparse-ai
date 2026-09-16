'use client';

import { useState } from 'react';
import { MailCheck, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

interface EmailVerificationBannerProps {
  userEmail: string;
}

/**
 * Persistent banner shown in the dashboard when the user's email is not yet verified.
 *
 * Shown when:
 *   - User.emailVerifiedRequired === true (set by /api/auth/me)
 *
 * Hides itself automatically when the user clicks the verification link
 * (because /api/auth/me is re-fetched and emailVerifiedRequired becomes false).
 *
 * Includes a "Resend verification email" button that calls
 * POST /api/auth/resend-verification. Rate limited server-side to 3/hour.
 *
 * Dismissable per-session — user can hide it for the current session but
 * it returns next time they log in if email is still not verified.
 */
export function EmailVerificationBanner({ userEmail }: EmailVerificationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);

  // Don't render if dismissed this session
  if (dismissed) return null;

  const handleResend = async () => {
    setResending(true);
    const token = localStorage.getItem('op_token');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Verification email sent.');
      } else if (data.alreadyVerified) {
        toast.info('Your email is already verified.');
      } else {
        toast.error(data.error || 'Failed to resend verification email.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-start gap-2.5">
        <MailCheck className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-foreground leading-relaxed">
            <strong className="text-amber-700 dark:text-amber-500">Email verification required.</strong>{' '}
            AI features (upload, scan, chat) are blocked until you verify{' '}
            <span className="font-medium">{userEmail}</span>. Check your inbox for the verification link.
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-500 hover:text-amber-800 dark:hover:text-amber-400 underline underline-offset-2 disabled:opacity-50"
          >
            {resending ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3" />
                Resend verification email
              </>
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss notice"
          className="shrink-0 p-1 rounded hover:bg-amber-500/20 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-amber-700 dark:text-amber-500" />
        </button>
      </div>
    </div>
  );
}
