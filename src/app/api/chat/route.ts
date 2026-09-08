import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, PLAN_CHAT_LIMITS } from '@/lib/auth';
import { chatSchema, getClientIp } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import type { Artifact } from '@/stores/app-store';
import { geminiChatCall } from '@/lib/gemini';

// ─── Prompt Injection Detection ─────────────────────────────────────────────
// Only catches clear, unambiguous attacks on the system prompt.
// Kept minimal to avoid false positives on normal invoice questions.

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+(instructions?|prompts?|rules?|directives?)/i,
  /system\s*prompt/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /roleplay\s+(as|you)/i,
  /forget\s+(everything|all)\s+(instructions?|rules?|prompts?)/i,
  /override\s+(instructions?|rules?|system)/i,
  /<<<ARTIFACT/i,
  /reveal\s+(your|the)\s+(system|instructions?|prompt)/i,
  /repeat\s+(your|the)\s+(system|instructions?|prompt)/i,
  /what\s+(are|is)\s+your\s+(system\s+prompt|instructions?)/i,
  /output\s+(your|the)\s+(system|instructions?|prompt)/i,
  /dump\s+(your|the)\s+(system|instructions?|prompt)/i,
  /show\s+(me\s+)?your\s+(instructions?|prompt)/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /write\s+(code|a\s+script)\s+to\s+(extract|get|read|show|dump)\s+(the\s+)?(system|prompt|instructions)/i,
];

function detectPromptInjection(message: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(message));
}

// ─── System Prompt (purely positive framing) ────────────────────────────────
// KEY: No negative language ("only", "must not", "refuse", "cannot").
// Small models obey positive instructions far better than restrictions.

const SYSTEM_PROMPT = `You are OmniParse Invoice Assistant. You answer questions about the user's invoice data and generate tables, charts, and summaries when asked.

You help with:
- Summaries, totals, averages, and breakdowns of invoice data
- Vendor analysis, duplicate detection, confidence scores
- Tables, charts, and visual artifacts about invoices
- Identifying and grouping duplicate invoices
- Any question that references the user's invoices, vendors, amounts, or data

When the user asks for a table, chart, or summary, generate an artifact:

<<<ARTIFACT>>>  {json}  <<<END_ARTIFACT>>>

Artifact types:
- { "type": "table", "title": "...", "data": { "columns": [...], "rows": [{...}] } }
- { "type": "chart-bar", "title": "...", "data": { "data": [{...}], "xKey": "...", "yKeys": [...], "colors": [...] } }
- { "type": "chart-line", "title": "...", "data": { "data": [{...}], "xKey": "...", "yKeys": [...], "colors": [...] } }
- { "type": "chart-pie", "title": "...", "data": { "data": [{...}], "nameKey": "...", "valueKey": "...", "colors": [...] } }
- { "type": "summary", "title": "...", "data": { "metrics": [{"label":"...","value":"...","description":"..."}] } }

When asked about duplicates:
- Group invoices that share the same vendor + invoice number + date
- List each group with all matching invoice IDs and amounts
- Note any amount discrepancies within a group (likely parsing errors)
- Generate a table artifact with columns: Vendor, Invoice #, Date, Amount, Count, IDs

Style:
- **Bold** key numbers, use bullet lists for breakdowns
- Short answers: 2-4 sentences for simple questions, bullet list for summaries
- Give the answer directly — skip "Here is" or "Sure"
- Use exact amounts from the data, round to 2 decimal places

OUTPUT FORMAT — CRITICAL:
- Start with the answer immediately. Never write your reasoning, planning, or thinking process.
- Do NOT write things like "The user wants...", "I need to look at...", "Let me check...", "I should generate...", "Let's prepare the artifact.", "Wait, the prompt says...".
- If generating an artifact, output ONLY the artifact block (with <<<ARTIFACT>>> markers) and an optional one-sentence intro. Nothing else.

GOOD example:
  Here are the duplicates:
  <<<ARTIFACT>>>{"type":"table","title":"Duplicate Invoices","data":{"columns":["Vendor","Invoice #","Date","Amount","Count","IDs"],"rows":[{"Vendor":"Acme Corp","Invoice #":"INV-100","Date":"2026-07-02","Amount":"$1,234.56","Count":"3","IDs":"abc, def, ghi"}]}}<<<END_ARTIFACT>>>

BAD example (NEVER do this):
  The user wants to see duplicates. I need to look at the duplicate groups. There is one group: Acme Corp. Let me prepare the artifact. { "type": "table", ...

If you cannot answer, say so briefly. Never narrate your thought process.`;

