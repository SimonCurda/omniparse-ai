// ============================================================================
// Groq API helper — Server-only module
// Uses Groq's OpenAI-compatible API. No Google/Gemini dependency.
// ============================================================================

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ─── Groq Model Configuration ─────────────────────────────────────────────
//
// Groq periodically deprecates models. As of September 2026, the following
// models are available on Groq's free tier:
//
//   Text models:
//     llama-3.1-8b-instant:      ~30k OTPM, very reliable, small (no thinking leak)
//     llama-3.3-70b-versatile:   ~6k OTPM, higher quality, sometimes rate-limited
//
//   Vision models (replacements for the decommissioned qwen/qwen3.6-27b):
//     llama-3.2-11b-vision-preview:  Vision-capable, decent quality
//     llama-3.2-90b-vision-preview:  Vision-capable, higher quality (sometimes rate-limited)
//
// NOTE: qwen/qwen3.6-27b was decommissioned by Groq in September 2026.
// We switched to Llama 3.2 vision models, which do NOT have the thinking-leak
// problem that qwen had. This is actually a quality improvement.
//
// NOTE: llama-3.3-70b-versatile and llama-3.1-70b-versatile were both REMOVED
// from the cascade earlier (Groq decommissioned them). If Groq reintroduces
// a 70b llama variant (check https://console.groq.com/docs/deprecations),
// it can be re-added here.

// Vision models (tried in order — first one that works is used)
const GROQ_VISION_MODELS = [
  'llama-3.2-90b-vision-preview',   // higher quality vision
  'llama-3.2-11b-vision-preview',   // smaller, faster vision
];

// Chat models (tried in order)
const CHAT_MODEL = 'llama-3.1-8b-instant';
const CHAT_MODEL_FALLBACK_1 = 'llama-3.3-70b-versatile';

// Groq free tier output token limits per minute:
//   llama-3.1-8b-instant:     ~30,000 OTPM  (highest, most reliable)
//   llama-3.3-70b-versatile:  ~6,000 OTPM
//   llama-3.2-11b-vision:     ~6,000 OTPM
//   llama-3.2-90b-vision:     ~2,000 OTPM  (lowest, but highest quality)
// Max tokens per request: stay well under the per-minute limit.
// Responses with artifacts (tables/charts) need more tokens for the JSON.
const MAX_TOKENS_HIGH = 4096;
const MAX_TOKENS_LOW = 4096;

const RETRY_DELAY_MS = 2000;            // base delay before retrying a rate-limited model (doubles each retry)
const MAX_RETRIES = 2;                  // retry each model up to 2 times on 429 (was 1)
const CASCADE_RETRY_DELAY_MS = 10000;  // wait 10s before retrying the whole cascade
const MAX_CASCADE_RETRIES = 1;          // retry the whole cascade once after all 4 models fail

function getRetryDelay(attempt: number): number {
  // Exponential backoff: 2s, 4s for attempts 1 and 2
  return RETRY_DELAY_MS * Math.pow(2, attempt - 1);
}

function getApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is not configured. Add it to your Vercel environment variables.');
  return key;
}

/**
 * Check whether Groq is configured. Used to make the Groq cascade step optional.
 * Allows EU-only deployments (Mistral only) without configuring a US provider key.
 * Checks DB toggle first (if available), then env var.
 */
function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

/**
 * Check whether OpenRouter is explicitly enabled. Default: DISABLED.
 * Checks DB toggle first (if available), then env var.
 */
function isOpenRouterEnabled(): boolean {
  return process.env.ENABLE_OPENROUTER === 'true';
}

/**
 * Check whether Google Gemini (AI Studio free-tier) is explicitly enabled. Default: DISABLED.
 * Checks DB toggle first (if available), then env var.
 */
function isGoogleGeminiEnabled(): boolean {
  return process.env.ENABLE_GOOGLE_GEMINI === 'true';
}

/**
 * Fetch provider config from DB. Cached for 30 seconds to avoid hitting DB on every request.
 * Returns a map of provider → enabled boolean.
 * If DB is unavailable, falls back to env-var-based logic.
 */
let _providerConfigCache: { data: Record<string, boolean> | null; timestamp: number } = { data: null, timestamp: 0 };
const CONFIG_CACHE_TTL_MS = 30_000; // 30 seconds

