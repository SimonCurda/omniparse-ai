// ============================================================================
// Model Tester — direct single-model caller — Server-only module
//
// Used ONLY by the admin Model Tester (/api/admin/model-tester). Calls ONE
// specific model on ONE specific provider, bypassing the production cascade
// in gemini.ts. This lets the admin answer "is this model any good for
// invoice parsing / chatbot work?" BEFORE adding it to the cascade.
//
// Mirrors the production request construction from src/lib/gemini.ts exactly
// (endpoints, headers, key rotation, JSON-mode quirks) so test results are
// representative of how the model would behave in production:
//
//   - Mistral:   https://api.mistral.ai/v1/chat/completions (OpenAI-compatible)
//                3 keys (MISTRAL_API_KEY, _2, _3), rotate on 429.
//                response_format json_object for TEXT models only (pixtral
//                vision models reject it) — same rule as gemini.ts.
//                ALWAYS sends usage_options { enable_training: false } —
//                the tester may receive REAL invoice data, so the Mistral
//                training opt-out is enforced unconditionally (stricter than
//                production, which gates it on a DB flag).
//   - Groq:      https://api.groq.com/openai/v1/chat/completions, 1 key.
//                No response_format for vision models (llama-*-vision).
//   - OpenRouter:https://openrouter.ai/api/v1/chat/completions + HTTP-Referer
//                and X-Title headers, up to 5 keys, rotate on 429/402.
//   - Google:    v1beta generateContent with inlineData image conversion,
//                3 keys, responseMimeType json.
//
// On 400/422 with JSON mode, each provider retries once WITHOUT
// response_format (models that don't support structured output), mirroring
// the production fallback behaviour.
// ============================================================================

export type TesterProvider = 'mistral' | 'groq' | 'openrouter' | 'google_gemini';

export type TesterContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface TesterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | TesterContentPart[];
}

export interface DirectCallParams {
  provider: TesterProvider;
  model: string;
  messages: TesterMessage[];
  temperature: number;
  maxTokens: number;
  /** Use JSON mode where the provider/model supports it (production default). */
  jsonMode?: boolean;
  /** Vision model — suppresses response_format the same way gemini.ts does. */
  isVisionModel?: boolean;
}

