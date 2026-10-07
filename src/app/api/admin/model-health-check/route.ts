import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendAlertEmail } from '@/lib/email-alert';

// ─── Admin Model Health Check (cron) ─────────────────────────────────────────
// GET /api/admin/model-health-check?key=CRON_SECRET
//
// Pings each configured AI model with a tiny "Respond with: OK" request and
// records the result in db.modelHealthLog. When the status of a model changes
// from the previous check (e.g. ok → rate_limited, ok → decommissioned), an
// email alert is sent via sendAlertEmail so we can react before users notice.
//
// Logs older than 30 days are pruned at the end of each run to keep the table
// small.
//
// Status values:
//   ok             — model responded successfully (HTTP 2xx)
//   rate_limited   — HTTP 429 from the provider
//   decommissioned — HTTP 404 / explicit "decommissioned" / "model not found"
//   error          — any other failure (5xx, network error, timeout, etc.)
//   new_model      — model exists in the provider's catalog but isn't in our
//                    ALL_MODELS list (candidate to add to the cascade)
//
// Mistral API key rotation: we try each configured key (MISTRAL_API_KEY,
// MISTRAL_API_KEY_2, MISTRAL_API_KEY_3) on 429 before declaring the model
// rate-limited. Groq has a single key.
//
// New-model detection: after probing the configured models, the sweep also
// fetches each provider's full model catalog (GET /v1/models) and surfaces any
// chat-capable models we're NOT yet using as status='new_model'. These are
// candidates for the cascade — the admin decides whether to add them. The
// detection is best-effort: any network/parse failure is logged and skipped so
// it can never abort the sweep.

type HealthStatus = 'ok' | 'decommissioned' | 'rate_limited' | 'error' | 'new_model';

interface ModelSpec {
  provider: 'mistral' | 'groq';
  modelName: string;
  /** True if the model is a vision model and should be sent image_url content. */
  vision?: boolean;
}

const MISTRAL_MODELS: ModelSpec[] = [
  { provider: 'mistral', modelName: 'pixtral-12b-latest', vision: true },
  { provider: 'mistral', modelName: 'mistral-small-latest' },
  // pixtral-large-latest: 400 'Invalid model' on free tier
  // mistral-medium-latest: 429 rate limited
  // mistral-large-latest: 403 paid tier only
];

const GROQ_MODELS: ModelSpec[] = [
  { provider: 'groq', modelName: 'openai/gpt-oss-20b' },
  { provider: 'groq', modelName: 'openai/gpt-oss-120b' },
  // meta-llama/llama-4-scout-17b-16e-instruct: 404 decommissioned
  // gemma2-9b-it: 400 decommissioned
];

const ALL_MODELS: ModelSpec[] = [...MISTRAL_MODELS, ...GROQ_MODELS];

const RETENTION_DAYS = 30;
const REQUEST_TIMEOUT_MS = 30_000;

// A 1×1 transparent PNG (base64). Used for vision-model health pings — we
// don't actually care about the pixels, we just need a valid image_url payload
// so the model doesn't 400 on a missing image.
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

function authenticate(req: NextRequest): boolean {
  const key = new URL(req.url).searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return !!key && key === cronSecret;
}

function getMistralKeys(): string[] {
  return [
    process.env.MISTRAL_API_KEY,
    process.env.MISTRAL_API_KEY_2,
    process.env.MISTRAL_API_KEY_3,
  ].filter((k): k is string => !!k);
}

function getGroqKey(): string | null {
  return process.env.GROQ_API_KEY ?? null;
}

/**
 * Build the OpenAI-compatible messages payload for a health ping. Vision
 * models get a tiny image attachment so they don't reject the request; text
 * models get a plain user message.
 */
function buildMessages(spec: ModelSpec): Array<Record<string, unknown>> {
  const userText = 'Respond with: OK';
  if (spec.vision) {
    return [
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: TINY_PNG_DATA_URL } },
        ],
      },
    ];
  }
  return [{ role: 'user', content: userText }];
}

interface CheckResult {
  status: HealthStatus;
  statusCode: number | null;
  responseTimeMs: number | null;
  notes?: string;
}

