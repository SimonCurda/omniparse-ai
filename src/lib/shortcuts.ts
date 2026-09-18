// Shared keyboard shortcuts configuration
//
// Default keys are chosen so they don't conflict:
//   u = Upload         i = Invoices       p = Pending
//   v = Validation     o = apprOvals      a = Analytics
//   c = Chat           s = Settings
//
// Validation + Approvals are gated by plan (Pro / Plus). If the user's
// plan doesn't include a tab, pressing its shortcut is a no-op (handled
// in dashboard-shell.tsx).
export const DEFAULT_SHORTCUTS: Record<string, string> = {
  search: 'Ctrl+K',
  altSearch: '/',
  tabUpload: 'u',
  tabInvoices: 'i',
  tabPending: 'p',
  tabValidation: 'v',
  tabApprovals: 'o',
  tabAnalytics: 'a',
  tabChat: 'c',
  tabSettings: 's',
};

export function loadShortcuts(): Record<string, string> {
  try {
    const saved = localStorage.getItem('op_shortcuts');
    if (saved) return { ...DEFAULT_SHORTCUTS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_SHORTCUTS;
}

export function saveShortcuts(shortcuts: Record<string, string>) {
  try { localStorage.setItem('op_shortcuts', JSON.stringify(shortcuts)); } catch {}
}