export interface DirectCallResult {
  ok: boolean;
  text: string;
  /** The model that actually served the request (from the API response `model` field). */
  servedModel: string | null;
  statusCode: number | null;
  latencyMs: number;
  /** 1-based index of the API key that succeeded. */
  keyIndexUsed: number;
  /** True when the first attempt failed on JSON mode and we retried without it. */
  retriedWithoutJsonMode: boolean;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 60_000;

// ─── Key collection (mirrors gemini.ts / openrouter.ts env layout) ─────────

function getKeys(provider: TesterProvider): string[] {
  switch (provider) {
    case 'mistral':
      return [
        process.env.MISTRAL_API_KEY,
        process.env.MISTRAL_API_KEY_2,
        process.env.MISTRAL_API_KEY_3,
      ].filter((k): k is string => !!k);
    case 'groq':
      return process.env.GROQ_API_KEY ? [process.env.GROQ_API_KEY] : [];
    case 'openrouter':
      return [
        process.env.OPENROUTER_API_KEY,
        process.env.OPENROUTER_API_KEY_2,
        process.env.OPENROUTER_API_KEY_3,
        process.env.OPENROUTER_API_KEY_4,
        process.env.OPENROUTER_API_KEY_5,
      ].filter((k): k is string => !!k);
    case 'google_gemini':
      return [
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
      ].filter((k): k is string => !!k);
  }
}

export function getProviderKeyCounts(): Record<TesterProvider, number> {
  return {
    mistral: getKeys('mistral').length,
    groq: getKeys('groq').length,
    openrouter: getKeys('openrouter').length,
    google_gemini: getKeys('google_gemini').length,
  };
}

// ─── OpenAI-compatible providers (mistral / groq / openrouter) ──────────────

interface OpenAICompatAttempt {
  ok: boolean;
  text: string;
  servedModel: string | null;
  statusCode: number | null;
  errorText?: string;
  retriedWithoutJsonMode: boolean;
}

/**
 * One attempt against an OpenAI-compatible endpoint with a single key.
 * Handles the production JSON-mode quks: 400/422 → one retry without
 * response_format.
 */
async function openAICompatAttempt(
  url: string,
  apiKey: string,
  extraHeaders: Record<string, string>,
  body: Record<string, unknown>,
  jsonModeActive: boolean,
): Promise<OpenAICompatAttempt> {
  const doFetch = async (payload: Record<string, unknown>) =>
    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

  let res = await doFetch(body);

  // 400/422 → retry once with non-essential fields stripped.
  //
  // The tester strips BOTH `response_format` AND `usage_options` on retry,
  // because either can cause a 422 and we can't always tell which from the
  // error wording:
  //
  //   • response_format (json_mode) — some models don't support it.
  //   • usage_options ({ enable_training: false }) — the GDPR training
  //     opt-out. PAID-tier Mistral keys accept it; FREE-tier keys reject it
  //     with 422 "extra_forbidden" (the AI Act notice already documents
  //     this: "on free tier, Mistral may ignore or reject this parameter").
  //     The opt-out provides no actual protection when the API rejects it,
  //     so retrying without it is strictly better than failing.
  //
  // The retry only fires if at least one of those fields is actually in the
  // body (otherwise we'd just be re-sending the identical request). The
  // cost of one extra call is trivial in a testing tool. If the retry also
  // fails, that second error is what gets surfaced (it's the "real" error
  // without the optional-field complication).
  let retried = false;
  if (!res.ok && (res.status === 400 || res.status === 422)) {
    const { response_format: _rf, usage_options: _uo, ...rest } = body;
    if (_rf !== undefined || _uo !== undefined) {
      res = await doFetch(rest);
      retried = true;
    }
  }

  if (res.ok) {
    const data = await res.json().catch(() => null);
    const text: string =
      (data as { choices?: Array<{ message?: { content?: string } }> } | null)?.choices?.[0]?.message
        ?.content || '';
    return {
      ok: true,
      text,
      servedModel: (data as { model?: string } | null)?.model ?? null,
      statusCode: res.status,
      retriedWithoutJsonMode: retried,
    };
  }

  const errText = await res.text().catch(() => '');
  return {
    ok: false,
    text: '',
    servedModel: null,
    statusCode: res.status,
    errorText: errText.slice(0, 400),
    retriedWithoutJsonMode: retried,
  };
}

async function callOpenAICompatible(
  params: DirectCallParams,
  endpoint: string,
  extraHeaders: Record<string, string>,
  opts: { rotateOnQuota?: boolean; forceTrainingOptOut?: boolean } = {},
): Promise<DirectCallResult> {
  const keys = getKeys(params.provider);
  if (keys.length === 0) {
    return {
      ok: false,
      text: '',
      servedModel: null,
      statusCode: null,
      latencyMs: 0,
      keyIndexUsed: 0,
      retriedWithoutJsonMode: false,
      error: `No API key configured for ${params.provider} (check the env vars in Vercel).`,
    };
  }

  // JSON mode decision — mirrors gemini.ts:
  //  - suppressed for vision models (pixtral / llama-*-vision reject it)
  //  - suppressed when caller explicitly opted out
  const jsonModeActive =
    !!params.jsonMode && !params.isVisionModel;

  const baseBody: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
  };
  if (jsonModeActive) {
    baseBody.response_format = { type: 'json_object' };
  }
  // GDPR: real invoice data may flow through the tester — always opt out of
  // Mistral training (stricter than production's DB-gated flag).
  if (opts.forceTrainingOptOut) {
    baseBody.usage_options = { enable_training: false };
  }

  const start = Date.now();
  let lastError = 'All keys failed';
  let lastStatus: number | null = null;
  let anyRetried = false;

  for (let i = 0; i < keys.length; i++) {
    const attempt = await openAICompatAttempt(
      endpoint,
      keys[i],
      extraHeaders,
      { ...baseBody },
      jsonModeActive,
    );
    if (attempt.ok) {
      return {
        ok: true,
        text: attempt.text,
        servedModel: attempt.servedModel ?? params.model,
        statusCode: attempt.statusCode,
        latencyMs: Date.now() - start,
        keyIndexUsed: i + 1,
        retriedWithoutJsonMode: attempt.retriedWithoutJsonMode,
      };
    }
    anyRetried = anyRetried || attempt.retriedWithoutJsonMode;
    lastStatus = attempt.statusCode;
    lastError = attempt.errorText || `HTTP ${attempt.statusCode}`;

    const isQuota = attempt.statusCode === 429
      || (opts.rotateOnQuota && attempt.statusCode === 402);
    const isAuth = attempt.statusCode === 401 || attempt.statusCode === 403;
    if (!isQuota && !isAuth) {
      // Non-retryable for this tester (bad model name, unsupported feature, …)
      // — report immediately, no point burning the other keys.
      return {
        ok: false,
        text: '',
        servedModel: null,
        statusCode: attempt.statusCode,
        latencyMs: Date.now() - start,
        keyIndexUsed: i + 1,
        retriedWithoutJsonMode: anyRetried,
        error: lastError,
      };
    }
    // 429/402 (quota) or auth — try the next key.
  }