/**
 * Probe a single provider/model. Returns the observed status + timing.
 *
 * The function is defensive: any thrown error becomes a CheckResult with
 * status='error' rather than propagating, so one bad model can't abort the
 * whole sweep.
 */
async function probeModel(spec: ModelSpec): Promise<CheckResult> {
  const messages = buildMessages(spec);
  const body: Record<string, unknown> = {
    model: spec.modelName,
    messages,
    max_tokens: 8,
    temperature: 0,
  };

  const start = Date.now();

  if (spec.provider === 'mistral') {
    const keys = getMistralKeys();
    if (keys.length === 0) {
      return {
        status: 'error',
        statusCode: null,
        responseTimeMs: null,
        notes: 'No MISTRAL_API_KEY configured',
      };
    }

    let lastStatus = 0;
    let lastErrText = '';
    for (let i = 0; i < keys.length; i++) {
      try {
        const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${keys[i]}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        lastStatus = res.status;
        const elapsed = Date.now() - start;

        if (res.ok) {
          return { status: 'ok', statusCode: res.status, responseTimeMs: elapsed };
        }

        const errText = await res.text().catch(() => '');
        lastErrText = errText;

        if (res.status === 429) {
          // Try the next key before declaring rate-limited.
          continue;
        }
        if (res.status === 404) {
          return {
            status: 'decommissioned',
            statusCode: 404,
            responseTimeMs: elapsed,
            notes: errText.slice(0, 200),
          };
        }
        // Some providers return 400 with a "decommissioned" / "model not found"
        // message rather than a 404 — treat those as decommissioned too.
        const lower = errText.toLowerCase();
        if (
          lower.includes('decommissioned') ||
          lower.includes('deprecation') ||
          lower.includes('model not found') ||
          lower.includes('does not exist')
        ) {
          return {
            status: 'decommissioned',
            statusCode: res.status,
            responseTimeMs: elapsed,
            notes: errText.slice(0, 200),
          };
        }
        return {
          status: 'error',
          statusCode: res.status,
          responseTimeMs: elapsed,
          notes: errText.slice(0, 200),
        };
      } catch (err) {
        const elapsed = Date.now() - start;
        const msg = err instanceof Error ? err.message : String(err);
        // Network error / timeout — try next key anyway (the failure might be
        // transient and unrelated to the key, but we have no other signal).
        lastStatus = 0;
        lastErrText = msg;
        // If it was a timeout, don't burn another 30s on the next key.
        if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('abort')) {
          return {
            status: 'error',
            statusCode: null,
            responseTimeMs: elapsed,
            notes: `Timeout/error: ${msg.slice(0, 200)}`,
          };
        }
        continue;
      }
    }

    // All keys returned 429 (or we exhausted retries on transient errors).
    return {
      status: lastStatus === 429 ? 'rate_limited' : 'error',
      statusCode: lastStatus || null,
      responseTimeMs: Date.now() - start,
      notes: lastErrText.slice(0, 200) || 'All keys exhausted',
    };
  }

  // Groq
  const groqKey = getGroqKey();
  if (!groqKey) {
    return {
      status: 'error',
      statusCode: null,
      responseTimeMs: null,
      notes: 'No GROQ_API_KEY configured',
    };
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const elapsed = Date.now() - start;

    if (res.ok) {
      return { status: 'ok', statusCode: res.status, responseTimeMs: elapsed };
    }

    const errText = await res.text().catch(() => '');
    if (res.status === 429) {
      return {
        status: 'rate_limited',
        statusCode: 429,
        responseTimeMs: elapsed,
        notes: errText.slice(0, 200),
      };
    }
    if (res.status === 404) {
      return {
        status: 'decommissioned',
        statusCode: 404,
        responseTimeMs: elapsed,
        notes: errText.slice(0, 200),
      };
    }
    const lower = errText.toLowerCase();
    if (
      lower.includes('decommissioned') ||
      lower.includes('deprecation') ||
      lower.includes('model not found') ||
      lower.includes('does not exist') ||
      lower.includes('has been deprecated')
    ) {
      return {
        status: 'decommissioned',
        statusCode: res.status,
        responseTimeMs: elapsed,
        notes: errText.slice(0, 200),
      };
    }
    return {
      status: 'error',
      statusCode: res.status,
      responseTimeMs: elapsed,
      notes: errText.slice(0, 200),
    };
  } catch (err) {
    const elapsed = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      statusCode: null,
      responseTimeMs: elapsed,
      notes: `Network error: ${msg.slice(0, 200)}`,
    };
  }
}