function buildInvoiceContext(invoices: Array<Record<string, unknown>>): string {
  if (invoices.length === 0) return 'No invoices have been parsed yet. Upload documents to get started.';

  const totalAmount = invoices.reduce((s, inv) => s + ((inv.total as number) ?? 0), 0);
  const avgConfidence = invoices.reduce((s, inv) => s + ((inv.confidence as number) ?? 0), 0) / invoices.length;
  const duplicateInvoices = invoices.filter((inv) => inv.isDuplicate);
  const duplicateCount = duplicateInvoices.length;

  const vendorTotals: Record<string, { count: number; total: number }> = {};
  for (const inv of invoices) {
    const v = (inv.vendor as string) ?? 'Unknown';
    if (!vendorTotals[v]) vendorTotals[v] = { count: 0, total: 0 };
    vendorTotals[v].count++;
    vendorTotals[v].total += (inv.total as number) ?? 0;
  }
  const vendorSummary = Object.entries(vendorTotals)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, data]) => `  - ${name}: ${data.count} invoice(s), total $${data.total.toFixed(2)}`)
    .join('\n');

  const invoiceList = invoices.map((inv) =>
    `  [${inv.id}] ${inv.vendor ?? 'Unknown'} | ${inv.invNumber ?? 'N/A'} | ${inv.invDate ?? 'N/A'} | $${((inv.total as number) ?? 0).toFixed(2)} | conf: ${(((inv.confidence as number) ?? 0) * 100).toFixed(0)}%${inv.isDuplicate ? ' | DUPLICATE' : ''}`
  ).join('\n');

  // Build duplicate groups — group by vendor+invNumber+invDate for the AI
  let duplicateSection = '';
  if (duplicateCount > 0) {
    const groups: Record<string, Array<{ id: string; total: number }>> = {};
    for (const inv of duplicateInvoices) {
      const key = `${inv.vendor ?? 'Unknown'}|${inv.invNumber ?? 'N/A'}|${inv.invDate ?? 'N/A'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ id: inv.id as string, total: (inv.total as number) ?? 0 });
    }
    // Also find non-flagged invoices that share the same key (originals of duplicates)
    for (const inv of invoices) {
      if (inv.isDuplicate) continue;
      const key = `${inv.vendor ?? 'Unknown'}|${inv.invNumber ?? 'N/A'}|${inv.invDate ?? 'N/A'}`;
      if (groups[key] && !groups[key].some((g) => g.id === inv.id)) {
        groups[key].push({ id: inv.id as string, total: (inv.total as number) ?? 0 });
      }
    }
    duplicateSection = '\nDuplicate Groups:\n' + Object.entries(groups)
      .filter(([, ids]) => ids.length > 1)
      .map(([key, ids]) => {
        const [vendor, invNum, date] = key.split('|');
        const amounts = ids.map((i) => `$${i.total.toFixed(2)}`).join(', ');
        const hasMismatch = new Set(ids.map((i) => i.total)).size > 1;
        return `  - ${vendor} | ${invNum} | ${date}: ${ids.length} copies (amounts: ${amounts})${hasMismatch ? ' ⚠️ AMOUNT MISMATCH' : ''}`;
      })
      .join('\n');
  }

  return `Current invoice data (${invoices.length} total):

Summary:
  - Total amount: $${totalAmount.toFixed(2)}
  - Average confidence: ${(avgConfidence * 100).toFixed(1)}%
  - Duplicates detected: ${duplicateCount}

By Vendor:
${vendorSummary}
${duplicateSection}
All Invoices:
${invoiceList}`;
}

/**
 * Aggressively clean reply text of any artifact-related content.
 * Runs AFTER artifact extraction to ensure no JSON/markers leak into chat.
 */
function cleanReplyText(reply: string): string {
  let clean = reply;

  // Remove <<<ARTIFACT>>>...<<<END_ARTIFACT>>> blocks
  clean = clean.replace(/<<<ARTIFACT>>>[\s\S]*?<<<END_ARTIFACT>>>/g, '');
  // Remove orphaned opening marker + everything after
  clean = clean.replace(/<<<ARTIFACT>>>[\s\S]*/g, '');
  // Remove orphaned closing marker
  clean = clean.replace(/<<<END_ARTIFACT>>>/g, '');

  // Remove fenced code blocks that contain artifact JSON
  clean = clean.replace(/```(?:json)?\s*\n[\s\S]*?```/g, (match) => {
    // Only remove if it looks like artifact JSON
    if (match.includes('"type"') && (match.includes('"data"') || match.includes('"columns"'))) {
      return '';
    }
    return match;
  });

  // Remove raw JSON objects that look like artifacts ({"type": "chart-bar", ...})
  // This regex is greedy within a single { } block
  clean = clean.replace(/\{[^{}]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[^{}]*\}/g, '');
  // Also handle nested JSON with one level of nesting
  clean = clean.replace(/\{[^{]*\{[^}]*\}[^}]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[^}]*\}/g, '');
  clean = clean.replace(/\{[^{]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[^{]*\{[^}]*\}[^}]*\}/g, '');

  // Remove INLINE partial artifact JSON that the model wrote as prose,
  // e.g. "Let's prepare the artifact. { "type": "table", "title": "...", "data": { ..."
  // This happens when reasoning models don't use the <<<ARTIFACT>>> markers.
  // Strip from the first occurrence of `{ "type": "..."` or `{"type":"..."` to end of message.
  clean = clean.replace(/\s*\{[\s\n]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[\s\S]*$/g, '');
  // Also strip the lead-in "Let's prepare the artifact." / "Here is the artifact:" type sentences
  clean = clean.replace(/^(let's|here is|here's|i'll|now i|i will)\s+(prepare|generate|create|build|show|format|present)\s+(the\s+)?(artifact|table|chart|summary)[.!:?\s]*$/gim, '');

  // Clean up multiple blank lines left by removals
  clean = clean.replace(/\n{3,}/g, '\n\n');

  return clean.trim();
}

// ─── Strip AI "thinking out loud" ──────────────────────────────────────────
// Small models sometimes leak their reasoning/thinking into the response:
// "The user wants to see duplicates. I need to look at... Let's prepare the artifact."
// This function aggressively strips ALL lines that match thinking patterns,
// not just leading paragraphs (which is what the previous version did).
//
// Strategy: scan every line; drop any line that matches a thinking-out-loud
// pattern. Then collapse resulting blank-line gaps. If what's left is mostly
// empty, the model was 100% thinking — return empty string and let the
// caller decide what to do (e.g. show a "AI got cut off" fallback).

const THINKING_PATTERNS = [
  // First-person reasoning
  /^\s*i\s+(need to|should|will|must|have to|want to|am going to|shall|consider|would|think|assume|notice|see|note|realize|observe)\b/i,
  /^\s*i'll\s/i,
  /^\s*i'd\s/i,
  // Conversational reasoning about the user/task
  /^\s*(the user|the customer|they)\s+(wants?|is asking|asked|needs?|requested|wrote|said|provided)\b/i,
  // Self-talk imperatives
  /^\s*let me\s/i,
  /^\s*let's\s/i,
  /^\s*let us\s/i,
  // Reasoning transitions
  /^\s*first[,:]\s/i,
  /^\s*next[,:]\s/i,
  /^\s*then[,:]\s/i,
  /^\s*finally[,:]\s/i,
  /^\s*so[,:]\s/i,
  /^\s*now\s+(i|let|we|the)\s/i,
  /^\s*wait[,:]\s/i,
  /^\s*actually[,:]\s/i,
  /^\s*hmm[,:]\s/i,
  /^\s*ok[,:]\s/i,
  /^\s*alright[,:]\s/i,
  // Reasoning about data/context
  /^\s*looking at\s/i,
  /^\s*checking\s/i,
  /^\s*based on\s/i,
  /^\s*according to\s/i,
  /^\s*to answer\s/i,
  /^\s*to (show|find|identify|list|generate|create|provide|format|construct|build|prepare)\s/i,
  /^\s*the (data|context|information|prompt|instructions?|response|answer)\s+(shows?|says?|provides?|contains?|indicates?|tells|asks?|wants?)\s/i,
  /^\s*from the\s/i,
  /^\s*in the\s+(data|list|provided|invoice|context|prompt)\s/i,
  /^\s*there (is|are)\s/i,
  /^\s*we (have|can|need|should|will|must)\s/i,
  /^\s*my approach\s/i,
  // Artifact-preparation monologue (the model describing how it will build the artifact)
  /^\s*columns?\s*[:=]\s/i,
  /^\s*rows?\s*[:=]\s/i,
  /^\s*artifact\s*[:=]\s/i,
  /^\s*prepare\s+the\s+artifact/i,
  /^\s*construct\s+the\s+/i,
  /^\s*format\s+the\s+(table|chart|artifact)/i,
];

/**
 * Aggressively strip AI "thinking out loud" from the entire reply.
 *
 * Previous version only stripped leading paragraphs. That failed when the
 * entire reply was thinking (which happens with reasoning models like qwen3).
 * This version scans every line and drops any that match a thinking pattern.
 *
 * Preserves bullets, bold lines, numbered lines, currency lines, and short
 * lines (which are typically real content like "Yes." or "No duplicates found.").
 */
function stripThinkingLines(reply: string): string {
  if (!reply || reply.length < 20) return reply;

  const lines = reply.split('\n');
  const kept: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Always keep blank lines (for paragraph structure)
    if (!trimmed) {
      kept.push(line);
      continue;
    }

    // Don't strip artifact markers (<<<ARTIFACT>>>...<<<END_ARTIFACT>>>)
    if (trimmed.startsWith('<<<ARTIFACT>>>') || trimmed.startsWith('<<<END_ARTIFACT>>>')) {
      kept.push(line);
      continue;
    }

    // Don't strip real content (bullets, bold, numbers, currency, headings, code fences)
    const isContent =
      /^[-*•]\s/.test(trimmed) ||       // bullet list
      /^\d+[.)]\s/.test(trimmed) ||     // numbered list
      /^\*\*/.test(trimmed) ||          // bold markdown
      /^#{1,6}\s/.test(trimmed) ||      // heading
      /^```/.test(trimmed) ||           // code fence
      /^\$/.test(trimmed) ||            // currency line
      /^\|/.test(trimmed) ||            // markdown table row
      trimmed.startsWith('<<<');       // artifact markers

    if (isContent) {
      kept.push(line);
      continue;
    }

    // Drop lines that match thinking patterns
    if (THINKING_PATTERNS.some((p) => p.test(trimmed))) {
      continue;
    }

    // Keep everything else (could be real prose content)
    kept.push(line);
  }

  let result = kept.join('\n');

  // Collapse 3+ blank lines into 2
  result = result.replace(/\n{3,}/g, '\n\n');

  // Trim leading blank lines (often left after stripping thinking)
  result = result.replace(/^\n+/, '');

  return result.trim();
}

function extractArtifact(text: string): { reply: string; artifact: Artifact | undefined } {
  let artifact: Artifact | undefined;

  // Strategy 1: Proper markers <<<ARTIFACT>>>...<<<END_ARTIFACT>>>
  const fullMatch = text.match(/<<<ARTIFACT>>>\s*([\s\S]*?)\s*<<<END_ARTIFACT>>>/);
  if (fullMatch) {
    try {
      const parsed = JSON.parse(fullMatch[1].trim()) as Artifact;
      if (parsed.type && parsed.data) artifact = parsed;
    } catch { /* fall through */ }
  }

  // Strategy 2: Opening marker but missing closing (model got cut off)
  if (!artifact) {
    const openMatch = text.match(/<<<ARTIFACT>>>\s*([\s\S]*)/);
    if (openMatch) {
      let jsonStr = openMatch[1].trim();
      const lastBrace = jsonStr.lastIndexOf('}');
      if (lastBrace > 0) {
        jsonStr = jsonStr.slice(0, lastBrace + 1);
        try {
          const parsed = JSON.parse(jsonStr) as Artifact;
          if (parsed.type && parsed.data) artifact = parsed;
        } catch { /* fall through */ }
      }
    }
  }

  // Strategy 3: Raw JSON block in the response (model forgot markers entirely)
  if (!artifact) {
    const jsonBlockMatch = text.match(/\{\s*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[\s\S]*?\n\}/);
    if (jsonBlockMatch) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[0]) as Artifact;
        if (parsed.type && parsed.data) artifact = parsed;
      } catch { /* fall through */ }
    }
  }

  // Strategy 4: Fenced code block with JSON (model wrapped it in ```json ... ```)
  if (!artifact) {
    const fencedMatch = text.match(/```(?:json)?\s*\n?\s*(\{[\s\S]*?"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[\s\S]*?\})\s*\n?\s*```/);
    if (fencedMatch) {
      try {
        const parsed = JSON.parse(fencedMatch[1].trim()) as Artifact;
        if (parsed.type && parsed.data) artifact = parsed;
      } catch { /* fall through */ }
    }
  }

  // Strategy 5: Inline artifact JSON with no markers (reasoning models often
  // do this: "Let's prepare the artifact. { "type": "table", ..."). Try to extract
  // a complete object by brace-balancing from the first `{` containing `"type":`.
  if (!artifact) {
    const typeIdx = text.search(/\{\s*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"/);
    if (typeIdx >= 0) {
      const candidate = text.slice(typeIdx);
      // Greedy: take everything from the opening `{` to the last `}` in the
      // response. JSON.parse will reject if the candidate isn't balanced, so
      // we try progressively shorter slices (last 1, 2, 3... `}` chars).
      const lastBraceIdx = candidate.lastIndexOf('}');
      if (lastBraceIdx > 0) {
        for (let end = lastBraceIdx; end > 0; end = candidate.lastIndexOf('}', end - 1)) {
          const slice = candidate.slice(0, end + 1);
          try {
            const parsed = JSON.parse(slice) as Artifact;
            if (parsed.type && parsed.data) {
              artifact = parsed;
              break;
            }
          } catch { /* try a shorter slice */ }
        }
      }
    }
  }

  // Always clean the reply — even when artifact was found, there may be leftover
  // JSON/markers in the text that we don't want showing in the chat
  let reply = cleanReplyText(text);

  // Strip AI "thinking out loud" lines from the entire reply (aggressive)
  reply = stripThinkingLines(reply);

  // If after cleaning the reply is empty (the model emitted 100% thinking),
  // fall back to a brief acknowledgment so the UI doesn't show a blank bubble.
  if (!reply) {
    reply = artifact
      ? 'Here you go.'
      : 'I had trouble generating a clean response — please try again.';
  }

  return { reply, artifact };
}

// ─── Refusal loop detection ─────────────────────────────────────────────────
// If the last N assistant messages in history are all refusals, drop them
// so the model doesn't get stuck in a refusal loop.

const REFUSAL_PHRASES = [
  'i can only help',
  'i only help',
  'please ask about your invoices',
  'please ask about',
  'i specialize in',
  'i focus on',
  'i\'m designed to',
  'i am designed to',
];

function isRefusalMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return REFUSAL_PHRASES.some((p) => lower.includes(p));
}