  return {
    ok: false,
    text: '',
    servedModel: null,
    statusCode: lastStatus,
    latencyMs: Date.now() - start,
    keyIndexUsed: keys.length,
    retriedWithoutJsonMode: anyRetried,
    error: lastError,
  };
}

// ─── Google Gemini (different request shape) ────────────────────────────────

async function callGoogleGemini(params: DirectCallParams): Promise<DirectCallResult> {
  const keys = getKeys('google_gemini');
  if (keys.length === 0) {
    return {
      ok: false,
      text: '',
      servedModel: null,
      statusCode: null,
      latencyMs: 0,
      keyIndexUsed: 0,
      retriedWithoutJsonMode: false,
      error: 'No GEMINI_API_KEY configured.',
    };
  }

  // Convert OpenAI-style messages to Gemini contents/parts (same conversion
  // as gemini.ts). The system message becomes systemInstruction.
  const systemText = params.messages
    .filter((m) => m.role === 'system' && typeof m.content === 'string')
    .map((m) => m.content as string)
    .join('\n\n');

  const contents = params.messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const parts: Array<Record<string, unknown>> = [];
      if (typeof m.content === 'string') {
        parts.push({ text: m.content });
      } else {
        for (const p of m.content) {
          if (p.type === 'text') {
            parts.push({ text: p.text });
          } else {
            const match = p.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
            } else {
              parts.push({ text: '[image url not supported]' });
            }
          }
        }
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    });

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: params.temperature,
      maxOutputTokens: params.maxTokens,
      ...(params.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };
  if (systemText) {
    body.systemInstruction = { parts: [{ text: systemText }] };
  }

  const start = Date.now();
  let lastError = 'All keys failed';
  let lastStatus: number | null = null;

  for (let i = 0; i < keys.length; i++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent?key=${keys[i]}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          modelVersion?: string;
        } | null;
        const text =
          data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
        return {
          ok: true,
          text,
          servedModel: data?.modelVersion ?? params.model,
          statusCode: res.status,
          latencyMs: Date.now() - start,
          keyIndexUsed: i + 1,
          retriedWithoutJsonMode: false,
        };
      }
      const errText = await res.text().catch(() => '');
      lastStatus = res.status;
      lastError = errText.slice(0, 400);
      if (res.status !== 429) {
        return {
          ok: false,
          text: '',
          servedModel: null,
          statusCode: res.status,
          latencyMs: Date.now() - start,
          keyIndexUsed: i + 1,
          retriedWithoutJsonMode: false,
          error: lastError,
        };
      }
    } catch (err) {
      lastStatus = null;
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    ok: false,
    text: '',
    servedModel: null,
    statusCode: lastStatus,
    latencyMs: Date.now() - start,
    keyIndexUsed: keys.length,
    retriedWithoutJsonMode: false,
    error: lastError,
  };
}

// ─── Public entry point ─────────────────────────────────────────────────────

export async function callSpecificModel(params: DirectCallParams): Promise<DirectCallResult> {
  switch (params.provider) {
    case 'mistral':
      return callOpenAICompatible(
        params,
        'https://api.mistral.ai/v1/chat/completions',
        {},
        { forceTrainingOptOut: true },
      );
    case 'groq':
      return callOpenAICompatible(
        params,
        'https://api.groq.com/openai/v1/chat/completions',
        {},
      );
    case 'openrouter': {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://omniparse-ai.vercel.app';
      return callOpenAICompatible(
        params,
        'https://openrouter.ai/api/v1/chat/completions',
        { 'HTTP-Referer': appUrl, 'X-Title': 'OmniParse AI' },
        { rotateOnQuota: true },
      );
    }
    case 'google_gemini':
      return callGoogleGemini(params);
  }
}

// ─── Light JSON extraction (tester version of the production cleanup) ──────
//
// The production parse route has an extensive repair chain (fences, thinking
// leaks, number normalization). The tester only needs a LIGHT version: enough
// to show the extracted fields side-by-side with the raw response, so the
// admin can see both "what the model returned raw" and "the fields it
// contains". Production-quality repair is intentionally NOT duplicated —
// the raw text is always shown alongside.

