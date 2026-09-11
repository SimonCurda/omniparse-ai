// ============================================================================
// Groq API helper — Server-only module
// Uses Groq's OpenAI-compatible API. No Google/Gemini dependency.
// ============================================================================

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Model hierarchy: primary → fallback1 → fallback2
// Order by reliability for artifact generation (charts/tables need lots of tokens):
//   llama-3.1-8b-instant:    30k OTPM, very reliable, smaller model (no thinking leak)
//   llama-4-scout:            6k OTPM, better quality, sometimes rate-limited (no thinking leak)
//   qwen/qwen3.6-27b:         1k OTPM, REASONING MODEL (leaks thinking) — last resort
//                            because it is the most accessible model on Groq free tier.
//                            The chat route's stripThinkingLines + cleanReplyText handle
//                            the thinking leak, so even when qwen is used the user sees
//                            a clean response (just potentially truncated artifacts).
//
// NOTE: llama-3.3-70b-versatile and llama-3.1-70b-versatile were both REMOVED from the
// cascade — Groq has decommissioned both. If Groq reintroduces a 70b llama variant
// (check https://console.groq.com/docs/deprecations), it can be re-added here.
const VISION_MODEL = 'qwen/qwen3.6-27b';

const CHAT_MODEL = 'llama-3.1-8b-instant';
const CHAT_MODEL_FALLBACK_1 = 'llama-4-scout-17b-16e-instruct';
const CHAT_MODEL_FALLBACK_2 = 'qwen/qwen3.6-27b'; // last resort — reasoning model, cleanup handles leak

// Groq free tier (on_demand) output token limits per minute:
//   llama-3.1-8b-instant:     ~30,000 OTPM  (highest, most reliable)
//   llama-4-scout:             ~6,000 OTPM
//   qwen/qwen3.6-27b:          ~1,000 OTPM  (lowest, but always available)
// Max tokens per request: stay well under the per-minute limit.
// Responses with artifacts (tables/charts) need more tokens for the JSON.
const MAX_TOKENS_HIGH = 4096;    // llama-3.1-8b-instant, llama-4-scout, llama-3.3-70b
const MAX_TOKENS_LOW = 900;      // qwen — 1k OTPM limit, keep under (artifacts may truncate)

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
  const apiKey = getApiKey();

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

  // ─── Try Groq vision model first ──────────────────────────────────────
  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: openaiMessages,
        max_tokens: MAX_TOKENS_LOW,
        temperature: 0.1,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      if (content) return content;
    }

    // If Groq failed (429, 500, etc.), fall through to OpenRouter
    const errText = await res.text().catch(() => '');
    console.warn(`[gemini] Groq vision model ${VISION_MODEL} failed (${res.status}), falling back to OpenRouter vision models...`);
  } catch (err) {
    console.warn('[gemini] Groq vision call failed, falling back to OpenRouter...', err instanceof Error ? err.message : String(err));
  }

  // ─── Fall back to OpenRouter free vision models ────────────────────────
  // These models support image input and are free on OpenRouter.
  // We try them in order until one succeeds.
  const orApiKey = process.env.OPENROUTER_API_KEY;
  if (!orApiKey) {
    throw new Error('Both Groq vision and OpenRouter are unavailable. Set OPENROUTER_API_KEY for vision fallback.');
  }

  const openRouterVisionModels = [
    'inclusionai/ling-3.0-flash-vl:free',       // Finance-focused VL model, 262K context
    'google/gemma-4-26b-a4b-it:free',           // Google Gemma 4, 262K context
    'google/gemma-4-31b-it:free',               // Google Gemma 4 (larger), 262K context
    'nex-agi/nex-n2.5-pro:free',                // Nex AGI Pro, 262K context
    'thinkingmachines/inkling:free',             // Inkling, 1M context
    'nex-agi/nex-n2.5-mini:free',               // Nex AGI Mini, 262K context
    'thinkingmachines/inkling-small:free',       // Inkling Small, 1M context
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',  // Nemotron Omni, 256K
    'openrouter/free',                           // Auto-router: picks any available free vision model
  ];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://omniparse-ai.vercel.app';

  for (const model of openRouterVisionModels) {
    try {
      console.warn(`[gemini] Trying OpenRouter vision model: ${model}...`);
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
          // Request JSON output format — many OpenRouter models support this
          // even for vision tasks. If the model doesn't support it, OpenRouter
          // will return a 400/422 and we fall through to the next model.
          response_format: { type: 'json_object' },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        if (content) {
          console.warn(`[gemini] OpenRouter vision model ${model} succeeded (JSON mode)!`);
          return content;
        }
      }

      // If JSON mode failed (400/422), try the SAME model WITHOUT response_format
      // before moving to the next model in the cascade
      if (res.status === 400 || res.status === 422) {
        const errText = await res.text().catch(() => '');
        if (errText.includes('structured-outputs') || errText.includes('json_object') ||
            errText.includes('INVALID_REQUEST_BODY') || errText.includes('response_format')) {
          console.warn(`[gemini] ${model} doesn't support JSON mode. Retrying WITHOUT response_format...`);
          const fallbackRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
              // No response_format — free-text mode
            }),
          });
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            const fallbackContent = fallbackData.choices?.[0]?.message?.content || '';
            if (fallbackContent) {
              console.warn(`[gemini] OpenRouter vision ${model} succeeded (free-text mode)!`);
              return fallbackContent;
            }
          }
          console.warn(`[gemini] ${model} also failed in free-text mode (${fallbackRes.status})`);
          continue; // Move to next model
        }
      }

      // Rate limited or other error — move to next model
      const errText = await res.text().catch(() => '');
      console.warn(`[gemini] OpenRouter vision ${model} failed (${res.status})`);
    } catch (err) {
      console.warn(`[gemini] OpenRouter vision ${model} error:`, err instanceof Error ? err.message : String(err));
    }
  }

  throw new Error('All vision models (Groq + OpenRouter) are temporarily unavailable. Please try again in a moment.');
}

