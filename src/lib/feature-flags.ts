import { db } from '@/lib/db';

export const FEATURE_FLAG_DEFAULTS: Record<string, boolean> = {
  show_cost_per_invoice: true,
  show_normalized_toggle: true,
};

let _flagCache: { data: Record<string, boolean> | null; timestamp: number } = {
  data: null, timestamp: 0,
};
const FLAG_CACHE_TTL_MS = 30_000;

export async function getAllFeatureFlags(): Promise<Record<string, boolean>> {
  if (_flagCache.data && Date.now() - _flagCache.timestamp < FLAG_CACHE_TTL_MS) return _flagCache.data;
  const result: Record<string, boolean> = { ...FEATURE_FLAG_DEFAULTS };
  try {
    const rows = await db.featureFlag.findMany();
    for (const row of rows) result[row.flag] = row.enabled;
  } catch {}
  _flagCache = { data: result, timestamp: Date.now() };
  return result;
}

export async function getFeatureFlag(flag: string): Promise<boolean> {
  const all = await getAllFeatureFlags();
  return all[flag] ?? FEATURE_FLAG_DEFAULTS[flag] ?? false;
}

export function invalidateFeatureFlagCache(): void {
  _flagCache = { data: null, timestamp: 0 };
}

export const ALL_KNOWN_FLAGS: Array<{ flag: string; label: string; description: string; defaultEnabled: boolean }> = [
  { flag: 'show_cost_per_invoice', label: 'Show "Cost Per Invoice" to users', description: 'When ON, the analytics tab shows the Cost Per Invoice metric. When OFF, hidden from users.', defaultEnabled: true },
  { flag: 'show_normalized_toggle', label: 'Show "Show Normalized" toggle on invoices tab', description: 'When ON, users see a "Show Normalized" toggle. When OFF, hidden.', defaultEnabled: true },
];