export function extractJsonBlock(text: string): { parsed: unknown | null; error?: string } {
  if (!text) return { parsed: null, error: 'empty response' };
  let cleaned = text.trim();

  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

  // Strip <thinking>…</thinking> style leaks
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // Slice from the first { to the last } — models sometimes prepend prose
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    return { parsed: null, error: 'no JSON object found in response' };
  }
  cleaned = cleaned.slice(first, last + 1);

  try {
    return { parsed: JSON.parse(cleaned) };
  } catch (err) {
    return { parsed: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Chat response extraction (tester version of the production cleanup) ───
//
// Production chat responses are supposed to be a JSON envelope:
//   {"text": "...", "artifact": {"type": "chart-bar", "title": ..., "data": ...}}
// With json_mode active (Groq/OpenRouter) models mostly comply. WITHOUT
// json_mode (Mistral chat — and any model that silently rejected it) models
// often return free markdown text with the artifact embedded as a fenced
// ```json code block inside the text instead.
//
// extractChatResponse handles BOTH shapes:
//   1. Envelope:  extractJsonBlock finds {text, artifact} → use both.
//   2. Embedded:  scan the markdown for fenced ```json blocks; if one parses
//                 to an artifact-shaped object, treat it as the artifact and
//                 strip the block from the displayed text (so the admin sees
//                 the rendered chart/table instead of a wall of JSON).
//
// The raw text is always available to the caller (rawText) — this only
// decides what gets DISPLAYED by default.

export interface ChatExtractResult {
  /** Text to display in the chat bubble (artifact JSON stripped out). */
  displayText: string;
  /** The artifact object if one was found (envelope or fenced block). */
  artifact: unknown | null;
  /** Set when no JSON at all could be extracted (informational only). */
  parseError: string | null;
}

function isArtifactShaped(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.type === 'string' &&
    typeof o.data === 'object' &&
    o.data !== null
  );
}

export function extractChatResponse(text: string): ChatExtractResult {
  if (!text) return { displayText: '', artifact: null, parseError: 'empty response' };

  let displayText = text.trim();
  let artifact: unknown = null;
  let parseError: string | null = null;

  // ── 1. Envelope extraction ({text, artifact}) ─────────────────────────
  const { parsed, error } = extractJsonBlock(displayText);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const looksLikeEnvelope = 'artifact' in obj || typeof obj.text === 'string';
    if (looksLikeEnvelope) {
      if (obj.artifact != null) artifact = obj.artifact;
      // Only replace the display text when the envelope actually carries a
      // usable text field — otherwise keep the raw markdown.
      if (typeof obj.text === 'string' && obj.text.trim()) {
        displayText = obj.text.trim();
      }
    }
  } else if (error) {
    parseError = error;
  }

  // ── 2. Fenced ```json artifact block scan ─────────────────────────────
  // Handles the no-json_mode failure mode: artifact embedded in markdown.
  // Also cleans the envelope case where the model returned {artifact: ...}
  // with NO text — the raw fallback still contains the fenced JSON block,
  // which should be stripped once the artifact has been captured.
  if (/```(?:json)?\s*\n/.test(displayText)) {
    const fenceRegex = /```(?:json)?\s*\n([\s\S]*?)```/g;
    const blocksToRemove: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = fenceRegex.exec(displayText)) !== null) {
      let inner: unknown;
      try {
        inner = JSON.parse(m[1].trim());
      } catch {
        continue; // not JSON — leave the block alone (could be code sample)
      }
      let candidate: unknown = inner;
      // Accept both the bare artifact and a {"artifact": {...}} wrapper.
      if (
        typeof inner === 'object' && inner !== null &&
        'artifact' in (inner as Record<string, unknown>)
      ) {
        candidate = (inner as Record<string, unknown>).artifact;
      }
      if (isArtifactShaped(candidate)) {
        if (artifact == null) artifact = candidate;
        blocksToRemove.push(m[0]);
      }
    }
    for (const block of blocksToRemove) {
      displayText = displayText.replace(block, '');
    }
    // Remove orphaned headings that referenced the stripped block
    // (e.g. "### **Artifact: Suspicious Invoices Summary**"). Only true
    // headings (#…) or standalone bold lines — NOT regular sentences that
    // merely start with the word "Artifact".
    displayText = displayText
      .replace(/^[ \t]{0,3}#{1,6}[ \t]+[^\n]*artifact[^\n]*\n?/gim, '')
      .replace(/^[ \t]{0,3}\*\*[ \t]*Artifact[^\n]*\*\*[ \t]*\n?/gim, '');
    // Collapse the 3+ consecutive blank lines the removals leave behind.
    displayText = displayText.replace(/\n{3,}/g, '\n\n').trim();
  }

  return { displayText, artifact, parseError };
}