/**
 * Call Groq with text-only chat.
 * Tries models in order with retry on 429 rate limits.
 * Model cascade: llama-3.1-8b-instant → llama-4-scout → llama-3.3-70b → qwen/qwen3.6-27b
 */
export async function geminiChatCall(
  systemPrompt: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const apiKey = getApiKey();

  const openaiMessages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const modelConfigs = [
    // `supportsJsonMode` controls whether we set `response_format: { type: "json_object" }`
    // in the request body. JSON mode forces the model to output valid JSON only,
    // eliminating the "Thinking Process:" / "Output:" / "Draft:" leak class entirely.
    // All 3 chat models try JSON mode first. If a model returns 422 (JSON mode not
    // supported) or 400 (model_decommissioned), the request falls through to the
    // next model in the cascade. If JSON mode is supported but the model fails to
    // produce valid JSON (json_validate_failed), we retry without response_format.
    { model: CHAT_MODEL, maxTokens: MAX_TOKENS_HIGH, supportsJsonMode: true },            // llama-3.1-8b-instant
    { model: CHAT_MODEL_FALLBACK_1, maxTokens: MAX_TOKENS_HIGH, supportsJsonMode: true }, // llama-4-scout-17b-16e-instruct
    { model: CHAT_MODEL_FALLBACK_2, maxTokens: MAX_TOKENS_LOW, supportsJsonMode: true },  // qwen3.6-27b — try JSON mode, 422/400 fallback handles unsupported
  ];

  const triedModels: string[] = [];

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
            console.warn(`[gemini] Model ${model} unavailable (404), trying next...`);
            triedModels.push(model);
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

  throw new Error(`AI is temporarily busy. Please wait 30 seconds and try again. (Tried: ${triedModels.join(', ') || 'all models'})`);
}
