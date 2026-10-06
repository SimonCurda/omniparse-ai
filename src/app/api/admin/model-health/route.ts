import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendAlertEmail } from '@/lib/email-alert';

// ─── Admin Model Health ──────────────────────────────────────────────────────
// Read-only dashboard data + manual re-trigger of the health check.
//
// GET /api/admin/model-health?key=CRON_SECRET
//   Returns: { latest: [...], deprecations: [...], alertHistory: [...] }
//   - latest:        the most-recent ModelHealthLog row per (provider, model)
//   - deprecations:  latest rows whose status is 'decommissioned'
//   - alertHistory:  recent rows whose status differs from the previous row
//                    (i.e. transitions that triggered an email alert)
//
// POST /api/admin/model-health?key=CRON_SECRET
//   Triggers a manual sweep. Implementation reuses the same logic as the cron
//   endpoint by issuing an internal GET to /api/admin/model-health-check with
//   the same CRON_SECRET. We do the round-trip rather than refactoring the
//   sweep into a shared module so the cron endpoint stays a single self-
//   contained file (easier to audit). The round-trip is cheap relative to the
//   API calls it triggers (~9 model probes).

function authenticate(req: NextRequest): boolean {
  const key = new URL(req.url).searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return !!key && key === cronSecret;
}

const KNOWN_MODELS: Array<{ provider: string; modelName: string }> = [
  { provider: 'mistral', modelName: 'pixtral-12b-latest' },
  { provider: 'mistral', modelName: 'pixtral-large-latest' },
  { provider: 'mistral', modelName: 'mistral-small-latest' },
  { provider: 'mistral', modelName: 'mistral-medium-latest' },
  { provider: 'mistral', modelName: 'mistral-large-latest' },
  { provider: 'groq', modelName: 'openai/gpt-oss-20b' },
  { provider: 'groq', modelName: 'openai/gpt-oss-120b' },
  { provider: 'groq', modelName: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  { provider: 'groq', modelName: 'gemma2-9b-it' },
];

async function latestRow(provider: string, modelName: string) {
  const rows = await db.modelHealthLog.findMany({
    where: { provider, modelName },
    orderBy: { checkedAt: 'desc' },
    take: 1,
  });
  return rows[0] ?? null;
}

// GET /api/admin/model-health?key=CRON_SECRET
export async function GET(req: NextRequest) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Latest row per model — we loop over the known list rather than doing a
    // `groupBy` so we get a stable, complete response even for models that
    // have never been probed (in which case `latest` is null for that model).
    const latest: Array<Record<string, unknown>> = [];
    for (const m of KNOWN_MODELS) {
      const row = await latestRow(m.provider, m.modelName);
      latest.push({
        provider: m.provider,
        modelName: m.modelName,
        status: row?.status ?? 'unknown',
        statusCode: row?.statusCode ?? null,
        responseTimeMs: row?.responseTimeMs ?? null,
        notes: row?.notes ?? null,
        checkedAt: row?.checkedAt ?? null,
      });
    }

    // Deprecations: latest rows with status='decommissioned'. These are the
    // models we should remove from the cascade.
    const deprecations = latest.filter((r) => r.status === 'decommissioned');

    // Alert history: recent transitions. We pull the last 30 days and compare
    // each row to its predecessor — a transition is any row whose status
    // differs from the immediately-previous row for the same model.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recent = await db.modelHealthLog.findMany({
      where: { checkedAt: { gte: since } },
      orderBy: { checkedAt: 'desc' },
      take: 500,
    });

    // Group by provider+modelName, then walk newest→oldest comparing each pair.
    const byModel = new Map<string, typeof recent>();
    for (const row of recent) {
      const k = `${row.provider}|${row.modelName}`;
      if (!byModel.has(k)) byModel.set(k, []);
      byModel.get(k)!.push(row); // already in desc order
    }

    const alertHistory: Array<Record<string, unknown>> = [];
    for (const [, rows] of byModel) {
      for (let i = 0; i < rows.length - 1; i++) {
        const cur = rows[i];
        const prev = rows[i + 1];
        if (cur.status !== prev.status) {
          alertHistory.push({
            provider: cur.provider,
            modelName: cur.modelName,
            fromStatus: prev.status,
            toStatus: cur.status,
            checkedAt: cur.checkedAt,
            statusCode: cur.statusCode,
          });
        }
      }
    }
    alertHistory.sort(
      (a, b) =>
        new Date(b.checkedAt as string).getTime() -
        new Date(a.checkedAt as string).getTime(),
    );

    return NextResponse.json({
      latest,
      deprecations,
      alertHistory: alertHistory.slice(0, 50),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/admin/model-health?key=CRON_SECRET — trigger a manual sweep now.
//
// We call the cron endpoint directly with the same secret. This keeps the
// probe logic in exactly one place (/api/admin/model-health-check/route.ts)
// and avoids drift between two implementations.
export async function POST(req: NextRequest) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cronSecret = process.env.CRON_SECRET!;
    const origin = new URL(req.url).origin;
    // Internal request — uses the same host + the same key. We hit the GET
    // endpoint (the cron entrypoint) rather than duplicating the logic.
    const res = await fetch(
      `${origin}/api/admin/model-health-check?key=${encodeURIComponent(cronSecret)}`,
      {
        method: 'GET',
        // Don't forward the inbound Authorization header — the cron endpoint
        // only cares about ?key=CRON_SECRET.
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(120_000),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // Surface a clear error to the admin.
      await sendAlertEmail(
        'Manual model health check failed',
        `Manual sweep returned HTTP ${res.status}.\n\n${text.slice(0, 500)}`,
      ).catch(() => {});
      return NextResponse.json(
        { error: `Health check failed (HTTP ${res.status}).`, detail: text.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({
      triggered: true,
      result: data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
