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

// ─── JSON repair chain ──────────────────────────────────────────────────────
//
// Models occasionally emit ALMOST-valid JSON. Real failure modes seen with
// ministral-14b in the tester:
//
//   1. Arithmetic written into a number value:
//        "amount": 3500.00 + 1500.00,
//      JSON.parse fails with "Expected ',' or '}' after property value".
//   2. Trailing commas before }/] (json-mode models).
//   3. Smart quotes (“ ” ‘ ’) in keys/values.
//   4. Truncated output (max_tokens hit mid-object) → unbalanced braces.
//
// The tester REPAIRS these instead of giving up, and reports which repairs
// were needed (surfaced as a "JSON repaired" chip in the UI). That tells the
// admin the model needs a repair chain before it can be trusted with strict
// JSON integrations — exactly the kind of insight the tester exists for.

/** Left-to-right evaluation of a +/- chain on decimal numbers ("3500.00 + 1500.00" → 5000). */
function evalArithmeticChain(expr: string): number | null {
  const tokens = expr.match(/\d+(?:\.\d+)?|[+\-]/g);
  if (!tokens || tokens.length < 3 || tokens.length % 2 === 0) return null;
  let acc = parseFloat(tokens[0]);
  if (Number.isNaN(acc)) return null;
  for (let i = 1; i < tokens.length; i += 2) {
    const num = parseFloat(tokens[i + 1]);
    if (Number.isNaN(num)) return null;
    if (tokens[i] === '+') acc += num;
    else if (tokens[i] === '-') acc -= num;
    else return null;
  }
  return acc;
}

/**
 * Replace arithmetic chains in NUMBER VALUE positions with their result.
 * Anchored to value positions (after ':' / '[' / ',' / whitespace and before
 * a value terminator ',' / '}' / ']') so arithmetic inside STRING values
 * ("total 3500 + 1500") is never touched.
 */
function repairArithmeticValues(s: string): string {
  const ARITH = /(?<=[:\[,\s])(\d+(?:\.\d+)?(?:\s*[+\-]\s*\d+(?:\.\d+)?)+)(?=\s*[,}\]])/g;
  return s.replace(ARITH, (expr) => {
    const val = evalArithmeticChain(expr);
    if (val == null) return expr;
    return String(parseFloat(val.toFixed(6))); // trim float artifacts (0.1+0.2)
  });
}

function repairTrailingCommas(s: string): string {
  return s.replace(/,(\s*[}\]])/g, '$1');
}

function repairSmartQuotes(s: string): string {
  return s.replace(/\u201C|\u201D/g, '"').replace(/\u2018|\u2019/g, "'");
}

/**
 * Close a truncated JSON document. A proper character scan (NOT regex)
 * tracks the open brace/bracket stack and string state — braces inside
 * strings must be ignored — then appends the missing closers. No-op for
 * already-balanced input.
 */
function repairTruncation(s: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }
  let out = s;
  if (inString) {
    if (out.endsWith('\\')) out = out.slice(0, -1); // dangling escape
    out += '"';
  }
  while (stack.length > 0) out += stack.pop() === '{' ? '}' : ']';
  return out;
}

const REPAIR_STAGES: Array<{ name: string; apply: (s: string) => string }> = [
  { name: 'arithmetic evaluated', apply: repairArithmeticValues },
  { name: 'trailing commas removed', apply: repairTrailingCommas },
  { name: 'smart quotes normalized', apply: repairSmartQuotes },
  { name: 'truncation auto-closed', apply: repairTruncation },
];

/**
 * Parse JSON, escalating through the repair chain only as far as needed.
 * When nothing works, returns the parse error of the LAST attempted (fully
 * repaired) string plus the names of every repair that was applied.
 */
