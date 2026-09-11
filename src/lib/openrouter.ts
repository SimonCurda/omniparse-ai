// ============================================================================
// OpenRouter API helper — Server-only module
// Uses OpenRouter's OpenAI-compatible API as a fallback when Groq is
// rate-limited. OpenRouter provides a separate quota pool, diversifying
// our AI supply so the chat keeps working even when Groq's daily quota
// is exhausted.
//
// ─── Multi-key support ──────────────────────────────────────────────────
// OpenRouter's free models have per-key daily quotas (typically 20-50
// requests/day per model per key). To get more total throughput, we
// support MULTIPLE API keys via OPENROUTER_API_KEY (primary) +
// OPENROUTER_API_KEY_2, OPENROUTER_API_KEY_3, OPENROUTER_API_KEY_4,
// OPENROUTER_API_KEY_5 (additional keys).
//
// When a request fails with 429 (rate limited) or 402 (quota exceeded),
// we automatically rotate to the next key. This effectively multiplies
// our total daily quota by the number of keys configured.
//
// OpenRouter supports a `fallbacks` array — we send ONE API call with a
// primary model and a list of fallbacks, and OpenRouter routes internally
// to whichever model is available. This is more efficient than us calling
// each model separately (1 API call vs N API calls).
// ============================================================================

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Model cascade on OpenRouter (tried in order via `fallbacks` array):
//   1. inclusionai/ling-3.0-flash-fin:free — finance-focused MoE model,
//      124B total / 5.1B active. Should be excellent for invoice analysis.
//   2. nvidia/llama-3.1-nemotron-70b-instruct:free — NVIDIA's instruction-tuned
//      Llama 3.1, reliable for chat and structured output.
//
// All are free on OpenRouter. If Ling fails (rate-limited or down),
// OpenRouter automatically tries each fallback in order. If all fail,
// OpenRouter returns an error and the chat route shows the error.
//
// We include ALL useful free text models on OpenRouter to maximize
// the number of quota pools we draw from. Each free model has its own
// daily quota (typically 20-50 requests/day), so more models = more
// total requests before hitting limits.
const OPENROUTER_PRIMARY_MODEL = 'inclusionai/ling-3.0-flash-fin:free';
const OPENROUTER_FALLBACK_MODELS = [
  'nvidia/llama-3.1-nemotron-70b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'nvidia/nemotron-3-super-120b-a12b:free',       // 120B, 262K context
  'nvidia/nemotron-3-ultra-550b-a55b:free',        // 550B, 1M context
  'nvidia/nemotron-3.5-lightning:free',            // Fast, 1M context
  'poolside/laguna-s-2.1:free',                    // 262K context
  'poolside/laguna-xs-2.1:free',                   // 262K context
  'inclusionai/ling-3.0-flash-sante:free',         // Health-focused variant
  'openrouter/free',                                // Auto-router: picks any available free model
];

const MAX_TOKENS = 4096;       // enough for chat + medium-sized artifacts
const TEMPERATURE = 0.7;       // matches Groq chat temperature