function filterRefusalLoop<T extends { role: string; content: string }>(
  messages: T[],
): T[] {
  // Find the last contiguous block of refusal messages from the assistant
  let lastNonRefusalIdx = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant' && isRefusalMessage(m.content)) {
      continue;
    }
    lastNonRefusalIdx = i + 1;
    break;
  }

  // If the last 2+ messages are all refusals, strip them
  const refusalCount = messages.length - lastNonRefusalIdx;
  if (refusalCount >= 2) {
    console.warn(`[chat] Stripping ${refusalCount} consecutive refusal messages from history`);
    return messages.slice(0, lastNonRefusalIdx);
  }

  return messages;
}

// ─── POST handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 10 requests per minute
    const ip = getClientIp(req);
    if (rateLimit(ip, 10, 60_000)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before trying again.' },
        { status: 429 },
      );
    }

    // Auth check
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    // Validate request body with Zod
    const body = await req.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? 'Invalid request body.' },
        { status: 400 },
      );
    }
    const { message, history } = parsed.data;
    const { sessionId } = body;

    // Prompt injection detection (only for clear attacks)
    if (detectPromptInjection(message)) {
      return NextResponse.json({
        reply: "I help with invoice data — ask about your invoices, vendors, or amounts.",
      });
    }

    // Get or create chat session
    let session;
    if (sessionId) {
      session = await db.chatSession.findFirst({
        where: { id: sessionId, userId: auth.userId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    }
    if (!session) {
      session = await db.chatSession.create({
        data: { userId: auth.userId, title: message.slice(0, 50) },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
    }

    // Free plan message limit check (per month, not per session)
    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (user?.plan === 'free') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const messageCount = await db.chatMessage.count({
        where: {
          session: { userId: auth.userId },
          createdAt: { gte: startOfMonth },
          role: 'user',
        },
      });
      const limit = PLAN_CHAT_LIMITS.free;
      if (messageCount >= limit) {
        return NextResponse.json({
          error: `You've reached the ${limit} message limit for the free plan this month. Upgrade to Pro for unlimited chat.`,
        }, { status: 403 });
      }
    }

    // Get user's invoices for context
    const invoices = await db.invoice.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, vendor: true, invNumber: true, invDate: true,
        total: true, confidence: true, isDuplicate: true,
      },
    });

    const invoiceContext = buildInvoiceContext(invoices as unknown as Array<Record<string, unknown>>);
    const systemMessage = SYSTEM_PROMPT + '\n\n' + invoiceContext;

    // Build message history from DB, filter refusal loops, add current message
    const dbMessages: Array<{ role: 'user' | 'assistant'; content: string }> = (session.messages || []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Strip consecutive refusal messages to break refusal loops
    const cleanHistory = filterRefusalLoop(dbMessages);

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      ...cleanHistory,
      { role: 'user', content: message },
    ];

    const responseText = await geminiChatCall(systemMessage, messages);

    if (!responseText) {
      return NextResponse.json({ error: 'AI returned an empty response. Please try again.' }, { status: 500 });
    }

    const { reply, artifact } = extractArtifact(responseText);

    // Save messages to DB
    await db.chatMessage.create({
      data: { sessionId: session.id, role: 'user', content: message },
    });
    await db.chatMessage.create({
      data: { sessionId: session.id, role: 'assistant', content: reply, artifact: artifact ? JSON.parse(JSON.stringify(artifact)) : undefined },
    });

    return NextResponse.json({
      reply,
      artifact: artifact ?? undefined,
      sessionId: session.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error during AI processing';
    // Give user-friendly error for rate limits / model failures
    if (msg.includes('temporarily busy') || msg.includes('429') || msg.includes('rate_limit')) {
      return NextResponse.json({
        error: 'AI is temporarily busy — please wait 30 seconds and try again.',
      }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
