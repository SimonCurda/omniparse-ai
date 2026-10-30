import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildVlmPrompt, CHAT_SYSTEM_PROMPT, buildInvoiceContext } from '@/lib/ai-prompts';
import {
  callSpecificModel,
  getProviderKeyCounts,
  extractJsonBlock,
  type TesterProvider,
} from '@/lib/model-tester';
import { resizeForVisionAI } from '@/lib/image-resize';
import { renderPdfFirstPageToPng } from '@/lib/pdf-to-image';

// ─── Admin Model Tester ─────────────────────────────────────────────────────
// GET  /api/admin/model-tester?key=CRON_SECRET
//   → the model catalog per provider (live from Mistral/Groq where possible)
//     with "in production cascade" flags, plus configured key counts.
//
// POST /api/admin/model-tester?key=CRON_SECRET
//   → runs ONE test against ONE specific model. Two modes:
//
//   mode=parse  (multipart/form-data): fields provider, model, file
//     Upload an invoice image (or PDF → first page rendered) → runs the
//     EXACT production extraction prompt through the chosen model → returns
//     raw text + lightly-parsed fields + latency.
//
//   mode=chat   (application/json): { provider, model, accountId?, messages }
//     Chat with the chosen model using the EXACT production chatbot system
//     prompt. When accountId is set, the account's last 100 invoices are
//     rendered into the context (same as production) so the chatbot can be
//     evaluated on real data.
//
// Auth: CRON_SECRET query param, same as the other admin routes.

// Production cascade membership (mirrors src/lib/gemini.ts) — used to flag
// which catalog models are already part of the production cascade.
const PRODUCTION_MODELS: Record<TesterProvider, Set<string>> = {
  mistral: new Set([
    // vision cascade
    'pixtral-12b-latest', 'pixtral-12b-2409', 'pixtral-large-2411',
    'mistral-small-latest', 'mistral-medium-latest',
    // text cascade
    'open-mistral-7b', 'open-mixtral-8x7b', 'open-mixtral-8x22b',
    'ministral-3b-latest', 'ministral-8b-latest',
  ]),
  groq: new Set([
    'openai/gpt-oss-20b', 'openai/gpt-oss-120b',
    'llama-3.1-8b-instant', 'llama-3.3-70b-versatile',
    'llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview',
  ]),
  openrouter: new Set([
    'inclusionai/ling-3.0-flash-vl:free', 'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free', 'nex-agi/nex-n2.5-pro:free',
    'thinkingmachines/inkling:free', 'nex-agi/nex-n2.5-mini:free',
    'thinkingmachines/inkling-small:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'inclusionai/ling-3.0-flash-fin:free',
    'nvidia/llama-3.1-nemotron-70b-instruct:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'mistralai/mistral-7b-instruct:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'nvidia/nemotron-3.5-lightning:free',
    'poolside/laguna-s-2.1:free', 'poolside/laguna-xs-2.1:free',
    'inclusionai/ling-3.0-flash-sante:free',
    'openrouter/free',
  ]),
  google_gemini: new Set(['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash']),
};

// Static lists for providers without a cheap public catalog (OpenRouter's
// /models returns 300+ entries; Gemini's list needs a key and changes rarely).
const STATIC_OPENROUTER_MODELS: Array<{ id: string; vision: boolean }> = [
  { id: 'inclusionai/ling-3.0-flash-vl:free', vision: true },
  { id: 'google/gemma-4-31b-it:free', vision: true },
  { id: 'google/gemma-4-26b-a4b-it:free', vision: true },
  { id: 'nex-agi/nex-n2.5-pro:free', vision: true },
  { id: 'thinkingmachines/inkling:free', vision: true },
  { id: 'nex-agi/nex-n2.5-mini:free', vision: true },
  { id: 'thinkingmachines/inkling-small:free', vision: true },
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', vision: true },
  { id: 'openrouter/free', vision: true },
  { id: 'inclusionai/ling-3.0-flash-fin:free', vision: false },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', vision: false },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', vision: false },
  { id: 'mistralai/mistral-7b-instruct:free', vision: false },
  { id: 'qwen/qwen-2.5-72b-instruct:free', vision: false },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', vision: false },
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', vision: false },
  { id: 'nvidia/nemotron-3.5-lightning:free', vision: false },
  { id: 'poolside/laguna-s-2.1:free', vision: false },
  { id: 'poolside/laguna-xs-2.1:free', vision: false },
  { id: 'inclusionai/ling-3.0-flash-sante:free', vision: false },
];

const STATIC_GEMINI_MODELS: Array<{ id: string; vision: boolean }> = [
  { id: 'gemini-2.0-flash', vision: true },
  { id: 'gemini-2.5-flash', vision: true },
  { id: 'gemini-1.5-flash', vision: true },
];