async function getProviderConfig(): Promise<Record<string, boolean>> {
  // Return cache if fresh
  if (_providerConfigCache.data && Date.now() - _providerConfigCache.timestamp < CONFIG_CACHE_TTL_MS) {
    return _providerConfigCache.data;
  }

  try {
    // Dynamic import to avoid circular dependency at module load time
    const { db } = await import('@/lib/db');
    const configs = await db.aiProviderConfig.findMany();
    const configMap: Record<string, boolean> = {};
    for (const c of configs) {
      configMap[c.provider] = c.enabled;
    }
    _providerConfigCache = { data: configMap, timestamp: Date.now() };
    return configMap;
  } catch {
    // DB unavailable — fall back to env vars (return empty = use defaults)
    return {};
  }
}

/**
 * Async versions of the guard functions — check DB config first, then env var.
 * These are called at the start of each cascade function.
 */
async function isGroqEnabledAsync(): Promise<boolean> {
  const config = await getProviderConfig();
  if (config['groq'] !== undefined) {
    return config['groq'] && !!process.env.GROQ_API_KEY;
  }
  return isGroqConfigured();
}

async function isOpenRouterEnabledAsync(): Promise<boolean> {
  const config = await getProviderConfig();
  if (config['openrouter'] !== undefined) {
    return config['openrouter'] && !!(process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY_2);
  }
  return isOpenRouterEnabled();
}

async function isGoogleGeminiEnabledAsync(): Promise<boolean> {
  const config = await getProviderConfig();
  if (config['google_gemini'] !== undefined) {
    return config['google_gemini'] && !!(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY_3);
  }
  return isGoogleGeminiEnabled();
}

async function isMistralTrainingOptOutAsync(): Promise<boolean> {
  const config = await getProviderConfig();
  if (config['mistral_training_optout'] !== undefined) {
    return config['mistral_training_optout'];
  }
  return process.env.MISTRAL_DISABLE_TRAINING === 'true';
}

/**
 * Build Mistral request body with optional training opt-out.
 * Checks DB config (via isMistralTrainingOptOutAsync) or env var.
 */
