import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, PLAN_CHAT_LIMITS } from '@/lib/auth';
import { chatSchema, getClientIp } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import type { Artifact } from '@/stores/app-store';
import { geminiChatCall } from '@/lib/gemini';
import { openRouterChatCall, isOpenRouterConfigured } from '@/lib/openrouter';

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

// ─── System Prompt (structured JSON output mode) ─────────────────────────────
// The chat route calls Groq with `response_format: { type: "json_object" }` for
// models that support it (llama-3.1, llama-3.3, llama-4-scout). JSON mode forces
// the model to output valid JSON only — it cannot leak "Thinking Process:" or
// "Output:" or any other free-text thinking. The model MUST respond as:
//   { "text": "<prose answer>", "artifact": <optional artifact object or null> }
//
// For models that DON'T support JSON mode (qwen3.6-27b), we send the same
// prompt but without response_format, and the regex cleanup layer below
// (stripThinkingLines / cleanReplyText / findLastAnswerPrefixIndex) handles
// any thinking leak as a fallback.

const SYSTEM_PROMPT = `You are OmniParse Invoice Assistant. You answer questions about the user's invoice data and generate tables, charts, and summaries when asked.

You help with:
- Summaries, totals, averages, and breakdowns of invoice data
- Vendor analysis, duplicate detection, confidence scores
- Tables, charts, and visual artifacts about invoices
- Identifying and grouping duplicate invoices
- Any question that references the user's invoices, vendors, amounts, or data

═══ OUTPUT FORMAT — STRICT ═══
You MUST respond as a single JSON object with this exact schema:
{
  "text": "<your prose answer to the user, in markdown. Use **bold** for key numbers, bullet lists for breakdowns. 2-4 sentences for simple questions.>",
  "artifact": <artifact object OR null>
}

The "artifact" field:
- Set to null if the user didn't ask for a table/chart/summary.
- Set to a valid artifact object if the user asked for one.

Artifact object schema (pick ONE type):
  { "type": "table", "title": "...", "data": { "columns": [...], "rows": [{...}] } }
  { "type": "chart-bar", "title": "...", "data": { "data": [{...}], "xKey": "...", "yKeys": [...], "colors": [...] } }
  { "type": "chart-line", "title": "...", "data": { "data": [{...}], "xKey": "...", "yKeys": [...], "colors": [...] } }
  { "type": "chart-pie", "title": "...", "data": { "data": [{...}], "nameKey": "...", "valueKey": "...", "colors": [...] } }
  { "type": "summary", "title": "...", "data": { "metrics": [{"label":"...","value":"...","description":"..."}] } }

═══ EXAMPLES ═══

User: "How many invoices do I have?"
Response:
{
  "text": "You have 18 invoices in total.",
  "artifact": null
}

User: "Show duplicate invoices"
Response:
{
  "text": "Here are the duplicate invoices I found. Acme Corp has 3 copies of INV-100 all dated 2026-07-02 with the same amount.",
  "artifact": {
    "type": "table",
    "title": "Duplicate Invoices",
    "data": {
      "columns": ["Vendor", "Invoice #", "Date", "Amount", "Count", "IDs"],
      "rows": [
        { "Vendor": "Acme Corp", "Invoice #": "INV-100", "Date": "2026-07-02", "Amount": "$1,234.56", "Count": "3", "IDs": "abc, def, ghi" }
      ]
    }
  }
}

User: "Give me a summary"
Response:
{
  "text": "Your invoice portfolio contains 18 invoices totaling $67,723. Average confidence is 80%.",
  "artifact": {
    "type": "summary",
    "title": "Invoice Summary",
    "data": {
      "metrics": [
        { "label": "Total Amount", "value": "$67,723", "description": "Sum of all invoices" },
        { "label": "Total Invoices", "value": "18", "description": "Number of invoices processed" }
      ]
    }
  }
}

═══ RULES ═══
- Output ONLY the JSON object. No prose before or after it. No markdown fences.
- The "text" field contains your prose answer. Never put thinking, planning, or reasoning in it.
- The "artifact" field is null unless the user explicitly asked for a table/chart/summary.
- Use exact amounts from the data, round to 2 decimal places.
- **Bold** key numbers in the text field using markdown.
- When asked about duplicates: group by vendor + invoice number + date, note amount discrepancies.
- Never narrate your thought process. The JSON structure enforces this — just fill in "text" and "artifact".
- Today's date is September 9, 2026. The current year is 2026. Do NOT flag 2026 dates as "future" or "suspicious" — they are current dates. Only flag dates that are genuinely anomalous (e.g. year 2099, year 1990 for a recent vendor).`;

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
  /^\s*the (data|context|information|prompt|instructions?|response|answer|summary|text)\s+(shows?|says?|provides?|contains?|indicates?|tells|asks?|wants?|states?)\b/i,
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
  // Structured planning patterns (llama-3.3-style explicit planning)
  /^\s*plan\s*[:.]\s*$/i,                      // "Plan:" alone on a line
  /^\s*draft\s*[:.]/i,                          // "Draft:" or "Draft: ..."
  /^\s*refining\s/i,                            // "Refining based on..."
  /^\s*refine\s/i,                              // "Refine the..."
  /^\s*final\s+check\s/i,                       // "Final check of the data:"
  /^\s*step\s+\d+\s*[:.]/i,                     // "Step 1:", "Step 2:"
  // Self-instructions (the model telling itself what to do)
  /^\s*state\s+the\s/i,                         // "State the total number..."
  /^\s*mention\s/i,                            // "Mention the breakdown..."
  /^\s*keep\s+it\s+to\s/i,                     // "Keep it to 1-2 sentences"
  /^\s*no\s+artifact\s+is\s+needed/i,           // "No artifact is needed for..."
  /^\s*the\s+question\s+is\s/i,                // "The question is simple..."
  /^\s*correct\s*\.?\s*$/i,                    // "Correct." alone on a line
  /^\s*the\s+draft\s+(looks?|is|seems)\s/i,     // "The draft looks good"
  // ─── "Thinking Process:" style explicit reasoning headers ──────────────
  // When the model writes one of these, it has gone into structured-reasoning
  // mode. The text BEFORE the header is the only "real" content; everything
  // after is thinking until an answer marker or the artifact.
  /^\s*thinking\s+process\s*[:.]/i,
  /^\s*my\s+thinking\s*[:.]/i,
  /^\s*reasoning\s*[:.]/i,
  /^\s*chain\s+of\s+thought\s*[:.]/i,
  /^\s*analysis\s*[:.]\s*$/i,                  // "Analysis:" alone on a line
  /^\s*my\s+analysis\s*[:.]/i,
  // ─── Structured analysis section headers (qwen/llama-3.3 planning style) ─
  /^\s*analyze\s+the\s+request\s*[:.]/i,       // "Analyze the Request:"
  /^\s*analyze\s+the\s+data\s*[:.]/i,           // "Analyze the Data:"
  /^\s*determine\s+output\s+format\s*[:.]/i,    // "Determine Output Format:"
  /^\s*artifact\s+type\s*[:.]/i,                // "Artifact Type: summary"
  /^\s*metrics\s+to\s+include\s*[:.]/i,         // "Metrics to include:"
  /^\s*draft\s+the\s+artifact\s*[:.]/i,          // "Draft the Artifact:"
  /^\s*draft\s+the\s+text\s+response\s*[:.]/i,   // "Draft the Text Response:"
  /^\s*drafting\s+the\s+artifact\s*[:.]/i,       // "Drafting the Artifact:"
  /^\s*refine\s+text\s*[:.]/i,                  // "Refine Text:"
  /^\s*final\s+output\s+construction\s*[:.]/i,   // "Final Output Construction:"
  /^\s*self[- ]correction\s+during\s+drafting\s*[:.]/i,  // "Self-Correction during drafting:"
  /^\s*artifact\s+construction\s*[:.]/i,         // "Artifact Construction:"
  /^\s*final\s+polish\s*[:.]/i,                 // "Final Polish:"
  /^\s*synthesize\s+the\s+findings\s*[:.]/i,    // "Synthesize the Findings:"
  /^\s*scan\s+the\s+data\s+for\s/i,             // "Scan the Data for Anomalies/Suspicious Indicators:"
  /^\s*suspicion\s*[:.]/i,                     // "Suspicion: ..."
  /^\s*vendor\s+breakdown\s*[:.]/i,             // "Vendor Breakdown:"
  /^\s*title\s*[:.]\s/i,                       // "Title: ..." (artifact drafting)
  /^\s*type\s*[:.]\s+(table|chart|summary|chart-bar|chart-line|chart-pie)\s/i,  // "Type: table"
  /^\s*columns\s*[:.]/i,                       // "Columns: ..."
  /^\s*rows\s*[:.]/i,                          // "Rows: ..."
  /^\s*metrics\s*[:.]\s*$/i,                   // "Metrics:" alone on a line
  // ─── More structured analysis section headers (qwen reasoning style) ─────
  /^\s*data\s+analysis\s*[:.]/i,                 // "Data Analysis:"
  /^\s*duplicate\s+groups\s*[:.]/i,              // "Duplicate Groups:"
  /^\s*confidence\s+scores\s*[:.]/i,             // "Confidence Scores:"
  /^\s*suspicious\s+items\s+identified\s*[:.]/i, // "Suspicious items identified:"
  /^\s*amounts\s*[:.]/i,                          // "Amounts:" (analysis header)
  /^\s*dates\s*[:.]\s*$/i,                        // "Dates:" alone on a line (analysis header)
  // ─── Self-instructions (continued) ─────────────────────────────────────
  /^\s*highlight\s/i,                            // "Highlight the massive outlier amount"
  /^\s*format\s+the\s+response\s/i,              // "Format the response as JSON..."
  /^\s*i\s+will\s/i,                             // "I will stick to text..."
  /^\s*if\s+i\s+want\s+to\s+show\s/i,             // "If I want to show the invoice..."
  /^\s*but\s+it'?s?\s+safer\s/i,                  // "but it's safer to..."
  /^\s*did\s+the\s+user\s+ask\s/i,                // "Did the user ask for a summary?"
  /^\s*strict\s+rules\s+say\s/i,                 // "strict rules say artifact is null unless..."
  /^\s*they\s+asked\s/i,                          // "They asked 'do you see anything suspicious?'"
  // ─── "Verification" / "schema check" lines (qwen sometimes leaks these) ──
  /^\s*check\s+artifact\s+schema/i,           // "Check artifact schema."
  /^\s*verifying\s+(the\s+)?(schema|artifact|json|response)/i,  // "Verifying schema..."
  /^\s*schema\s+check/i,                     // "Schema check"
  /^\s*artifact\s+check/i,                   // "Artifact check"
  /^\s*check\s+the\s+(schema|artifact|json|response)/i,  // "Check the schema"
  /^\s*validating\s+(the\s+)?(schema|artifact|json|response)/i,  // "Validating schema"
];