function isVisionModelId(provider: TesterProvider, modelId: string): boolean {
  const id = modelId.toLowerCase();
  if (provider === 'mistral') return id.startsWith('pixtral');
  if (provider === 'groq') return id.includes('vision');
  if (provider === 'openrouter')
    return id.includes('vl') || id.includes('vision') || id.includes('omni') || id === 'openrouter/free';
  return true; // gemini flash models are all multimodal
}

function authenticate(req: NextRequest): boolean {
  const key = new URL(req.url).searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return !!key && key === cronSecret;
}

// ─── Catalog helpers (same endpoints/filters as model-health-check) ─────────

async function fetchMistralCatalog(): Promise<string[]> {
  try {
    const key = process.env.MISTRAL_API_KEY;
    if (!key) return [];
    const res = await fetch('https://api.mistral.ai/v1/models', {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => ({ data: [] }))) as {
      data?: Array<{ id?: string; capabilities?: { completion_chat?: boolean } }>;
    };
    return (data.data || [])
      .filter((r) => r?.capabilities?.completion_chat === true && r.id)
      .map((r) => String(r.id));
  } catch {
    return [];
  }
}

async function fetchGroqCatalog(): Promise<string[]> {
  try {
    const key = process.env.GROQ_API_KEY;
    if (!key) return [];
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => ({ data: [] }))) as {
      data?: Array<{ id?: string; active?: boolean }>;
    };
    const EXCLUDE = /whisper|guard|tts|embed|moderation|orpheus|allam|canopylabs|qwen3\.8|leanstral|mistral-code|codestral|fim/i;
    return (data.data || [])
      .filter((r) => r.active !== false && r.id && !EXCLUDE.test(r.id))
      .map((r) => String(r.id));
  } catch {
    return [];
  }
}

function toCatalogEntry(provider: TesterProvider, id: string) {
  return {
    id,
    inProduction: PRODUCTION_MODELS[provider].has(id),
    vision: isVisionModelId(provider, id),
  };
}

export async function GET(req: NextRequest) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [mistralIds, groqIds] = await Promise.all([fetchMistralCatalog(), fetchGroqCatalog()]);

  const catalog = {
    mistral: mistralIds.map((id) => toCatalogEntry('mistral', id)),
    groq: groqIds.map((id) => toCatalogEntry('groq', id)),
    openrouter: STATIC_OPENROUTER_MODELS.map((m) => ({
      ...toCatalogEntry('openrouter', m.id),
      vision: m.vision,
    })),
    google_gemini: STATIC_GEMINI_MODELS.map((m) => ({
      ...toCatalogEntry('google_gemini', m.id),
      vision: m.vision,
    })),
  };

  return NextResponse.json({
    catalog,
    keys: getProviderKeyCounts(),
    note:
      'Mistral/Groq lists are fetched live from the provider catalog. OpenRouter/Gemini show the production set + can be overridden with a custom model ID.',
  });
}

// ─── POST: run a test ───────────────────────────────────────────────────────