// ─── Multi-key support ──────────────────────────────────────────────────
// Collect all configured OpenRouter API keys. The primary key
// (OPENROUTER_API_KEY) is always first; additional keys
// (OPENROUTER_API_KEY_2, _3, _4, _5) are appended if present.
//
// We rotate keys on 429/402 errors to distribute load across quota pools.
function getAllApiKeys(): string[] {
  const keys: string[] = [];
  const primary = process.env.OPENROUTER_API_KEY;
  if (primary) keys.push(primary);
  // Additional keys — up to 5 total
  for (let i = 2; i <= 5; i++) {
    const k = process.env[`OPENROUTER_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

// Track which key index we're currently using (round-robin starting point).
// This is per-instance (per serverless function invocation) — each new
// invocation starts from key 0.
let currentKeyIndex = 0;

function getNextApiKey(): string {
  const keys = getAllApiKeys();
  if (keys.length === 0) {
    throw new Error('No OpenRouter API keys configured. Set OPENROUTER_API_KEY in your Vercel environment variables.');
  }
  // Round-robin: advance the index so consecutive calls use different keys,
  // distributing load across quota pools.
  const key = keys[currentKeyIndex % keys.length];
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return key;
}

/**
 * Try to get an API key, rotating through all configured keys.
 * Used by callers that need to try each key in sequence when one is rate-limited.
 */
function getAllKeysForRetry(): string[] {
  const keys = getAllApiKeys();
  if (keys.length === 0) {
    throw new Error('No OpenRouter API keys configured. Set OPENROUTER_API_KEY in your Vercel environment variables.');
  }
  // Start from the current index and wrap around so we try all keys
  const result: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    result.push(keys[(currentKeyIndex + i) % keys.length]);
  }
  return result;
}

// Legacy API — returns the primary key. Kept for backward compat.
function getApiKey(): string {
  return getNextApiKey();
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Call OpenRouter with text-only chat, using JSON mode + automatic fallbacks.
 *
 * If OPENROUTER_API_KEY is not set, this throws immediately so the caller can
 * show a graceful error rather than making a doomed API call.
 *
 * @returns The model's response text (JSON-mode structured response as a string)
 */
export async function openRouterChatCall(
  systemPrompt: string,
  messages: OpenRouterMessage[],
): Promise<string> {
  const apiKey = getApiKey();

  const openaiMessages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const requestBody: Record<string, unknown> = {
    model: OPENROUTER_PRIMARY_MODEL,
    fallbacks: OPENROUTER_FALLBACK_MODELS,
    messages: openaiMessages,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    response_format: { type: 'json_object' },
  };

  // OpenRouter requires HTTP-Referer and X-Title headers for analytics/attribution
  // (optional but recommended). We use the Vercel URL if available, fall back to
  // a generic string otherwise.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://omniparse-ai.vercel.app';

  const res = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': appUrl,
      'X-Title': 'OmniParse AI',
    },
    body: JSON.stringify(requestBody),
  });

  if (res.status === 401 || res.status === 403) {
    const errText = await res.text();
    throw new Error(`OpenRouter auth error (${res.status}): ${errText}`);
  }

  // 400 errors from OpenRouter. Two cases to handle:
  //   1. json_validate_failed — model accepted JSON mode but couldn't produce valid JSON
  //   2. "does not support feature: structured-outputs" — provider (e.g. Novita/Ling)
  //      doesn't support response_format at all
  // Both cases: retry WITHOUT response_format (free-text mode + regex cleanup).
  if (res.status === 400) {
    const errText = await res.text();
    const isJsonValidateFailure = errText.includes('json_validate_failed');
    const isStructuredOutputsUnsupported = errText.includes('does not support feature: structured-outputs')
      || errText.includes('structured-outputs')
      || errText.includes('INVALID_REQUEST_BODY');

    if (isJsonValidateFailure || isStructuredOutputsUnsupported) {
      console.warn(`[openrouter] 400 — retrying WITHOUT response_format. Reason: ${
        isJsonValidateFailure ? 'json_validate_failed' : 'structured-outputs not supported'
      }`);
      const fallbackBody: Record<string, unknown> = {
        model: OPENROUTER_PRIMARY_MODEL,
        fallbacks: OPENROUTER_FALLBACK_MODELS,
        messages: openaiMessages,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        // No response_format — free-text mode
      };
      const fallbackRes = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': appUrl,
          'X-Title': 'OmniParse AI',
        },
        body: JSON.stringify(fallbackBody),
      });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        return fallbackData.choices?.[0]?.message?.content || '';
      }
      const fbErrText = await fallbackRes.text().catch(() => '');
      throw new Error(`OpenRouter API error after JSON-mode fallback (${fallbackRes.status}): ${fbErrText}`);
    }
    throw new Error(`OpenRouter API error (400): ${errText}`);
  }

  if (res.status === 422) {
    // OpenRouter returned 422 — likely JSON mode not supported by the chosen model(s).
    // Retry WITHOUT response_format. Free-text mode + regex cleanup in chat/route.ts
    // will handle any thinking leak.
    console.warn('[openrouter] JSON mode rejected (422). Retrying WITHOUT response_format...');
    const fallbackBody: Record<string, unknown> = {
      model: OPENROUTER_PRIMARY_MODEL,
      fallbacks: OPENROUTER_FALLBACK_MODELS,
      messages: openaiMessages,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      // No response_format — free-text mode
    };
    const fallbackRes = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': appUrl,
        'X-Title': 'OmniParse AI',
      },
      body: JSON.stringify(fallbackBody),
    });
    if (!fallbackRes.ok) {
      const errText = await fallbackRes.text();
      throw new Error(`OpenRouter API error after JSON-mode fallback (${fallbackRes.status}): ${errText}`);
    }
    const fallbackData = await fallbackRes.json();
    return fallbackData.choices?.[0]?.message?.content || '';
  }

  if (res.status === 429 || res.status === 402) {
    // Rate limited or quota exceeded on this key — try the next key if we have one
    const allKeys = getAllKeysForRetry();
    if (allKeys.length > 1) {
      const errText = await res.text().catch(() => '');
      console.warn(`[openrouter] Key #${(currentKeyIndex - 1 + allKeys.length) % allKeys.length + 1} rate limited (${res.status}). Rotating to next key...`);
      // Try each remaining key
      for (let i = 1; i < allKeys.length; i++) {
        const nextKey = allKeys[i];
        console.warn(`[openrouter] Trying key #${i + 1}...`);
        const retryRes = await fetch(OPENROUTER_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${nextKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': appUrl,
            'X-Title': 'OmniParse AI',
          },
          body: JSON.stringify(requestBody),
        });
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          const content = retryData.choices?.[0]?.message?.content || '';
          if (content) {
            console.warn(`[openrouter] Key #${i + 1} succeeded!`);
            return content;
          }
        }
        if (retryRes.status !== 429 && retryRes.status !== 402) {
          // Different error — stop rotating and let the caller handle it
          const retryErrText = await retryRes.text().catch(() => '');
          throw new Error(`OpenRouter API error with key #${i + 1} (${retryRes.status}): ${retryErrText}`);
        }
        // 429/402 again — try next key
      }
      // All keys exhausted
      throw new Error(`OpenRouter rate limited (429) on all ${allKeys.length} keys: ${errText}`);
    }
    const errText = await res.text();
    throw new Error(`OpenRouter rate limited (429): ${errText}`);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Get all configured OpenRouter API keys for external use (e.g., the vision
 * call in gemini.ts needs to try each key when one is rate-limited).
 * Returns keys in round-robin order starting from the current index.
 */
export function getOpenRouterApiKeys(): string[] {
  return getAllKeysForRetry();
}

/**
 * Quick check whether OpenRouter is configured (at least one API key present).
 * Used by the chat route to decide whether to call OpenRouter at all.
 */
export function isOpenRouterConfigured(): boolean {
  return getAllApiKeys().length > 0;
}