// Patterns for "answer lead-in" prefixes that the model adds to the actual
// answer line. We strip the prefix but KEEP the answer text that follows.
// e.g. "Output: You have 18 invoices" → "You have 18 invoices"
// "Text Construction:" is included because llama-3.3 sometimes labels the
// final prose answer with that header (the rest is thinking preamble).
// "Text:\"" is included (with a quote after) because qwen sometimes writes
// the answer as `Text: "..."` when in free-text mode after JSON validation
// failure. The quote requirement avoids matching "Text: Summary" headings.
// The trailing `(?:[:.]\s*)?` is OPTIONAL — for the `text\s*[:.]\s*"` alternative
// the colon is already inside; for the other alternatives we need to consume
// the colon (or period) and following whitespace.
const ANSWER_PREFIX_PATTERN = /^\s*(output|answer|response|final\s+answer|final\s+response|final\s+output|result|conclusion|text\s+construction|text\s*[:.]\s*")\s*(?:[:.]\s*)?/i;

// Patterns that match ANYWHERE in a line (not just start). Used for cases where
// the model mixes thinking and content on the same line. If ANY of these match,
// the whole line is dropped.
const THINKING_PATTERNS_ANYWHERE = [
  /no\s+artifact\s+is\s+needed/i,                       // "No artifact is needed for a simple count"
  /sum\s*[:=]\s*\d+\s*[+\-*/]\s*\d/i,                  // "Sum: 8+1+8+1 = 18" arithmetic verification
  /\d+\s*[+\-*/]\s*\d+\s*=\s*\d+\s*\.\s*correct/i,      // "8+1+8+1 = 18. Correct."
  /the\s+draft\s+(looks?|is|seems)\s+(good|fine|acceptable|correct|reasonable)/i,  // "The draft looks good"
  /no\s+(modifications|changes|edits)\s+(needed|required|necessary)/i,            // "No modifications needed"
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

    // Strip "Output: " / "Answer: " / "Final answer: " prefixes but KEEP the
    // answer text that follows. Reasoning models (llama-3.3, etc.) often label
    // the final answer line as "Output: <actual answer>".
    const prefixMatch = line.match(ANSWER_PREFIX_PATTERN);
    if (prefixMatch) {
      const stripped = line.replace(ANSWER_PREFIX_PATTERN, '');
      // Only keep if there's actual answer text after the prefix
      if (stripped.trim()) {
        kept.push(stripped);
      }
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

    // Drop lines that match thinking patterns (start-of-line)
    if (THINKING_PATTERNS.some((p) => p.test(trimmed))) {
      continue;
    }

    // Drop lines that match thinking patterns (anywhere in line)
    // These catch cases where the model mixed thinking and content on one line
    if (THINKING_PATTERNS_ANYWHERE.some((p) => p.test(trimmed))) {
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

/**
 * Strip leaked artifact JSON from a chat reply's text field.
 *
 * Some models — especially qwen3.6-27b in free-text mode (after JSON validation
 * fails) — put the artifact JSON inline in the text field AS WELL AS in the
 * artifact field. The user then sees BOTH a styled table/chart card AND raw
 * JSON in the chat bubble above it.
 *
 * This function removes any JSON object that looks like an artifact
 * (has "type": "table" | "chart-bar" | "chart-line" | "chart-pie" | "summary"
 * and "data" or "columns"). It also removes leading comma/whitespace artifacts
 * left behind (e.g. "blah. ,{\"type\": ...}" → "blah.").
 *
 * Used by the JSON-mode primary path in extractArtifact.
 */
function stripArtifactJsonFromText(text: string): string {
  if (!text) return text;

  let clean = text;

  // Remove raw JSON objects that look like artifacts ({"type": "chart-bar", ...})
  // Single level: {"type":"table","title":"...","data":{...}}
  clean = clean.replace(/\{[^{}]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[^{}]*\}/g, '');

  // Two-level nesting: {"type":"table","title":"...","data":{"columns":[...],"rows":[...]}}
  // Match { ... { ... } ... "type": ... ... } and { ... "type": ... ... { ... } ... }
  clean = clean.replace(/\{[^{]*\{[^}]*\}[^}]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[^}]*\}/g, '');
  clean = clean.replace(/\{[^{]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[^{]*\{[^}]*\}[^}]*\}/g, '');

  // Deeper nesting (3+ levels, e.g. full artifact with rows containing objects):
  // Match { ... { ... { ... } ... } ... "type": ... ... } patterns.
  // We use a greedy match up to the last `}` followed by end-of-string or newline.
  clean = clean.replace(/\{[\s\S]*?"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[\s\S]*?\n?\}/g, '');

  // Remove INLINE partial artifact JSON that starts with `{ "type": "..."` or
  // `,{"type":"..."` (often appears when the model writes the artifact inline
  // mid-prose). Strip from the first occurrence to end of message.
  clean = clean.replace(/\s*[,;.]?\s*\{[\s\n]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[\s\S]*$/g, '');

  // Clean up trailing punctuation left by JSON removal (e.g. "blah. ," → "blah.")
  clean = clean.replace(/[,\s]+$/g, '');
  clean = clean.replace(/\s+,/g, ',');
  // Clean up ", }" or "., }" leftovers after JSON removal (preserves trailing period
  // on legitimate prose like "You have 18 invoices in total.")
  clean = clean.replace(/,?\s*\}\s*$/g, '');
  clean = clean.replace(/\s+,\s*$/g, '');

  // Clean up multiple blank lines left by removals
  clean = clean.replace(/\n{3,}/g, '\n\n');

  return clean.trim();
}

function extractArtifact(text: string): { reply: string; artifact: Artifact | undefined } {
  // ─── PRIMARY PATH: JSON-mode structured response ──────────────────────────
  // When the chat model supports JSON mode (llama-3.1, llama-3.3, llama-4-scout),
  // the response will be a single JSON object: { "text": "...", "artifact": {...}|null }
  // Try parsing that first — it's the clean path with no thinking leak.
  try {
    const trimmed = text.trim();
    // JSON mode responses may sometimes be wrapped in markdown fences by some
    // models despite the instruction not to. Strip a single surrounding fence
    // before parsing.
    const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
    const jsonStr = fenceMatch ? fenceMatch[1].trim() : trimmed;
    const parsed = JSON.parse(jsonStr) as { text?: unknown; artifact?: unknown };

    if (parsed && typeof parsed === 'object' && 'text' in parsed) {
      let text_field = typeof parsed.text === 'string' ? parsed.text : '';
      const artifact_field = parsed.artifact;

      // Validate the artifact field
      let artifact: Artifact | undefined;
      if (artifact_field && typeof artifact_field === 'object' && artifact_field !== null) {
        const a = artifact_field as Record<string, unknown>;
        if (a.type && a.data && typeof a.type === 'string' && typeof a.data === 'object') {
          artifact = a as unknown as Artifact;
        }
      }

      // ─── Strip leaked artifact JSON from the text field ─────────────
      // Some models (especially qwen in free-text fallback mode after JSON
      // validation failed) put the artifact JSON inline in the text field AS
      // WELL AS in the artifact field. The result: the user sees a styled
      // table/chart card AND raw JSON in the chat bubble above it. We strip
      // the JSON so the user only sees the prose + the rendered artifact card.
      text_field = stripArtifactJsonFromText(text_field);

      const reply = text_field.trim() || (artifact ? 'Here you go.' : 'I had trouble generating a clean response — please try again.');
      return { reply, artifact };
    }
  } catch {
    // Not valid JSON — fall through to the legacy regex cleanup path below.
    // This happens for models that don't support JSON mode (qwen3.6-27b) or
    // when the model wrapped its output in some unexpected way.
  }

  // ─── FALLBACK PATH: legacy regex cleanup (for qwen + free-text models) ────
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

  // Clean the reply — strip thinking patterns (only used for non-JSON-mode models)
  let reply = cleanReplyText(text);

  const lastAnswerIdx = findLastAnswerPrefixIndex(reply);
  if (lastAnswerIdx >= 0) {
    reply = reply.slice(lastAnswerIdx).replace(ANSWER_PREFIX_PATTERN, '').trim();
  } else {
    const thinkingHeaderIdx = findThinkingProcessHeader(reply);
    if (thinkingHeaderIdx >= 0) {
      reply = reply.slice(0, thinkingHeaderIdx).trim();
    }
  }

  reply = stripThinkingLines(reply);

  if (!reply) {
    reply = artifact
      ? 'Here you go.'
      : 'I had trouble generating a clean response — please try again.';
  }

  return { reply, artifact };
}

/**
 * Find the index of the LAST answer-prefix line in the text.
 * Returns -1 if no answer-prefix is found.
 *
 * An answer-prefix is a line that starts with: "Output:", "Answer:", "Response:",
 * "Final answer:", "Result:", "Conclusion:", etc. followed by content.
 *
 * We return the index of the start of the line (after any leading whitespace),
 * so the caller can slice from there and strip the prefix.
 */
function findLastAnswerPrefixIndex(text: string): number {
  // Match a line that starts with an answer-prefix keyword, followed by
  // ":" or "." (required for most keywords, but `text:..."` already includes it
  // in the alternative), followed by at least one non-whitespace character.
  // Anchored to start of line (^ or after \n).
  const re = /(?:^|\n)([ \t]*(?:output|answer|response|final\s+answer|final\s+response|final\s+output|result|conclusion|text\s+construction|text\s*[:.]\s*")(?:[:.]\s*)?\S)/gi;
  let lastIdx = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // m.index points to either the start of the string OR the \n before the line.
    const lineStart = m.index + (m[0].startsWith('\n') ? 1 : 0);
    // Skip leading whitespace within the line
    const wsMatch = text.slice(lineStart).match(/^[ \t]*/);
    lastIdx = wsMatch ? lineStart + wsMatch[0].length : lineStart;
  }
  return lastIdx;
}

// ─── "Thinking Process:" header detection ──────────────────────────────────
// When the model writes a "Thinking Process:" style header anywhere in its
// response, it has gone into explicit reasoning mode. This usually means
// the entire response is structured thinking — the actual answer (if any)
// appears under a label like "Output:" or "Text Construction:".
//
// If we DON'T find an answer-prefix after the thinking header, the model
// ran out of tokens before delivering an answer — we return empty (which
// triggers the fallback message).
const THINKING_PROCESS_HEADER_PATTERNS = [
  /^\s*thinking\s+process\s*[:.]/im,
  /^\s*my\s+thinking\s*[:.]/im,
  /^\s*reasoning\s*[:.]/im,
  /^\s*chain\s+of\s+thought\s*[:.]/im,
  /^\s*step[- ]by[- ]step\s+(?:reasoning|analysis|thinking)\s*[:.]/im,
  /^\s*my\s+analysis\s*[:.]/im,
];

/**
 * Find the index of the FIRST thinking-process header in the text.
 * Returns -1 if no thinking-process header is found.
 *
 * Returns the index of the start of the line containing the header (so the
 * caller can slice(0, idx) to keep only what's BEFORE the thinking).
 */
function findThinkingProcessHeader(text: string): number {
  for (const pattern of THINKING_PROCESS_HEADER_PATTERNS) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      // The pattern uses ^ which (with /m flag) matches start of line,
      // so match.index is the start of the line (after any leading \n).
      // If the regex matched leading whitespace as part of ^\s*, then
      // match.index is the start of that whitespace. Either way, slice(0, idx)
      // gives us everything before this line.
      return match.index;
    }
  }
  return -1;
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

    // ─── Call AI: Groq first, OpenRouter as fallback ─────────────────────────
    // Try Groq's 4-model cascade (llama-3.1, llama-4-scout, llama-3.3-70b, qwen).
    // If ALL of Groq is rate-limited, try OpenRouter's fallbacks (Ling 3.0 Flash Fin,
    // Nemotron). OpenRouter is a separate quota pool, so this recovers from Groq
    // daily-quota exhaustion. If OpenRouter is not configured (no API key), we skip
    // it and let the error surface as before.
    let responseText: string;
    try {
      responseText = await geminiChatCall(systemMessage, messages);
    } catch (groqErr) {
      const groqMsg = groqErr instanceof Error ? groqErr.message : String(groqErr);
      // Only fall through to OpenRouter if Groq is genuinely rate-limited or all
      // models failed. Other errors (auth, network) should surface immediately.
      const isGroqExhausted = groqMsg.includes('temporarily busy')
        || groqMsg.includes('429')
        || groqMsg.includes('rate_limit')
        || groqMsg.includes('all models');

      const orConfigured = isOpenRouterConfigured();
      // Diagnostic logs — check Vercel function logs for these to debug
      // OpenRouter fallback issues. If you see "Groq exhausted" but NOT
      // "Falling through to OpenRouter", the issue is that OPENROUTER_API_KEY
      // is missing or not picked up by the deployment.
      console.warn('[chat] Groq failed:', groqMsg);
      console.warn(`[chat] isOpenRouterConfigured: ${orConfigured ? 'true' : 'false (OPENROUTER_API_KEY not set)'}`);
      console.warn(`[chat] isGroqExhausted: ${isGroqExhausted ? 'true' : 'false'}`);

      if (!isGroqExhausted || !orConfigured) {
        // Include diagnostic hint in the error message so it's visible in the
        // chat UI when OpenRouter isn't configured. This makes it obvious to
        // the user (and to us debugging) exactly what's missing.
        const hint = !orConfigured
          ? ' (OpenRouter fallback not configured — set OPENROUTER_API_KEY env var to enable)'
          : '';
        const wrappedErr = new Error(`${groqMsg}${hint}`);
        throw wrappedErr;
      }

      // Groq exhausted — try OpenRouter
      console.warn('[chat] Falling through to OpenRouter...', groqMsg);
      try {
        responseText = await openRouterChatCall(
          systemMessage,
          messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        );
        console.warn('[chat] OpenRouter succeeded — using OpenRouter response.');
      } catch (openRouterErr) {
        const orMsg = openRouterErr instanceof Error ? openRouterErr.message : String(openRouterErr);
        console.error('[chat] OpenRouter also failed:', orMsg);
        // Both providers failed. Throw a combined error that includes both provider
        // names so the user knows the situation is "everyone is busy", not just Groq.
        throw new Error(
          `AI is temporarily busy across all providers. (Groq: ${groqMsg}. OpenRouter: ${orMsg})`,
        );
      }
    }

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
    // Log full error to server logs (Vercel function logs) for debugging
    console.error('[chat] Error:', msg);
    // Give user-friendly error for rate limits / model failures
    if (msg.includes('temporarily busy') || msg.includes('429') || msg.includes('rate_limit')) {
      // Extract the "Tried: ..." part if present, so user knows which models failed
      const triedMatch = msg.match(/\(Tried: ([^)]+)\)/);
      const triedInfo = triedMatch ? ` (Tried: ${triedMatch[1]})` : '';
      return NextResponse.json({
        error: `AI is temporarily busy — please wait 30 seconds and try again.${triedInfo}`,
      }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
