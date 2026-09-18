'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Cookie, X, Settings2 } from 'lucide-react';

const CONSENT_KEY = 'omniparse_cookie_consent';

/**
 * Categories per Cookie Policy §2:
 * - essential: always on, exempt from consent (ePrivacy Art. 5(3))
 * - theme: light/dark mode preference
 * - shortcuts: custom keyboard shortcuts
 * - legalConsent: GDPR data-transfer consent record for uploads
 * - crashLog: client-side error logging
 * - analytics: reserved for future analytics provider (currently no-op)
 *
 * EDPB Guidelines 03/2022 on dark patterns:
 * - "Accept all" and "Essential only" are equally prominent (no pre-ticked boxes)
 * - Granular per-category toggles available via "Manage preferences"
 * - Consent is as easy to withdraw as to give (footer "Cookie Settings" link)
 */
type ConsentRecord = {
  essential: true; // always true (cannot be disabled)
  theme: boolean;
  shortcuts: boolean;
  legalConsent: boolean;
  crashLog: boolean;
  analytics: boolean;
  date: string; // ISO timestamp of last update
  version: number; // schema version for future migrations
};

const CURRENT_VERSION = 1;

const DEFAULT_PREFERENCES: Omit<ConsentRecord, 'date' | 'version'> = {
  essential: true,
  theme: false,
  shortcuts: false,
  legalConsent: false,
  crashLog: false,
  analytics: false,
};

const ACCEPT_ALL: Omit<ConsentRecord, 'date' | 'version'> = {
  essential: true,
  theme: true,
  shortcuts: true,
  legalConsent: true,
  crashLog: true,
  analytics: false, // analytics not currently active; will require separate opt-in when launched
};

function loadConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== CURRENT_VERSION) {
      // Schema changed — re-prompt
      return null;
    }
    return parsed as ConsentRecord;
  } catch {
    return null;
  }
}

function saveConsent(prefs: Omit<ConsentRecord, 'date' | 'version'>): ConsentRecord {
  const record: ConsentRecord = { ...prefs, date: new Date().toISOString(), version: CURRENT_VERSION };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  } catch {}
  // Apply non-essential storage: clear items the user has NOT consented to
  applyConsentToStorage(record);
  return record;
}

/**
 * Apply the user's consent decision to existing localStorage items.
 * If a category was previously consented but is now declined, clear the
 * corresponding localStorage keys (per EDPB Guidelines 03/2022 §3.3.2 —
 * "withdrawal must have the same effect as not giving consent in the first place").
 */
function applyConsentToStorage(record: ConsentRecord) {
  try {
    if (!record.theme) localStorage.removeItem('theme');
    if (!record.shortcuts) localStorage.removeItem('op_shortcuts');
    if (!record.legalConsent) localStorage.removeItem('op_legal_consent');
    if (!record.crashLog) localStorage.removeItem('op_crash_log');
  } catch {}
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_PREFERENCES);

  useEffect(() => {
    const saved = loadConsent();
    if (!saved) {
      setVisible(true);
    }
  }, []);

  const acceptAll = () => {
    saveConsent(ACCEPT_ALL);
    setVisible(false);
  };

  const rejectOptional = () => {
    saveConsent(DEFAULT_PREFERENCES);
    setVisible(false);
  };

  const savePreferences = () => {
    saveConsent(prefs);
    setVisible(false);
    setShowPrefs(false);
  };

  const openPrefs = () => {
    // Pre-populate with any existing consent (so users can edit rather than start fresh)
    const existing = loadConsent();
    setPrefs(existing ? { ...DEFAULT_PREFERENCES, ...existing } : DEFAULT_PREFERENCES);
    setShowPrefs(true);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[90] p-4 animate-in slide-in-from-bottom duration-300"
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
    >
      <div className="max-w-3xl mx-auto bg-card border border-border rounded-xl p-4 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Cookie className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground flex-1">
            We use local storage for your preferences and authentication. No tracking cookies
            are active by default. See our{' '}
            <Link
              href="/cookie-policy"
              className="text-amber-600 hover:underline font-medium"
              target="_blank"
              rel="noopener"
            >
              Cookie Policy
            </Link>{' '}
            for details.
          </p>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button variant="outline" size="sm" onClick={openPrefs}>
              <Settings2 className="h-3.5 w-3.5 mr-1" />
              Manage preferences
            </Button>
            <Button variant="outline" size="sm" onClick={rejectOptional}>
              Essential only
            </Button>
            <Button size="sm" onClick={acceptAll}>
              Accept all
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 absolute top-2 right-2 sm:hidden"
            onClick={rejectOptional}
            aria-label="Dismiss cookie banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {showPrefs && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <h3 className="text-sm font-semibold">Cookie preferences</h3>
            <p className="text-xs text-muted-foreground">
              Toggle each category on or off. Essential storage is always on (required for the
              service to function — ePrivacy Art. 5(3) exception).
            </p>

            <div className="space-y-3">
              <ConsentToggle
                label="Essential (required)"
                description="Authentication token, cookie consent record. Always on — required for the Service to function."
                checked
                disabled
              />
              <ConsentToggle
                label="Theme preference"
                description="Stores your light/dark mode choice."
                checked={prefs.theme}
                onCheckedChange={(v) => setPrefs({ ...prefs, theme: v })}
              />
              <ConsentToggle
                label="Keyboard shortcuts"
                description="Stores your custom keyboard shortcut assignments."
                checked={prefs.shortcuts}
                onCheckedChange={(v) => setPrefs({ ...prefs, shortcuts: v })}
              />
              <ConsentToggle
                label="Legal consent record"
                description="Records your GDPR data-transfer consent for document uploads."
                checked={prefs.legalConsent}
                onCheckedChange={(v) => setPrefs({ ...prefs, legalConsent: v })}
              />
              <ConsentToggle
                label="Crash logs"
                description="Stores recent client-side errors for debugging. No personal data logged."
                checked={prefs.crashLog}
                onCheckedChange={(v) => setPrefs({ ...prefs, crashLog: v })}
              />
              <ConsentToggle
                label="Analytics (planned)"
                description="Currently no analytics is active. Will require separate consent when launched."
                checked={prefs.analytics}
                onCheckedChange={(v) => setPrefs({ ...prefs, analytics: v })}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={rejectOptional}>
                Reject all optional
              </Button>
              <Button size="sm" onClick={savePreferences}>
                Save my preferences
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConsentToggle({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-2 rounded hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} className="mt-0.5" />
    </div>
  );
}

/**
 * Read the current consent state from anywhere in the app.
 * Returns null if no consent has been given yet (in which case the banner will appear).
 */
export function getConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') return null;
  return loadConsent();
}

/**
 * Check if a specific non-essential category has been consented to.
 * Always returns true for 'essential' (always on, regardless of consent state).
 */
export function hasConsent(category: 'essential' | 'theme' | 'shortcuts' | 'legalConsent' | 'crashLog' | 'analytics'): boolean {
  if (category === 'essential') return true;
  const consent = getConsent();
  if (!consent) return false;
  return consent[category] === true;
}