const VALID_PROVIDERS: TesterProvider[] = ['mistral', 'groq', 'openrouter', 'google_gemini'];

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentType = req.headers.get('content-type') || '';

  try {
    // ─── Parse mode (multipart/form-data with a file) ────────────────────
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const provider = String(form.get('provider') || '') as TesterProvider;
      const model = String(form.get('model') || '').trim();
      const file = form.get('file');

      if (!VALID_PROVIDERS.includes(provider)) {
        return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
      }
      if (!model) {
        return NextResponse.json({ error: 'Model is required' }, { status: 400 });
      }
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const mime = file.type || 'application/octet-stream';
      const isPdf = mime === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = mime.startsWith('image/');

      let visionBuffer: Buffer;
      let visionMime: string;

      if (isPdf) {
        const png = await renderPdfFirstPageToPng(buffer);
        if (!png) {
          return NextResponse.json(
            {
              error:
                'PDF first-page rendering is unavailable on this deployment — upload an image (JPG/PNG/WebP) instead.',
            },
            { status: 400 },
          );
        }
        visionBuffer = png;
        visionMime = 'image/png';
      } else if (isImage) {
        const resized = await resizeForVisionAI(buffer, mime);
        visionBuffer = resized.buffer;
        visionMime = resized.mimeType;
      } else {
        return NextResponse.json(
          { error: `Unsupported file type: ${mime}. Upload an image or PDF.` },
          { status: 400 },
        );
      }

      const dataUri = `data:${visionMime};base64,${visionBuffer.toString('base64')}`;
      const prompt = buildVlmPrompt(''); // production prompt, no custom fields

      const isVision = isVisionModelId(provider, model);
      // The image is always attached (OpenAI-compatible image_url) — vision
      // models consume it; text-only models will either tolerate or reject
      // it, which is exactly what the admin wants to learn from the test.
      const messages = [
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: prompt },
            { type: 'image_url' as const, image_url: { url: dataUri } },
          ],
        },
      ];

      const result = await callSpecificModel({
        provider,
        model,
        messages,
        temperature: 0.1, // production vision temperature
        maxTokens: 4096,
        jsonMode: true,
        isVisionModel: isVision,
      });

      const { parsed, error: parseError } = result.ok
        ? extractJsonBlock(result.text)
        : { parsed: null, error: undefined as string | undefined };

      return NextResponse.json({
        mode: 'parse',
        ok: result.ok,
        servedModel: result.servedModel,
        statusCode: result.statusCode,
        latencyMs: result.latencyMs,
        keyIndexUsed: result.keyIndexUsed,
        retriedWithoutJsonMode: result.retriedWithoutJsonMode,
        inputImageBytes: visionBuffer.length,
        inputImageMime: visionMime,
        rawText: result.text,
        parsed,
        parseError: parseError ?? null,
        error: result.error ?? null,
      });
    }

    // ─── Chat mode (application/json) ────────────────────────────────────
    const body = (await req.json()) as {
      provider?: string;
      model?: string;
      accountId?: string;
      messages?: ChatHistoryMessage[];
    };

    const provider = (body.provider || '') as TesterProvider;
    const model = (body.model || '').trim();
    const history = Array.isArray(body.messages) ? body.messages : [];

    if (!VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }
    if (!model) {
      return NextResponse.json({ error: 'Model is required' }, { status: 400 });
    }
    if (history.length === 0 || history[history.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from the user' }, { status: 400 });
    }
    if (history.length > 40) {
      return NextResponse.json({ error: 'Too many messages (max 40)' }, { status: 400 });
    }

    // Build the production system message: CHAT_SYSTEM_PROMPT + invoice
    // context from the selected account (mirrors /api/chat).
    let systemMessage: string;
    let contextInvoiceCount = 0;
    if (body.accountId) {
      const invoices = await db.invoice.findMany({
        where: { userId: body.accountId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true, vendor: true, invNumber: true, invDate: true,
          total: true, currency: true, confidence: true, isDuplicate: true,
          createdAt: true,
        },
      });
      const editedAuditRows = await db.auditLog.findMany({
        where: { userId: body.accountId, action: 'edited' },
        select: { invoiceId: true },
      });
      const editedInvoiceIds = new Set(
        editedAuditRows.map((r) => r.invoiceId).filter((id): id is string => !!id),
      );
      const invoicesForContext = (invoices as unknown as Array<Record<string, unknown>>).map((inv) => ({
        ...inv,
        manuallyEdited: editedInvoiceIds.has(inv.id as string),
      }));
      contextInvoiceCount = invoices.length;
      systemMessage =
        CHAT_SYSTEM_PROMPT + '\n\n' + buildInvoiceContext(invoicesForContext);
    } else {
      systemMessage =
        CHAT_SYSTEM_PROMPT +
        '\n\n' +
        'No invoice context loaded — no account was selected for this test. Answer invoice-domain questions generically.';
    }

    const messages = [
      { role: 'system' as const, content: systemMessage },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    // Production chat temperatures: Mistral text legs use 0.1, Groq/OpenRouter use 0.7.
    const temperature = provider === 'mistral' ? 0.1 : 0.7;

    // Production json-mode behaviour for chat — MUST mirror gemini.ts /
    // openrouter.ts, otherwise the tester reports failures that production
    // would never hit (or vice versa):
    //
    //   • Mistral chat NEVER uses json_mode in production. geminiChatCall
    //     builds the Mistral request body without `response_format` because
    //     the chatbot system prompt is conversational, not a strict JSON
    //     schema. Forcing json_object on it makes Mistral's validator reject
    //     the request with HTTP 422 — especially once a real account's
    //     invoice context is appended (the "how many invoices do I have"
    //     422 with 82 invoices in context). So Mistral chat = no json_mode.
    //
    //   • Groq & OpenRouter chat DO use json_mode in production — the
    //     chatbot prompt is written to make them emit a JSON envelope
    //     ({text, artifact}). model-tester.ts still retries once without
    //     json_mode on any 400/422, matching the production fallback.
    //
    //   • Gemini chat is left without json_mode — the chatbot prompt was
    //     never tuned for Gemini's `responseMimeType: application/json`.
    const chatJsonMode = provider === 'groq' || provider === 'openrouter';

    const result = await callSpecificModel({
      provider,
      model,
      messages,
      temperature,
      maxTokens: 4096,
      jsonMode: chatJsonMode,
    });

    const { parsed, error: parseError } = result.ok
      ? extractJsonBlock(result.text)
      : { parsed: null, error: undefined as string | undefined };

    return NextResponse.json({
      mode: 'chat',
      ok: result.ok,
      servedModel: result.servedModel,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      keyIndexUsed: result.keyIndexUsed,
      retriedWithoutJsonMode: result.retriedWithoutJsonMode,
      contextInvoiceCount,
      rawText: result.text,
      parsed,
      parseError: parseError ?? null,
      error: result.error ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Tester failed: ${message}` }, { status: 500 });
  }
}