export function parseJsonWithRepair(raw: string): {
  parsed: unknown | null;
  error?: string;
  repairs?: string[];
} {
  try {
    return { parsed: JSON.parse(raw) };
  } catch {
    // fall through to the repair chain
  }
  let current = raw;
  const applied: string[] = [];
  let lastError = 'invalid JSON';
  for (const stage of REPAIR_STAGES) {
    const next = stage.apply(current);
    if (next === current) continue; // stage had nothing to do
    current = next;
    applied.push(stage.name);
    try {
      return { parsed: JSON.parse(current), repairs: applied };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { parsed: null, error: lastError, repairs: applied };
}

// ─── Light JSON extraction + repair (tester version of production cleanup) ──
//
// The tester shows the extracted fields side-by-side with the raw response,
// so the admin sees both "what the model returned raw" and "the fields it
// contains". When the model's JSON is ALMOST valid (arithmetic in values,
// trailing commas, truncation), the repair chain above fixes it instead of
// giving up — and reports what it had to fix.

export function extractJsonBlock(text: string): {
  parsed: unknown | null;
  error?: string;
  /** Repair stages that had to be applied for the parse to succeed. */
  repairs?: string[];
} {
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
  if (first === -1) {
    return { parsed: null, error: 'no JSON object found in response' };
  }
  if (last > first) {
    cleaned = cleaned.slice(first, last + 1);
  } else {
    // Truncated output with no closing brace at all — start at the first {
    // and let the repair chain's truncation auto-close do the rest.
    cleaned = cleaned.slice(first);
  }

  return parseJsonWithRepair(cleaned);
}

// ─── Chat response extraction (tester version of the production cleanup) ───
//
// Production chat responses are supposed to be a JSON envelope:
//   {"text": "...", "artifact": {"type": "chart-bar", "title": ..., "data": ...}}
// With json_mode active (Groq/OpenRouter) models mostly comply. WITHOUT
// json_mode (Mistral chat — and any model that silently rejected it) models
// produce one of these degraded shapes:
//
//   1. Clean envelope (json_mode)               → extractJsonBlock → done.
//   2. Markdown + CLOSED ```json fence holding  → step 2 strips the fence
//      the artifact (or {"artifact": …})          and captures the artifact.
//   3. Pseudo-envelope (ministral-14b): the whole response LOOKS like the
//      envelope, but "text" holds RAW markdown (unescaped newlines/quotes →
//      step 1 parse fails) and "artifact" sits in an UNCLOSED ```json fence
//      as a bare key → step 3 hunts the "artifact" key with a balanced-brace
//      scan (production chat Strategies 2–5 do the same) and salvages the
//      prose between "text": " and the cut point.
//   4. Raw artifact object inlined in prose     → step 3's second probe
//      ({"type": "table", …})                      (production Strategy 5).
//
// The raw text is always available to the caller (rawText) — this only
// decides what gets DISPLAYED by default.

export interface ChatExtractResult {
  /** Text to display in the chat bubble (artifact JSON stripped out). */
  displayText: string;
  /** The artifact object if one was found (envelope, fenced block, or salvaged). */
  artifact: unknown | null;
  /** Set when no JSON at all could be extracted (informational only). */
  parseError: string | null;
  /**
   * True when the artifact was recovered from the response BODY (embedded
   * fence / pseudo-JSON envelope / inline JSON) rather than a clean JSON
   * envelope — surfaced as an amber chip so the admin knows this model
   * doesn't emit clean envelopes on its own.
   */
  artifactSalvaged: boolean;
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

/**
 * String-aware brace-balanced scan of the object starting at openIdx.
 * Braces inside strings are ignored (a regex-only scan would miscount on
 * values like "amount (CZK}"). Returns the scanned slice and whether the
 * object actually closed before end-of-text.
 */
function scanBalancedObject(
  text: string,
  openIdx: number,
): { slice: string; balanced: boolean } | null {
  if (text[openIdx] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return { slice: text.slice(openIdx, i + 1), balanced: true };
    }
  }
  return { slice: text.slice(openIdx), balanced: false }; // truncated
}

// Probe 1: the envelope's "artifact" key written bare (inside an unclosed
// fence or a pseudo-envelope). Probe 2: a raw artifact object inlined in
// prose ({"type": "table", …}) — the same shape production chat Strategy 5
// hunts.
const ARTIFACT_KEY_RE = /"artifact"\s*:\s*\{/g;
const ARTIFACT_TYPE_RE = /\{\s*"type"\s*:\s*"(?:chart-bar|chart-line|chart-pie|table|summary)"/g;

/**
 * Hunt an artifact object embedded anywhere in free text. Returns the parsed
 * artifact plus the index where the embedded block starts (the display text
 * is cut there), or null when nothing artifact-shaped parses.
 */
function huntArtifactObject(text: string): { artifact: unknown; startIdx: number } | null {
  for (const probe of [ARTIFACT_KEY_RE, ARTIFACT_TYPE_RE]) {
    probe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = probe.exec(text)) !== null) {
      // Probe 1's match ends with the artifact object's opening brace;
      // probe 2's match starts with it.
      const openIdx = m[0].endsWith('{') ? m.index + m[0].length - 1 : m.index;
      const scanned = scanBalancedObject(text, openIdx);
      if (scanned) {
        const { parsed } = parseJsonWithRepair(scanned.slice);
        if (isArtifactShaped(parsed)) {
          return { artifact: parsed, startIdx: m.index };
        }
      }
    }
  }
  return null;
}

// Lead-in sentences models write right before inlining an artifact —
// production chat strips the same patterns.
const ARTIFACT_LEADIN_RE =
  /^(?:let's|here is|here's|i'll|now i|i will)\s+(?:prepare|generate|create|build|show|format|present)\s+(?:the\s+)?(?:artifact|table|chart|summary)[.!:?\s]*$/gim;

/**
 * Recover the chat prose from everything before an embedded artifact.
 *
 * Pseudo-envelope case: { … "text": "PROSE… <fence/separator> "artifact": {…
 *   → PROSE = raw slice between the opening quote after "text": and the
 *     cut point (the model wrote raw markdown with literal newlines/quotes,
 *     so the envelope itself was unparseable).
 *
 * Prose case: markdown with the artifact inlined/fenced somewhere
 *   → everything before the cut, minus fence / --- separator / lead-in
 *     remnants.
 */
function salvageTextBeforeArtifact(text: string, cutIdx: number): string {
  let prefix = text.slice(0, cutIdx).trimEnd();

  // The (usually unclosed) ```json fence that wrapped the artifact
  prefix = prefix.replace(/[ \t]*```(?:json)?[ \t]*$/i, '').trimEnd();
  // Horizontal-rule separator the model added before the artifact block
  prefix = prefix.replace(/[ \t]*(?:-{3,}|[=*]{3,})[ \t]*$/, '').trimEnd();
  // Remnants of a properly-closed text value in a pseudo-envelope
  prefix = prefix.replace(/["',]+[ \t]*$/, '');

  // Pseudo-envelope opener: { … "text": "PROSE — keep only PROSE (plus any
  // short lead-in sentence before the opening brace).
  const textKey = prefix.match(/"text"\s*:\s*"/);
  if (textKey && textKey.index !== undefined) {
    const beforeKey = prefix.slice(0, textKey.index).trim();
    const leadIn = beforeKey.endsWith('{') ? beforeKey.slice(0, -1).trim() : '';
    if (beforeKey === '{' || (leadIn && leadIn.length <= 80)) {
      let prose = prefix.slice(textKey.index + textKey[0].length);
      // When the model DID escape the string properly (but broke the JSON
      // elsewhere), unescape \n/\" — otherwise keep the raw markdown as-is.
      try {
        prose = JSON.parse(`"${prose}"`);
      } catch {
        // raw markdown with literal newlines/quotes — keep as-is
      }
      prefix = leadIn ? `${leadIn}\n\n${prose}` : prose;
    }
  }

  // Inline-artifact lead-in sentences ("Let's prepare the artifact.")
  prefix = prefix.replace(ARTIFACT_LEADIN_RE, '').trim();
  return prefix;
}

export function extractChatResponse(text: string): ChatExtractResult {
  if (!text) {
    return { displayText: '', artifact: null, parseError: 'empty response', artifactSalvaged: false };
  }

  let displayText = text.trim();
  let artifact: unknown = null;
  let parseError: string | null = null;
  let artifactSalvaged = false;

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

  // ── 2. Fenced ```json artifact block scan (CLOSED fences) ─────────────
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
  }

  // ── 3. Artifact key-hunt — unclosed fences & pseudo-JSON envelopes ────
  // The ministral-14b failure mode: the whole response is a pseudo-envelope
  // whose "text" value is raw markdown (step 1's parse fails on the literal
  // newlines/quotes) and whose "artifact" key sits in an UNCLOSED ```json
  // fence (step 2 needs a closing fence). Hunt the key with a balanced-brace
  // scan instead, then salvage the prose from before it.
  if (artifact == null) {
    const hunted = huntArtifactObject(displayText);
    if (hunted) {
      artifact = hunted.artifact;
      artifactSalvaged = true;
      displayText = salvageTextBeforeArtifact(displayText, hunted.startIdx);
    }
  }

  // ── 4. Final cleanup ───────────────────────────────────────────────────
  // Remove orphaned headings that referenced a stripped artifact block
  // (e.g. "### **Artifact: Suspicious Invoices Summary**"). Only true
  // headings (#…) or standalone bold lines — NOT regular sentences that
  // merely start with the word "Artifact".
  if (artifact != null) {
    displayText = displayText
      .replace(/^[ \t]{0,3}#{1,6}[ \t]+[^\n]*artifact[^\n]*\n?/gim, '')
      .replace(/^[ \t]{0,3}\*\*[ \t]*Artifact[^\n]*\*\*[ \t]*\n?/gim, '');
  }
  // Collapse the 3+ consecutive blank lines the removals leave behind.
  displayText = displayText.replace(/\n{3,}/g, '\n\n').trim();

  // Envelope/salvage produced an artifact but no usable text — mirror
  // production's "Here you go." placeholder so the bubble isn't empty.
  if (!displayText && artifact != null) {
    displayText = 'Here you go.';
  }

  return { displayText, artifact, parseError, artifactSalvaged };
}