async function buildMistralBody(params: {
  model: string;
  messages: unknown;
  max_tokens: number;
  temperature: number;
  response_format?: { type: string };
}): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    max_tokens: params.max_tokens,
    temperature: params.temperature,
  };
  if (params.response_format) {
    body.response_format = params.response_format;
  }
  if (await isMistralTrainingOptOutAsync()) {
    body.usage_options = { enable_training: false };
  }
  return body;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GeminiVisionMessage {
  role?: 'user' | 'model';
  content: Array<
    { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
    | { type: 'file_url'; file_url: { url: string } }
  >;
}

/**
 * Call Groq with vision (image) input — uses vision-capable model.
 * If Groq's vision model (qwen3.6-27b) is rate-limited, falls back to
 * OpenRouter's free vision models automatically.
 */
export async function geminiVisionCall(messages: GeminiVisionMessage[]): Promise<string> {
  // GROQ_API_KEY is optional — allows EU-only mode (Mistral only)

  // Convert messages to OpenAI format
  const openaiMessages: Array<{ role: string; content: Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

  for (const msg of messages) {
    const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
    for (const part of msg.content) {
      if (part.type === 'text') {
        parts.push({ type: 'text', text: part.text });
      } else if (part.type === 'image_url') {
        parts.push({ type: 'image_url', image_url: { url: part.image_url.url } });
      } else if (part.type === 'file_url') {
        parts.push({ type: 'image_url', image_url: { url: part.file_url.url } });
      }
    }
    openaiMessages.push({ role: msg.role === 'model' ? 'assistant' : 'user', content: parts });
  }

  // ─── Try Mistral FIRST (EU-based, GDPR-friendly) ────────────────────
  // STRATEGIC: Mistral AI is based in Paris, France (EU). Transfers to them
  // stay within the EU — NO SCC NEEDED, NO Schrems II issue.
  //
  // This means: even before SCCs with US providers (OpenRouter, Groq, Google)
  // are signed, EU users CAN legally use OmniParse if we route through Mistral.
  //
  // So we try Mistral FIRST for vision extraction. Falls through to OpenRouter/
  // Groq/Google if Mistral is rate-limited or unavailable.
  //
  // Models tried (in order):
  //   1. pixtral-large-2411 — best quality vision model (124B params)
  //   2. pixtral-12b-2409   — smaller, faster, often free-tier eligible
  //
  // Supports up to 3 MISTRAL_API_KEY entries for rotation.
  const mistralKeys = [
    process.env.MISTRAL_API_KEY,
    process.env.MISTRAL_API_KEY_2,
    process.env.MISTRAL_API_KEY_3,
  ].filter(Boolean) as string[];

  if (mistralKeys.length > 0) {
    const mistralModels = [
      'pixtral-large-latest',   // best quality vision model
      'pixtral-12b-latest',     // smaller, faster, often free-tier eligible
    ];

    for (const mistralModel of mistralModels) {
      for (let keyIdx = 0; keyIdx < mistralKeys.length; keyIdx++) {
        const mistralKey = mistralKeys[keyIdx];
        try {
          console.warn(`[gemini] Trying Mistral vision: ${mistralModel} (key ${keyIdx + 1}/${mistralKeys.length})...`);

          // Mistral API is OpenAI-compatible — uses the same message format
          // we already built. No conversion needed.
          const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${mistralKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: mistralModel,
              messages: openaiMessages,
              max_tokens: 4096,
              temperature: 0.1,
              // Mistral supports response_format for JSON mode on some models
              response_format: { type: 'json_object' },
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content || '';
            if (content) {
              const usedModel = data.model || mistralModel;
              console.warn(`[gemini] Mistral vision succeeded (model: ${usedModel}, key ${keyIdx + 1})!`);
              return content;
            }
          }

          // If JSON mode failed (400/422), try WITHOUT response_format
          if (res.status === 400 || res.status === 422) {
            console.warn(`[gemini] Mistral ${mistralModel} doesn't support JSON mode. Retrying without (key ${keyIdx + 1})...`);
            const fbRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${mistralKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: mistralModel,
                messages: openaiMessages,
                max_tokens: 4096,
                temperature: 0.1,
                // No response_format — free-text mode
              }),
            });
            if (fbRes.ok) {
              const fbData = await fbRes.json();
              const fbContent = fbData.choices?.[0]?.message?.content || '';
              if (fbContent) {
                console.warn(`[gemini] Mistral vision succeeded (free-text, model: ${mistralModel}, key ${keyIdx + 1})!`);
                return fbContent;
              }
            }
            // This model doesn't work — try next model
            break;
          }

          // 429 — rate limited, try next key
          if (res.status === 429) {
            console.warn(`[gemini] Mistral ${mistralModel} rate limited (key ${keyIdx + 1}). Trying next key...`);
            continue;
          }

          // Other error — try next model
          console.warn(`[gemini] Mistral ${mistralModel} failed (key ${keyIdx + 1}, status ${res.status})`);
          break;
        } catch (err) {
          console.warn(`[gemini] Mistral ${mistralModel} error (key ${keyIdx + 1}):`, err instanceof Error ? err.message : String(err));
          continue;
        }
      }
    }
  }

  // ─── Try OpenRouter vision models NEXT ──────────────────────────────
  // OpenRouter's Gemma 4 models produce clean JSON without thinking leaks.
  // Groq's qwen3.6-27b is a reasoning model that leaks its thinking into
  // JSON values (e.g. vendor="High confidence", invoiceNumber="High"),
  // producing garbage for non-English invoices.
  //
  // So for VISION (image) extraction, we try OpenRouter first (clean JSON),
  // and only fall back to Groq's qwen as a last resort.
  //
  // NOTE: This is the OPPOSITE of the TEXT path (geminiChatCall), which
  // tries Groq first because Groq's llama models are better at text parsing
  // and don't have the thinking-leak problem.

  const orApiKeys = process.env.OPENROUTER_API_KEY
    ? [process.env.OPENROUTER_API_KEY,
       process.env.OPENROUTER_API_KEY_2,
       process.env.OPENROUTER_API_KEY_3,
       process.env.OPENROUTER_API_KEY_4,
       process.env.OPENROUTER_API_KEY_5,
      ].filter(Boolean) as string[]
    : [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://omniparse-ai.vercel.app';

  const openRouterVisionModels = [
    'inclusionai/ling-3.0-flash-vl:free',       // Finance-focused VL model — currently the most reliable free vision model
    'google/gemma-4-31b-it:free',               // Good when available (often 429)
    'google/gemma-4-26b-a4b-it:free',           // Also good when available
    'nex-agi/nex-n2.5-pro:free',
    'thinkingmachines/inkling:free',
    'nex-agi/nex-n2.5-mini:free',
    'thinkingmachines/inkling-small:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'openrouter/free',                           // Auto-router — picks any available free model
  ];

  // Try OpenRouter — DISABLED by default (ENABLE_OPENROUTER env var must be 'true')
  if (await isOpenRouterEnabledAsync() && orApiKeys.length > 0) {
    for (const model of openRouterVisionModels) {
      for (let keyIdx = 0; keyIdx < orApiKeys.length; keyIdx++) {
        const orApiKey = orApiKeys[keyIdx];
        try {
          console.warn(`[gemini] Trying OpenRouter vision: ${model} (key ${keyIdx + 1}/${orApiKeys.length})...`);

          // First try with JSON mode
          const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${orApiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': appUrl,
              'X-Title': 'OmniParse AI',
            },
            body: JSON.stringify({
              model,
              messages: openaiMessages,
              max_tokens: 4096,
              temperature: 0.1,
              response_format: { type: 'json_object' },
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content || '';
            if (content) {
              const usedModel = data.model || model;
              console.warn(`[gemini] OpenRouter vision succeeded (model: ${usedModel}, key ${keyIdx + 1})!`);
              return content;
            }
          }

          // If JSON mode failed (400/422), try WITHOUT response_format
          if (res.status === 400 || res.status === 422) {
            console.warn(`[gemini] ${model} doesn't support JSON mode. Retrying without response_format (key ${keyIdx + 1})...`);
            const fbRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${orApiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': appUrl,
                'X-Title': 'OmniParse AI',
              },
              body: JSON.stringify({
                model,
                messages: openaiMessages,
                max_tokens: 4096,
                temperature: 0.1,
                // No response_format — free-text mode, cleaned up later
              }),
            });
            if (fbRes.ok) {
              const fbData = await fbRes.json();
              const fbContent = fbData.choices?.[0]?.message?.content || '';
              if (fbContent) {
                const usedModel = fbData.model || model;
                console.warn(`[gemini] OpenRouter vision succeeded (free-text, model: ${usedModel}, key ${keyIdx + 1})!`);
                return fbContent;
              }
            }
            // This model doesn't work — try next model
            break;
          }

          // 429/402 — rate limited, try next key for this model
          if (res.status === 429 || res.status === 402) {
            console.warn(`[gemini] ${model} rate limited (key ${keyIdx + 1}). Trying next key...`);
            continue;
          }

          // Other error — try next model
          console.warn(`[gemini] ${model} failed (key ${keyIdx + 1}, status ${res.status})`);
          break;
        } catch (err) {
          console.warn(`[gemini] ${model} error (key ${keyIdx + 1}):`, err instanceof Error ? err.message : String(err));
          continue;
        }
      }
    }
  }

  // ─── Groq vision models (Llama 3.2 Vision family) ──────────────────
  // These replaced the decommissioned qwen3.6-27b. Llama 3.2 vision models
  // don't have the thinking-leak problem, so JSON output is cleaner.
  // Try each model in order; break on success.
  // ─── Groq vision models — gated on isGroqConfigured() ──────────────
  if (await isGroqEnabledAsync()) {
  const apiKey = getApiKey();
  for (const groqVisionModel of GROQ_VISION_MODELS) {
    try {
      console.warn(`[gemini] Trying Groq vision model: ${groqVisionModel} (last resort)...`);
      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: groqVisionModel,
          messages: openaiMessages,
          max_tokens: MAX_TOKENS_LOW,
          temperature: 0.1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        if (content) {
          console.warn(`[gemini] Groq vision model ${groqVisionModel} succeeded!`);
          return content;
        }
      }

      // 429 — rate limited, try next Groq vision model
      if (res.status === 429) {
        console.warn(`[gemini] Groq vision model ${groqVisionModel} rate limited. Trying next model...`);
        continue;
      }

      // 400/404 — model not available (deprecated), try next
      if (res.status === 400 || res.status === 404) {
        const errText = await res.text().catch(() => '');
        console.warn(`[gemini] Groq vision model ${groqVisionModel} not available (${res.status}). ${errText.slice(0, 200)}`);
        continue;
      }

      // Other error — try next model
      console.warn(`[gemini] Groq vision model ${groqVisionModel} failed (${res.status}). Trying next...`);
    } catch (err) {
      console.warn(`[gemini] Groq vision ${groqVisionModel} error:`, err instanceof Error ? err.message : String(err));
      continue;
    }
  }
  } // end if (isGroqConfigured())

  // ─── Final fallback: Google Gemini direct API — DISABLED BY DEFAULT ──
  // Google's Gemini API has its OWN free tier (separate from OpenRouter
  // and Groq) — 15 req/min on gemini-2.0-flash and gemini-2.5-flash.
  // Adding it here directly multiplies our total capacity by ~2-3x
  // because it has an independent quota pool.
  //
  // Supports multiple GEMINI_API_KEY / GEMINI_API_KEY_2 keys for rotation.
  // Set them in Vercel env vars.
  const geminiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean) as string[];

  if (await isGoogleGeminiEnabledAsync() && geminiKeys.length > 0) {
    const geminiModels = [
      'gemini-2.0-flash',           // fast, generous free tier (15 rpm)
      'gemini-2.5-flash',           // newer, also free tier
      'gemini-1.5-flash',           // legacy fallback
    ];

    for (const gm of geminiModels) {
      for (let keyIdx = 0; keyIdx < geminiKeys.length; keyIdx++) {
        const geminiKey = geminiKeys[keyIdx];
        try {
          console.warn(`[gemini] Trying Google Gemini vision: ${gm} (key ${keyIdx + 1}/${geminiKeys.length})...`);

          // Gemini API uses a different request shape — convert OpenAI messages
          // to Gemini's contents/parts format
          const contents = openaiMessages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: m.content.map((c) => {
              if (c.type === 'text' && c.text) {
                return { text: c.text };
              }
              if (c.type === 'image_url' && c.image_url) {
                // Gemini expects { inlineData: { mimeType, data } }
                const url = c.image_url.url;
                const match = url.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                  return { inlineData: { mimeType: match[1], data: match[2] } };
                }
                return { text: '[image url not supported]' };
              }
              return { text: '' };
            }),
          }));

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${gm}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents,
                generationConfig: {
                  temperature: 0.1,
                  maxOutputTokens: 4096,
                  responseMimeType: 'application/json',
                },
              }),
            },
          );

          if (res.ok) {
            const data = await res.json();
            // Response shape: { candidates: [{ content: { parts: [{ text }] } }] }
            const content = data.candidates?.[0]?.content?.parts
              ?.map((p: { text?: string }) => p.text || '')
              .join('') || '';
            if (content) {
              console.warn(`[gemini] Google Gemini vision succeeded (model: ${gm}, key ${keyIdx + 1})!`);
              return content;
            }
          }

          // 429 — rate limited, try next key
          if (res.status === 429) {
            console.warn(`[gemini] Google Gemini ${gm} rate limited (key ${keyIdx + 1}). Trying next key...`);
            continue;
          }

          // 400/404 — model not available, try next model
          if (res.status === 400 || res.status === 404) {
            console.warn(`[gemini] Google Gemini ${gm} not available (status ${res.status}). Trying next model...`);
            break;
          }

          console.warn(`[gemini] Google Gemini ${gm} failed (key ${keyIdx + 1}, status ${res.status})`);
          break;
        } catch (err) {
          console.warn(`[gemini] Google Gemini ${gm} error (key ${keyIdx + 1}):`, err instanceof Error ? err.message : String(err));
          continue;
        }
      }
    }
  }

  throw new Error('All vision models (Mistral + OpenRouter + Groq + Gemini) are temporarily unavailable. Please try again in a moment.');
}