/**
 * Fetch the most-recent ModelHealthLog row for a given provider+model so we
 * can detect status transitions. Returns null if there's no prior row.
 */
async function previousStatus(
  provider: string,
  modelName: string,
): Promise<{ status: string } | null> {
  const rows = await db.modelHealthLog.findMany({
    where: { provider, modelName },
    orderBy: { checkedAt: 'desc' },
    take: 1,
    select: { status: true },
  });
  return rows[0] ?? null;
}

/**
 * Fetch the full model catalog from a provider's /v1/models endpoint.
 *
 * Returns a deduplicated list of model IDs that are chat-capable (i.e.
 * plausible candidates for the cascade). Best-effort: any error returns an
 * empty array so the sweep never fails because of a catalog fetch.
 *
 *  - Mistral: filters on `capabilities.completion_chat === true` (the API
 *    exposes a capabilities object). Vision models like pixtral also set this,
 *    so they're included automatically.
 *  - Groq: the /models endpoint doesn't expose capabilities, so we exclude
 *    obvious non-chat families by name (whisper, guard, tts, embedding,
 *    moderation) and drop anything marked inactive.
 */
async function fetchAvailableModelIds(provider: 'mistral' | 'groq'): Promise<string[]> {
  try {
    if (provider === 'mistral') {
      const keys = getMistralKeys();
      if (keys.length === 0) return [];
      // The /models endpoint is read-only and not rate-limited the way chat
      // completions are, so the first key is enough.
      const res = await fetch('https://api.mistral.ai/v1/models', {
        method: 'GET',
        headers: { Authorization: `Bearer ${keys[0]}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return [];
      const data = (await res.json().catch(() => ({ data: [] }))) as {
        data?: Array<{ id?: string; capabilities?: { completion_chat?: boolean } }>;
      };
      const rows = Array.isArray(data?.data) ? data.data : [];
      return rows
        .filter((r) => r?.capabilities?.completion_chat === true && r.id)
        .map((r) => String(r.id));
    }

    // Groq
    const groqKey = getGroqKey();
    if (!groqKey) return [];
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${groqKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => ({ data: [] }))) as {
      data?: Array<{ id?: string; active?: boolean }>;
    };
    const rows = Array.isArray(data?.data) ? data.data : [];
    const EXCLUDE = /whisper|guard|tts|embed|moderation/i;
    return rows
      .filter((r) => r.active !== false && r.id && !EXCLUDE.test(r.id))
      .map((r) => String(r.id));
  } catch (err) {
    console.warn(`[model-health-check] Failed to fetch ${provider} model list:`, err);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const isAuthed = authenticate(req);
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Array<{
    provider: string;
    modelName: string;
    status: HealthStatus;
    statusCode: number | null;
    responseTimeMs: number | null;
    notes?: string;
    statusChanged: boolean;
  }> = [];

  const alerts: string[] = [];

  for (const spec of ALL_MODELS) {
    const result = await probeModel(spec);
    const prev = await previousStatus(spec.provider, spec.modelName);

    // Persist the row first so the historical record exists even if the
    // alert email fails to send.
    await db.modelHealthLog.create({
      data: {
        provider: spec.provider,
        modelName: spec.modelName,
        status: result.status,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        notes: result.notes ?? null,
      },
    });

    // Status transition detection — only alert on a real change. The very
    // first check (no prior row) is not treated as a transition (we don't
    // want a deploy-time flood of "model is ok" emails).
    const statusChanged = prev !== null && prev.status !== result.status;
    if (statusChanged) {
      const line =
        `${spec.provider}/${spec.modelName}: ${prev.status} → ${result.status}` +
        (result.statusCode ? ` (HTTP ${result.statusCode})` : '') +
        (result.notes ? ` — ${result.notes}` : '');
      alerts.push(line);
    }

    results.push({
      provider: spec.provider,
      modelName: spec.modelName,
      status: result.status,
      statusCode: result.statusCode,
      responseTimeMs: result.responseTimeMs,
      notes: result.notes,
      statusChanged,
    });
  }

  // --- New-model detection ---
  // Fetch each provider's full chat-capable catalog and surface any model we
  // aren't using yet as status='new_model'. These are candidates for the
  // cascade — the admin decides whether to add them. We cap the count per
  // provider to keep the results readable (some catalogs have 30+ entries,
  // most of which are irrelevant to invoice parsing).
  const NEW_MODEL_CAP_PER_PROVIDER = 15;
  const knownByProvider: Record<'mistral' | 'groq', Set<string>> = {
    mistral: new Set(MISTRAL_MODELS.map((m) => m.modelName)),
    groq: new Set(GROQ_MODELS.map((m) => m.modelName)),
  };

  const newModelSpecs: Array<{ provider: 'mistral' | 'groq'; modelName: string }> = [];
  for (const provider of ['mistral', 'groq'] as const) {
    const available = await fetchAvailableModelIds(provider);
    let added = 0;
    for (const id of available) {
      if (added >= NEW_MODEL_CAP_PER_PROVIDER) break;
      if (knownByProvider[provider].has(id)) continue;
      // Dedupe within this run (the catalog could in theory list a model twice).
      if (newModelSpecs.some((m) => m.provider === provider && m.modelName === id)) continue;
      newModelSpecs.push({ provider, modelName: id });
      added++;
    }
  }

  for (const spec of newModelSpecs) {
    const note =
      'New model available in provider catalog — candidate for the cascade. ' +
      'Probe manually before adding to MISTRAL_MODELS / GROQ_MODELS.';
    // Persist a row so the admin dashboard (which reads latest-by-model) can
    // surface it under the "new_model" status. A DB write failure here is
    // non-fatal — the result is still returned in the response payload.
    try {
      await db.modelHealthLog.create({
        data: {
          provider: spec.provider,
          modelName: spec.modelName,
          status: 'new_model',
          statusCode: null,
          responseTimeMs: null,
          notes: note,
        },
      });
    } catch (err) {
      console.warn(
        `[model-health-check] Failed to log new_model ${spec.provider}/${spec.modelName}:`,
        err,
      );
    }

    results.push({
      provider: spec.provider,
      modelName: spec.modelName,
      status: 'new_model',
      statusCode: null,
      responseTimeMs: null,
      notes: note,
      statusChanged: false,
    });
  }

  // Send a single digest email if anything transitioned. Batching keeps the
  // Resend send count low (free-tier cap is 100/day).
  if (alerts.length > 0) {
    const subject = `Model health: ${alerts.length} status change(s)`;
    const body =
      `OmniParse model health check detected the following status transitions:\n\n` +
      alerts.map((a) => `  • ${a}`).join('\n') +
      `\n\nFull details:\n${JSON.stringify(results, null, 2)}\n`;
    try {
      await sendAlertEmail(subject, body);
    } catch (err) {
      // Alert failure must not fail the cron run — the log row is already saved.
      console.warn('[model-health-check] Alert email failed:', err);
    }
  }

  // Cleanup: prune logs older than RETENTION_DAYS.
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const prune = await db.modelHealthLog.deleteMany({
      where: { checkedAt: { lt: cutoff } },
    });
    console.warn(
      `[model-health-check] Pruned ${prune.count} logs older than ${RETENTION_DAYS} days`,
    );
  } catch (err) {
    console.warn('[model-health-check] Prune failed:', err);
  }

  const summary = {
    ok: results.filter((r) => r.status === 'ok').length,
    rate_limited: results.filter((r) => r.status === 'rate_limited').length,
    decommissioned: results.filter((r) => r.status === 'decommissioned').length,
    error: results.filter((r) => r.status === 'error').length,
    new_model: results.filter((r) => r.status === 'new_model').length,
  };

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    summary,
    alertsSent: alerts.length,
    results,
  });
}
