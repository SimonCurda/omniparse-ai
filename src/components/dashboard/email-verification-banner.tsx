'use client';

import { useState } from 'react';
import { MailCheck, RefreshCw, X, ExternalLink } from 'lucide-react';
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
 * Dev mode: if EMAIL_DEV_MODE=true (or email couldn't be sent), the resend
 * endpoint returns a verificationUrl that we display here as a clickable
 * link. This is a fallback for when Resend can't send (e.g., free tier
 * without custom domain verification).
 */
export function EmailVerificationBanner({ userEmail }: EmailVerificationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [manualVerifyUrl, setManualVerifyUrl] = useState<string | null>(null);

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
      if (data.emailSent) {
        toast.success(data.message || 'Verification email sent.');
        setManualVerifyUrl(null);
      } else if (data.verificationUrl) {
        // Dev mode — show the manual link
        setManualVerifyUrl(data.verificationUrl);
        toast.info('Could not send email. Use the manual verification link below.');
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
    <div className="bg-amber-500/10 border-b border-amber-500/30">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-start gap-2.5">
        <MailCheck className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <span className="text-amber-600 font-semibold">Email verification required.</span>{' '}
            AI features (upload, scan, chat) are blocked until you verify{' '}
            <span className="font-medium">{userEmail}</span>. Check your inbox for the verification link.
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 underline underline-offset-2 disabled:opacity-50"
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

          {manualVerifyUrl && (
            <div className="mt-2 p-2 bg-amber-500/10 rounded border border-amber-500/20">
              <p className="text-[11px] text-muted-foreground mb-1">
                Email delivery failed (Resend free tier can only send to your own Resend account email).
                Use this link to verify manually:
              </p>
              <a
                href={manualVerifyUrl}
                className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 underline underline-offset-2 break-all"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                {manualVerifyUrl.length > 60 ? manualVerifyUrl.substring(0, 60) + '...' : manualVerifyUrl}
              </a>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss notice"
          className="shrink-0 p-1 rounded hover:bg-amber-500/20 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-amber-600" />
        </button>
      </div>
    </div>
  );
}