/**
 * Call text-only chat (used for PDF text extraction + AI Chat tab).
 * Tries providers in order: Mistral (EU) → Groq (US) → OpenRouter (US).
 * Mistral is tried first because it's EU-based (no SCC needed).
 */
export async function geminiChatCall(
  systemPrompt: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<string> {
  // GROQ_API_KEY is optional — allows EU-only mode (Mistral only)

  const openaiMessages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  // ─── Try Mistral FIRST (EU-based, GDPR-friendly) ────────────────────
  // Same strategy as geminiVisionCall: Mistral (Paris, EU) is tried first
  // because it stays within the EU — no SCC needed. Falls through to Groq
  // (US) if Mistral is rate-limited or unavailable.
  const mistralKeys = [
    process.env.MISTRAL_API_KEY,
    process.env.MISTRAL_API_KEY_2,
    process.env.MISTRAL_API_KEY_3,
  ].filter(Boolean) as string[];

  const triedMistralModels: string[] = [];

  if (mistralKeys.length > 0) {
    const mistralChatModels = [
      'mistral-small-latest',    // fast, available on free tier
      'open-mistral-7b',         // older model, often available on free tier
    ];

    for (const mistralModel of mistralChatModels) {
      let modelFailed = false;
      for (let keyIdx = 0; keyIdx < mistralKeys.length; keyIdx++) {
        const mistralKey = mistralKeys[keyIdx];
        try {
          console.warn(`[gemini-chat] Trying Mistral text: ${mistralModel} (key ${keyIdx + 1}/${mistralKeys.length})...`);

          const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${mistralKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: mistralModel,
              messages: openaiMessages,
              max_tokens: MAX_TOKENS_HIGH,
              temperature: 0.1,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content || '';
            if (content) {
              console.warn(`[gemini-chat] Mistral text succeeded (model: ${mistralModel}, key ${keyIdx + 1})!`);
              return content;
            }
          }

          // Log the actual error response for debugging
          const errBody = await res.text().catch(() => '');
          console.warn(`[gemini-chat] Mistral ${mistralModel} failed (key ${keyIdx + 1}, status ${res.status}): ${errBody.slice(0, 300)}`);

          if (res.status === 429) {
            // Rate limited — try next key, but record the failure
            continue;
          }

          // 401/403/404 — model not available or key invalid, skip to next MODEL
          triedMistralModels.push(`${mistralModel}(${res.status})`);
          modelFailed = true;
          break;
        } catch (err) {
          console.warn(`[gemini-chat] Mistral ${mistralModel} error:`, err instanceof Error ? err.message : String(err));
          continue;
        }
      }
      // If all keys were exhausted (429 on all), record it
      if (!modelFailed) {
        triedMistralModels.push(`${mistralModel}(429)`);
      }
    }
    if (triedMistralModels.length > 0) {
      console.warn(`[gemini-chat] All Mistral models failed: ${triedMistralModels.join(', ')}. Falling through to Groq...`);
    }
  }

  // ─── Try Groq next (better at Czech/European invoice text extraction) ──
  // Groq's models are more reliable for non-English documents.
  // OpenRouter text models produce lower-quality extraction.
  // We try Groq first; if ALL Groq models are rate-limited, we catch
  // the throw and try OpenRouter as a last resort.

  // ─── Groq cascade (original code) ────────────────────────────────────

  const modelConfigs = [
    // `supportsJsonMode` controls whether we set `response_format: { type: "json_object" }`
    // in the request body. JSON mode forces the model to output valid JSON only,
    // eliminating the "Thinking Process:" / "Output:" / "Draft:" leak class entirely.
    // Only use non-reasoning models for text extraction — reasoning models (qwen)
    // leak their thinking into JSON values (e.g. vendor="High confidence").
    { model: CHAT_MODEL, maxTokens: MAX_TOKENS_HIGH, supportsJsonMode: true },            // llama-3.1-8b-instant
    { model: CHAT_MODEL_FALLBACK_1, maxTokens: MAX_TOKENS_HIGH, supportsJsonMode: true }, // llama-4-scout-17b-16e-instruct
    // NOTE: qwen3.6-27b (CHAT_MODEL_FALLBACK_2) is intentionally EXCLUDED from the
    // text cascade. It's a reasoning model that leaks thinking into JSON values,
    // producing garbage like vendor="High confidence" and invoiceNumber="High".
    // If both llama models fail, we fall through to the OpenRouter fallback below.
  ];

  const triedModels: string[] = [];

  if (await isGroqEnabledAsync()) {
  const apiKey = getApiKey();

  // ─── Cascade retry loop ────────────────────────────────────────────────────
  // If all 4 models fail with 429 in the first pass, we wait 10s and try the
  // whole cascade once more. This recovers from transient Groq outages without
  // showing the user an error message.
  for (let cascadeAttempt = 0; cascadeAttempt <= MAX_CASCADE_RETRIES; cascadeAttempt++) {
    if (cascadeAttempt > 0) {
      console.warn(`[gemini] All models failed in previous cascade. Retrying in ${CASCADE_RETRY_DELAY_MS}ms (cascade attempt ${cascadeAttempt + 1}/${MAX_CASCADE_RETRIES + 1})...`);
      await sleep(CASCADE_RETRY_DELAY_MS);
    }

    for (const { model, maxTokens, supportsJsonMode } of modelConfigs) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            const delay = getRetryDelay(attempt);
            console.warn(`[gemini] Retrying ${model} after rate limit (attempt ${attempt}/${MAX_RETRIES}, waiting ${delay}ms)...`);
            await sleep(delay);
          }

          // Build the request body. For JSON-mode-capable models, set response_format
          // so the API forces valid JSON output (eliminates thinking leak at the API level).
          // For non-JSON-mode models (qwen), send a plain text request and rely on the
          // regex cleanup layer in chat/route.ts to handle any thinking leak.
          // `jsonModeEnabled` is true by default if supportsJsonMode is true, but can be
          // flipped to false by the 422 handler below for a single retry without JSON mode.
          let jsonModeEnabled = supportsJsonMode;
          const requestBody: Record<string, unknown> = {
            model,
            messages: openaiMessages,
            max_tokens: maxTokens,
            temperature: 0.7,
          };
          if (jsonModeEnabled) {
            requestBody.response_format = { type: 'json_object' };
          }

          const res = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (res.status === 404) {
            const errText = await res.text();
            console.warn(`[gemini] Model ${model} unavailable (404): ${errText.slice(0, 200)}`);
            triedModels.push(`${model}(404)`);
            break; // model doesn't exist, try next model
          }

          // 422 = Unprocessable Entity. Often means the model doesn't support
          // `response_format: json_object`. Retry the SAME model WITHOUT JSON mode
          // (one extra attempt) before falling through to the next model.
          // This handles qwen3.6-27b and any future model with uncertain JSON support.
          if (res.status === 422 && jsonModeEnabled) {
            const errText = await res.text();
            console.warn(`[gemini] Model ${model} rejected JSON mode (422). Retrying WITHOUT response_format...`);
            jsonModeEnabled = false;
            const fallbackBody: Record<string, unknown> = {
              model,
              messages: openaiMessages,
              max_tokens: maxTokens,
              temperature: 0.7,
              // No response_format — free-text mode
            };
            const fallbackRes = await fetch(GROQ_API_URL, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(fallbackBody),
            });
            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json();
              const fallbackContent = fallbackData.choices?.[0]?.message?.content || '';
              if (fallbackContent) return fallbackContent;
            }
            // If fallback also failed, fall through to next model
            triedModels.push(model);
            break;
          }

          // 422 for non-JSON-mode reasons (other validation errors) — try next model
          if (res.status === 422) {
            const errText = await res.text();
            console.warn(`[gemini] Model ${model} rejected request (422), trying next...`, errText);
            triedModels.push(model);
            break;
          }

          // 400 errors — multiple causes. Each needs a different response:
          //   - json_validate_failed: retry same model WITHOUT response_format
          //   - model_decommissioned / model_not_found / model_unavailable:
          //     treat like 404, fall through to next model in cascade
          //   - other 400 errors: throw immediately (real bug, should surface)
          if (res.status === 400) {
            const errText = await res.text();

            // Decommissioned / unavailable model — fall through to next model
            // (same as 404 — don't retry the same model, just move on)
            if (errText.includes('model_decommissioned')
              || errText.includes('model_not_found')
              || errText.includes('model_unavailable')
              || errText.includes('has been decommissioned')
              || errText.includes('is no longer supported')) {
              console.warn(`[gemini] Model ${model} decommissioned/unavailable (400). Trying next model...`);
              triedModels.push(model);
              break;
            }

            // JSON validation failed — retry WITHOUT response_format
            if (jsonModeEnabled && errText.includes('json_validate_failed')) {
              console.warn(`[gemini] Model ${model} failed JSON validation (400). Retrying WITHOUT response_format...`);
              jsonModeEnabled = false;
              const fallbackBody: Record<string, unknown> = {
                model,
                messages: openaiMessages,
                max_tokens: maxTokens,
                temperature: 0.7,
                // No response_format — free-text mode
              };
              const fallbackRes = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(fallbackBody),
              });
              if (fallbackRes.ok) {
                const fallbackData = await fallbackRes.json();
                const fallbackContent = fallbackData.choices?.[0]?.message?.content || '';
                if (fallbackContent) return fallbackContent;
              }
              // If fallback also failed, fall through to next model
              triedModels.push(model);
              break;
            }

            // Other 400 errors (real validation issues, etc.) — throw immediately
            throw new Error(`Groq API error (400): ${errText}`);
          }

          if (res.status === 429) {
            const errText = await res.text();
            console.warn(`[gemini] Model ${model} rate limited (429), attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
            if (attempt < MAX_RETRIES) {
              continue; // retry same model after delay
            }
            triedModels.push(model);
            break; // exhausted retries, try next model
          }

          if (!res.ok) {
            const err = await res.text();
            throw new Error(`Groq API error (${res.status}): ${err}`);
          }

          const data = await res.json();
          const content = data.choices?.[0]?.message?.content || '';
          if (content) return content;

          // Empty response — try next model
          console.warn(`[gemini] Model ${model} returned empty response, trying next...`);
          triedModels.push(model);
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('404') || msg.includes('429') || msg.includes('model_not_found') || msg.includes('does not exist') || msg.includes('rate_limit')) {
            console.warn(`[gemini] Model ${model} error, trying next...`, msg);
            triedModels.push(model);
            break;
          }
          throw err;
        }
      }
    }
  }
  } // end if (isGroqConfigured())

  // ─── OpenRouter fallback — DISABLED by default ─────────────
  const orApiKeys = process.env.OPENROUTER_API_KEY
    ? [process.env.OPENROUTER_API_KEY,
       process.env.OPENROUTER_API_KEY_2,
       process.env.OPENROUTER_API_KEY_3,
       process.env.OPENROUTER_API_KEY_4,
       process.env.OPENROUTER_API_KEY_5,
      ].filter(Boolean) as string[]
    : [];
  const orAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://omniparse-ai.vercel.app';

  if (await isOpenRouterEnabledAsync() && orApiKeys.length > 0) {
    console.warn('[gemini-chat] All models exhausted. Trying OpenRouter (ENABLE_OPENROUTER=true)...');
    for (let keyIdx = 0; keyIdx < orApiKeys.length; keyIdx++) {
      const orKey = orApiKeys[keyIdx];
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${orKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': orAppUrl,
            'X-Title': 'OmniParse AI',
          },
          body: JSON.stringify({
            model: 'inclusionai/ling-3.0-flash-fin:free',
            fallbacks: ['nvidia/llama-3.1-nemotron-70b-instruct:free', 'meta-llama/llama-3.3-70b-instruct:free', 'openrouter/free'],
            messages: openaiMessages,
            max_tokens: 4096,
            temperature: 0.7,
            response_format: { type: 'json_object' },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content || '';
          if (content) return content;
        }
        if (res.status === 429 || res.status === 402) continue;
      } catch { continue; }
    }
  }

  // ─── Final fallback: Google Gemini text models ────────────────────
  // Same as the vision cascade — Google Gemini has its own free tier
  // quota, independent from Mistral/Groq/OpenRouter.
  const geminiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean) as string[];

  if (await isGoogleGeminiEnabledAsync() && geminiKeys.length > 0) {
    const geminiTextModels = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];

    for (const gm of geminiTextModels) {
      for (let keyIdx = 0; keyIdx < geminiKeys.length; keyIdx++) {
        const geminiKey = geminiKeys[keyIdx];
        try {
          console.warn(`[gemini-chat] Trying Google Gemini text: ${gm} (key ${keyIdx + 1}/${geminiKeys.length})...`);

          // Convert OpenAI messages to Gemini format
          const contents = openaiMessages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          }));

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${gm}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents,
                generationConfig: {
                  temperature: 0.1,
                  maxOutputTokens: MAX_TOKENS_HIGH,
                  responseMimeType: 'application/json',
                },
              }),
            },
          );

          if (res.ok) {
            const data = await res.json();
            const content = data.candidates?.[0]?.content?.parts
              ?.map((p: { text?: string }) => p.text || '')
              .join('') || '';
            if (content) {
              console.warn(`[gemini-chat] Google Gemini text succeeded (model: ${gm}, key ${keyIdx + 1})!`);
              return content;
            }
          }

          if (res.status === 429) {
            console.warn(`[gemini-chat] Google Gemini ${gm} rate limited (key ${keyIdx + 1}). Trying next key...`);
            continue;
          }
          if (res.status === 400 || res.status === 404) {
            console.warn(`[gemini-chat] Google Gemini ${gm} not available (status ${res.status}). Trying next model...`);
            break;
          }
          console.warn(`[gemini-chat] Google Gemini ${gm} failed (key ${keyIdx + 1}, status ${res.status})`);
          break;
        } catch (err) {
          console.warn(`[gemini-chat] Google Gemini ${gm} error (key ${keyIdx + 1}):`, err instanceof Error ? err.message : String(err));
          continue;
        }
      }
    }
  }

  const allTriedModels = [...triedMistralModels, ...triedModels];
  const errorDetail = allTriedModels.length > 0 ? allTriedModels.join(', ') : 'all models';

  // Build a helpful error message based on what failed
  const has403 = allTriedModels.some(m => m.includes('(403)'));
  const has429 = allTriedModels.some(m => m.includes('(429)'));
  const has401 = allTriedModels.some(m => m.includes('(401)'));
  let hint = '';
  if (has401 || has403) {
    hint = ' — API key may be invalid or the model is not available on your tier. Check MISTRAL_API_KEY and GROQ_API_KEY in Vercel env vars.';
  } else if (has429) {
    hint = ' — Free-tier rate limits exceeded. Wait a few minutes or upgrade to a paid API tier.';
  } else if (allTriedModels.length === 0) {
    hint = ' — No AI providers are configured. Set MISTRAL_API_KEY and/or GROQ_API_KEY in Vercel env vars. OpenRouter and Google Gemini are disabled by default (set ENABLE_OPENROUTER=true or ENABLE_GOOGLE_GEMINI=true to enable).';
  }

  throw new Error(`AI is temporarily busy — please wait 30 seconds and try again. (Tried: ${errorDetail})${hint}`);
}
