// Shared keyboard shortcuts configuration

export const DEFAULT_SHORTCUTS: Record<string, string> = {
  search: 'Ctrl+K',
  altSearch: '/',
  tabUpload: 'u',
  tabInvoices: 'i',
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
