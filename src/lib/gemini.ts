// ============================================================================
// Groq API helper — Server-only module
// Uses Groq's OpenAI-compatible API. No Google/Gemini dependency.
// ============================================================================

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Model hierarchy: primary → fallback1 → fallback2 → fallback3
// Order by reliability for artifact generation (charts/tables need lots of tokens):
//   llama-3.1-8b-instant:    30k OTPM, very reliable, smaller model (no thinking leak)
//   llama-4-scout:            6k OTPM, better quality, sometimes rate-limited (no thinking leak)
//   llama-3.3-70b-versatile:  high quality, generous free-tier limits (no thinking leak)
//   qwen/qwen3.6-27b:         1k OTPM, REASONING MODEL (leaks thinking) — kept as last resort
//                            because it is the most accessible model on Groq free tier.
//                            The chat route's stripThinkingLines + cleanReplyText handle
//                            the thinking leak, so even when qwen is used the user sees
//                            a clean response (just potentially truncated artifacts).
const VISION_MODEL = 'qwen/qwen3.6-27b';

const CHAT_MODEL = 'llama-3.1-8b-instant';
const CHAT_MODEL_FALLBACK_1 = 'llama-4-scout-17b-16e-instruct';
const CHAT_MODEL_FALLBACK_2 = 'llama-3.3-70b-versatile';
const CHAT_MODEL_FALLBACK_3 = 'qwen/qwen3.6-27b'; // last resort — reasoning model, cleanup handles leak

// Groq free tier (on_demand) output token limits per minute:
//   llama-3.1-8b-instant:     ~30,000 OTPM  (highest, most reliable)
//   llama-4-scout:             ~6,000 OTPM
//   llama-3.3-70b-versatile:   generous (no hard cap observed in practice)
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
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
    { model: CHAT_MODEL, maxTokens: MAX_TOKENS_HIGH },            // llama-3.1-8b-instant: 30k OTPM → 4096 output tokens
    { model: CHAT_MODEL_FALLBACK_1, maxTokens: MAX_TOKENS_HIGH }, // llama-4-scout: 6k OTPM → 4096 output tokens
    { model: CHAT_MODEL_FALLBACK_2, maxTokens: MAX_TOKENS_HIGH }, // llama-3.3-70b-versatile: high quality, no thinking leak
    { model: CHAT_MODEL_FALLBACK_3, maxTokens: MAX_TOKENS_LOW }, // qwen3.6-27b: reasoning model — last resort, cleanup handles thinking
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

    for (const { model, maxTokens } of modelConfigs) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            const delay = getRetryDelay(attempt);
            console.warn(`[gemini] Retrying ${model} after rate limit (attempt ${attempt}/${MAX_RETRIES}, waiting ${delay}ms)...`);
            await sleep(delay);
          }

          const res = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: openaiMessages,
              max_tokens: maxTokens,
              temperature: 0.7,
            }),
          });

          if (res.status === 404 || res.status === 422) {
            const errText = await res.text();
            console.warn(`[gemini] Model ${model} unavailable (${res.status}), trying next...`);
            triedModels.push(model);
            break; // break retry loop, try next model
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
