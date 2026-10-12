import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  ALL_KNOWN_FLAGS,
  FEATURE_FLAG_DEFAULTS,
  invalidateFeatureFlagCache,
} from '@/lib/feature-flags';

// ─── Admin Feature Flag endpoints ────────────────────────────────────────────
// Auth via CRON_SECRET query param — same model as /api/admin/providers. The
// admin panel passes ?key=CRON_SECRET.
//
// GET  — returns every known flag with its current DB state, default value,
//        and metadata (label, description) for rendering the admin UI.
// PUT  — toggles a single flag. Body: { flag: string, enabled: boolean }.
//        After the upsert the in-memory cache is invalidated so the next
//        reader sees the new value within the TTL window.

async function authenticate(req: NextRequest): Promise<boolean> {
  const key = new URL(req.url).searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false; // Not configured → deny
  return !!key && key === cronSecret;
}

// GET /api/admin/feature-flags?key=CRON_SECRET
export async function GET(req: NextRequest) {
  const isAuthed = await authenticate(req);
  if (!isAuthed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await db.featureFlag.findMany();
    const dbMap = new Map(rows.map((r) => [r.flag, r]));

    const flags = ALL_KNOWN_FLAGS.map((meta) => {
      const dbRow = dbMap.get(meta.flag);
      return {
        flag: meta.flag,
        label: meta.label,
        description: meta.description,
        defaultEnabled: meta.defaultEnabled,
        dbEnabled: dbRow ? dbRow.enabled : meta.defaultEnabled,
        // If a DB row exists, its `enabled` value wins. Otherwise fall back to
        // the code-level default. This matches the semantics of
        // getAllFeatureFlags() in src/lib/feature-flags.ts.
        effectiveEnabled: dbRow ? dbRow.enabled : meta.defaultEnabled,
        inDb: !!dbRow,
        updatedAt: dbRow?.updatedAt ?? null,
        updatedBy: dbRow?.updatedBy ?? null,
      };
    });

    return NextResponse.json({ flags });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/admin/feature-flags?key=CRON_SECRET
// Body: { flag: string, enabled: boolean }
export async function PUT(req: NextRequest) {
  const isAuthed = await authenticate(req);
  if (!isAuthed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { flag, enabled } = body as { flag?: unknown; enabled?: unknown };
    if (typeof flag !== 'string' || !flag) {
      return NextResponse.json({ error: 'flag (string) is required.' }, { status: 400 });
    }
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled (boolean) is required.' }, { status: 400 });
    }

    // Reject unknown flags outright — writing a row for an unknown flag would
    // silently mask the code-level default and confuse future readers.
    const known = ALL_KNOWN_FLAGS.find((f) => f.flag === flag);
    if (!known) {
      const valid = ALL_KNOWN_FLAGS.map((f) => f.flag).join(', ');
      return NextResponse.json(
        { error: `Unknown flag "${flag}". Valid: ${valid}` },
        { status: 400 },
      );
    }

    const updated = await db.featureFlag.upsert({
      where: { flag },
      update: { enabled, updatedBy: 'admin' },
      create: { flag, enabled, updatedBy: 'admin' },
    });

    // Bust the in-memory cache so the change is visible immediately rather
    // than after the 30s TTL in src/lib/feature-flags.ts.
    invalidateFeatureFlagCache();

    console.warn(`[admin/feature-flags] ${flag} = ${enabled}`);

    return NextResponse.json({
      flag: updated.flag,
      enabled: updated.enabled,
      updatedAt: updated.updatedAt,
      updatedBy: updated.updatedBy,
      defaultEnabled: known.defaultEnabled,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Re-export the default map for any external reader that wants the same
// source of truth (not strictly required, but keeps this module the canonical
// entrypoint for flag inspection from the admin side).
export { FEATURE_FLAG_DEFAULTS };
