// Standalone sanity test for the new chat cleanup logic.
// Run: bun run scripts/test-chat-cleanup.ts
//
// Imports the route's internal cleanup functions by re-implementing them
// inline (the route file is not directly importable since it uses Next.js
// server-only types). If this passes, we have high confidence the production
// route will also clean the user's actual leak case correctly.

const THINKING_PATTERNS = [
  /^\s*i\s+(need to|should|will|must|have to|want to|am going to|shall|consider|would|think|assume|notice|see|note|realize|observe)\b/i,
  /^\s*i'll\s/i,
  /^\s*i'd\s/i,
  /^\s*(the user|the customer|they)\s+(wants?|is asking|asked|needs?|requested|wrote|said|provided)\b/i,
  /^\s*let me\s/i,
  /^\s*let's\s/i,
  /^\s*let us\s/i,
  /^\s*first[,:]\s/i,
  /^\s*next[,:]\s/i,
  /^\s*then[,:]\s/i,
  /^\s*finally[,:]\s/i,
  /^\s*so[,:]\s/i,
  /^\s*now\s+(i|let|we|the)\s/i,
  /^\s*wait[,:]\s/i,
  // /^\s*actually[,:]\s/i,  // REMOVED — also matches legitimate answer "Actually, there are..."
  /^\s*hmm[,:]\s/i,
  /^\s*ok[,:]\s/i,
  /^\s*alright[,:]\s/i,
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
  /^\s*columns?\s*[:=]\s/i,
  /^\s*rows?\s*[:=]\s/i,
  /^\s*artifact\s*[:=]\s/i,
  /^\s*prepare\s+the\s+artifact/i,
  /^\s*construct\s+the\s+/i,
  /^\s*format\s+the\s+(table|chart|artifact)/i,
  // Structured planning
  /^\s*plan\s*[:.]\s*$/i,
  /^\s*draft\s*[:.]/i,
  /^\s*refining\s/i,
  /^\s*refine\s/i,
  /^\s*final\s+check\s/i,
  /^\s*step\s+\d+\s*[:.]/i,
  // Self-instructions
  /^\s*state\s+the\s/i,
  /^\s*mention\s/i,
  /^\s*keep\s+it\s+to\s/i,
  /^\s*no\s+artifact\s+is\s+needed/i,
  /^\s*the\s+question\s+is\s/i,
  /^\s*correct\s*\.?\s*$/i,
  /^\s*the\s+draft\s+(looks?|is|seems)\s/i,
  // "Thinking Process:" style headers
  /^\s*thinking\s+process\s*[:.]/i,
  /^\s*my\s+thinking\s*[:.]/i,
  /^\s*reasoning\s*[:.]/i,
  /^\s*chain\s+of\s+thought\s*[:.]/i,
  /^\s*analysis\s*[:.]\s*$/i,
  /^\s*my\s+analysis\s*[:.]/i,
  // Structured analysis section headers
  /^\s*analyze\s+the\s+request\s*[:.]/i,
  /^\s*analyze\s+the\s+data\s*[:.]/i,
  /^\s*determine\s+output\s+format\s*[:.]/i,
  /^\s*artifact\s+type\s*[:.]/i,
  /^\s*metrics\s+to\s+include\s*[:.]/i,
  /^\s*draft\s+the\s+artifact\s*[:.]/i,
  /^\s*draft\s+the\s+text\s+response\s*[:.]/i,
  /^\s*drafting\s+the\s+artifact\s*[:.]/i,
  /^\s*refine\s+text\s*[:.]/i,
  /^\s*final\s+output\s+construction\s*[:.]/i,
  /^\s*self[- ]correction\s+during\s+drafting\s*[:.]/i,
  /^\s*artifact\s+construction\s*[:.]/i,
  /^\s*final\s+polish\s*[:.]/i,
  /^\s*synthesize\s+the\s+findings\s*[:.]/i,
  /^\s*scan\s+the\s+data\s+for\s/i,
  /^\s*suspicion\s*[:.]/i,
  /^\s*vendor\s+breakdown\s*[:.]/i,
  /^\s*title\s*[:.]\s/i,
  /^\s*type\s*[:.]\s+(table|chart|summary|chart-bar|chart-line|chart-pie)\s/i,
  /^\s*columns\s*[:.]/i,
  /^\s*rows\s*[:.]/i,
  /^\s*metrics\s*[:.]\s*$/i,
  // More structured analysis (qwen reasoning style)
  /^\s*data\s+analysis\s*[:.]/i,
  /^\s*duplicate\s+groups\s*[:.]/i,
  /^\s*confidence\s+scores\s*[:.]/i,
  /^\s*suspicious\s+items\s+identified\s*[:.]/i,
  /^\s*amounts\s*[:.]/i,
  /^\s*dates\s*[:.]\s*$/i,
  // Self-instructions
  /^\s*highlight\s/i,
  /^\s*format\s+the\s+response\s/i,
  /^\s*i\s+will\s/i,
  /^\s*if\s+i\s+want\s+to\s+show\s/i,
  /^\s*but\s+it'?s?\s+safer\s/i,
  /^\s*did\s+the\s+user\s+ask\s/i,
  /^\s*strict\s+rules\s+say\s/i,
  /^\s*they\s+asked\s/i,
  // Verification / schema check lines
  /^\s*check\s+artifact\s+schema/i,
  /^\s*verifying\s+(the\s+)?(schema|artifact|json|response)/i,
  /^\s*schema\s+check/i,
  /^\s*artifact\s+check/i,
  /^\s*check\s+the\s+(schema|artifact|json|response)/i,
  /^\s*validating\s+(the\s+)?(schema|artifact|json|response)/i,
  // More "discussion of user's question" patterns
  /^\s*this\s+implies\s/i,
  /^\s*the\s+user'?s?\s+(question|phrasing|intent|request|message)/i,
  /^\s*also[,:]\s+(the|they|there)/i,
  /^\s*i\s+need\s+to\s+correct\s/i,
  /^\s*structure\s*[:.]\s*(text|json|artifact)/i,
  // More self-instruction lines
  /^\s*clarify\s+that\s+/i,
  /^\s*correct\s+them\s*\.?\s*$/i,
  // "Self-verification AFTER answer" patterns
  /^\s*check\s+constraints/i,
  /^\s*looks\s+good\s*\.?\s*$/i,
  /^\s*matches\s+schema/i,
  /^\s*matches\s+the\s+schema/i,
  /^\s*proceed\s*\.?\s*$/i,
  /^\s*proceed\s+to\s+/i,
  /^\s*one\s+minor\s+thing\s/i,
  /^\s*the\s+prompt\s+says\s/i,
  /^\s*self[- ]correction/i,
  /^\s*self[- ]refinement/i,
  /^\s*this\s+fits\s*\.?\s*$/i,
  /^\s*all\s+matches\s*\.?\s*$/i,
  /^\s*text\s+field\s+has\s+/i,
  /^\s*json\s+only\s*\.?\s*$/i,
];

const ANSWER_PREFIX_PATTERN = /^\s*(output|answer|response|final\s+answer|final\s+response|final\s+output|result|conclusion|text\s+construction|text\s*[:.]\s*(?!summary|introduction|notes?|draft|plan|outline|artifact\s+type))(?:[:.]\s*)?/i;

const THINKING_PATTERNS_ANYWHERE = [
  /no\s+artifact\s+is\s+needed/i,
  /sum\s*[:=]\s*\d+\s*[+\-*/]\s*\d/i,
  /\d+\s*[+\-*/]\s*\d+\s*=\s*\d+\s*\.\s*correct/i,
  /the\s+draft\s+(looks?|is|seems)\s+(good|fine|acceptable|correct|reasonable)/i,
  /no\s+(modifications|changes|edits)\s+(needed|required|necessary)/i,
];

const THINKING_PROCESS_HEADER_PATTERNS = [
  /^\s*thinking\s+process\s*[:.]/im,
  /^\s*my\s+thinking\s*[:.]/im,
  /^\s*reasoning\s*[:.]/im,
  /^\s*chain\s+of\s+thought\s*[:.]/im,
  /^\s*step[- ]by[- ]step\s+(?:reasoning|analysis|thinking)\s*[:.]/im,
  /^\s*my\s+analysis\s*[:.]/im,
];

function stripThinkingLines(reply: string): string {
  if (!reply || reply.length < 20) return reply;
  const lines = reply.split('\n');
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { kept.push(line); continue; }
    if (trimmed.startsWith('<<<ARTIFACT>>>') || trimmed.startsWith('<<<END_ARTIFACT>>>')) { kept.push(line); continue; }
    const prefixMatch = line.match(ANSWER_PREFIX_PATTERN);
    if (prefixMatch) {
      const stripped = line.replace(ANSWER_PREFIX_PATTERN, '');
      if (stripped.trim()) kept.push(stripped);
      continue;
    }
    const isContent =
      /^[-*•]\s/.test(trimmed) ||
      /^\d+[.)]\s/.test(trimmed) ||
      /^\*\*/.test(trimmed) ||
      /^#{1,6}\s/.test(trimmed) ||
      /^```/.test(trimmed) ||
      /^\$/.test(trimmed) ||
      /^\|/.test(trimmed) ||
      trimmed.startsWith('<<<');
    if (isContent) { kept.push(line); continue; }
    if (THINKING_PATTERNS.some((p) => p.test(trimmed))) continue;
    if (THINKING_PATTERNS_ANYWHERE.some((p) => p.test(trimmed))) continue;
    kept.push(line);
  }
  let result = kept.join('\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/^\n+/, '');
  return result.trim();
}

function cleanReplyText(reply: string): string {
  let clean = reply;
  clean = clean.replace(/<<<ARTIFACT>>>[\s\S]*?<<<END_ARTIFACT>>>/g, '');
  clean = clean.replace(/<<<ARTIFACT>>>[\s\S]*/g, '');
  clean = clean.replace(/<<<END_ARTIFACT>>>/g, '');
  clean = clean.replace(/```(?:json)?\s*\n[\s\S]*?```/g, (match) => {
    if (match.includes('"type"') && (match.includes('"data"') || match.includes('"columns"'))) return '';
    return match;
  });
  clean = clean.replace(/\{[^{}]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[^{}]*\}/g, '');
  clean = clean.replace(/\{[^{]*\{[^}]*\}[^}]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[^}]*\}/g, '');
  clean = clean.replace(/\{[^{]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[^{]*\{[^}]*\}[^}]*\}/g, '');
  clean = clean.replace(/\s*\{[\s\n]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[\s\S]*$/g, '');
  clean = clean.replace(/^(let's|here is|here's|i'll|now i|i will)\s+(prepare|generate|create|build|show|format|present)\s+(the\s+)?(artifact|table|chart|summary)[.!:?\s]*$/gim, '');
  clean = clean.replace(/\n{3,}/g, '\n\n');
  return clean.trim();
}

interface Artifact { type: string; data: Record<string, unknown>; title?: string }

function findLastAnswerPrefixIndex(text: string): number {
  const re = /(?:^|\n)([ \t]*(?:output|answer|response|final\s+answer|final\s+response|final\s+output|result|conclusion|text\s+construction|text\s*[:.]\s*(?!summary|introduction|notes?|draft|plan|outline|artifact\s+type))(?:[:.]\s*)?\S)/gi;
  let lastIdx = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const lineStart = m.index + (m[0].startsWith('\n') ? 1 : 0);
    const wsMatch = text.slice(lineStart).match(/^[ \t]*/);
    lastIdx = wsMatch ? lineStart + wsMatch[0].length : lineStart;
  }
  return lastIdx;
}

function findThinkingProcessHeader(text: string): number {
  for (const pattern of THINKING_PROCESS_HEADER_PATTERNS) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      return match.index;
    }
  }
  return -1;
}

function stripPostAnswerThinking(text: string): string {
  if (!text) return text;
  const markers = [
    /"\s*Check\s+constraints/i,
    /"\s*Self[- ]Correction/i,
    /"\s*Self[- ]Refinement/i,
    /"\s*Looks\s+good\s*\.?/i,
    /"\s*matches\s+schema/i,
    /"\s*matches\s+the\s+schema/i,
    /"\s*Proceed\s*\.?/i,
    /"\s*One\s+minor\s+thing/i,
    /"\s*The\s+prompt\s+says/i,
    /\s+Check\s+constraints\s*:/i,
    /\s+Self[- ]Correction/i,
    /\s+matches\s+schema/i,
  ];
  let earliestIdx = -1;
  for (const marker of markers) {
    const match = text.match(marker);
    if (match && match.index !== undefined) {
      if (earliestIdx === -1 || match.index < earliestIdx) {
        earliestIdx = match.index;
      }
    }
  }
  if (earliestIdx > 0) {
    return text.slice(0, earliestIdx).trim();
  }
  return text;
}

function stripSurroundingQuotes(text: string): string {
  if (!text || text.length < 2) return text;
  const trimmed = text.trim();
  if (trimmed.length < 2) return text;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith('\\"') && trimmed.endsWith('\\"')) {
    return trimmed.slice(2, -2);
  }
  // Case 3: leading quote only — closing quote already removed by stripPostAnswerThinking
  if (first === '"' && last !== '"') {
    return trimmed.slice(1);
  }
  if (first === "'" && last !== "'") {
    return trimmed.slice(1);
  }
  return text;
}

function stripArtifactJsonFromText(text: string): string {
  if (!text) return text;
  let clean = text;
  clean = clean.replace(/\{[^{}]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[^{}]*\}/g, '');
  clean = clean.replace(/\{[^{]*\{[^}]*\}[^}]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[^}]*\}/g, '');
  clean = clean.replace(/\{[^{]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[^{]*\{[^}]*\}[^}]*\}/g, '');
  clean = clean.replace(/\{[\s\S]*?"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[\s\S]*?\n?\}/g, '');
  clean = clean.replace(/\s*[,;.]?\s*\{[\s\n]*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[\s\S]*$/g, '');
  clean = clean.replace(/[,\s]+$/g, '');
  clean = clean.replace(/\s+,/g, ',');
  // Clean up ", }" leftovers after JSON removal (preserves trailing period)
  clean = clean.replace(/,?\s*\}\s*$/g, '');
  clean = clean.replace(/\s+,\s*$/g, '');
  clean = clean.replace(/\n{3,}/g, '\n\n');
  return clean.trim();
}

function extractArtifact(text: string): { reply: string; artifact: Artifact | undefined } {
  // ─── PRIMARY PATH: JSON-mode structured response ──────────────────────────
  try {
    const trimmed = text.trim();
    const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
    const jsonStr = fenceMatch ? fenceMatch[1].trim() : trimmed;
    const parsed = JSON.parse(jsonStr) as { text?: unknown; artifact?: unknown };

    if (parsed && typeof parsed === 'object' && 'text' in parsed) {
      let text_field = typeof parsed.text === 'string' ? parsed.text : '';
      const artifact_field = parsed.artifact;

      let artifact: Artifact | undefined;
      if (artifact_field && typeof artifact_field === 'object' && artifact_field !== null) {
        const a = artifact_field as Record<string, unknown>;
        if (a.type && a.data && typeof a.type === 'string' && typeof a.data === 'object') {
          artifact = a as unknown as Artifact;
        }
      }

      // Strip leaked artifact JSON from text field (mirrors production code)
      text_field = stripArtifactJsonFromText(text_field);
      // Strip "post-answer self-verification" (must run BEFORE stripSurroundingQuotes
      // so we still see the closing quote marker)
      text_field = stripPostAnswerThinking(text_field);
      // Strip leaked thinking patterns (Check constraints: ... matches schema. Proceed.)
      text_field = stripThinkingLines(text_field);
      // Strip surrounding quotes (model sometimes wraps answer in literal " ")
      text_field = stripSurroundingQuotes(text_field);

      const reply = text_field.trim() || (artifact ? 'Here you go.' : 'I had trouble generating a clean response — please try again.');
      return { reply, artifact };
    }
  } catch {
    // Not valid JSON — fall through to legacy regex path
  }

  // ─── FALLBACK PATH: legacy regex cleanup (for qwen + free-text models) ────
  let artifact: Artifact | undefined;

  // Strategy 1
  const fullMatch = text.match(/<<<ARTIFACT>>>\s*([\s\S]*?)\s*<<<END_ARTIFACT>>>/);
  if (fullMatch) {
    try {
      const parsed = JSON.parse(fullMatch[1].trim()) as Artifact;
      if (parsed.type && parsed.data) artifact = parsed;
    } catch { /* */ }
  }
  // Strategy 2
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
        } catch { /* */ }
      }
    }
  }
  // Strategy 3
  if (!artifact) {
    const jsonBlockMatch = text.match(/\{\s*"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[\s\S]*?\n\}/);
    if (jsonBlockMatch) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[0]) as Artifact;
        if (parsed.type && parsed.data) artifact = parsed;
      } catch { /* */ }
    }
  }
  // Strategy 4
  if (!artifact) {
    const fencedMatch = text.match(/```(?:json)?\s*\n?\s*(\{[\s\S]*?"type"\s*:\s*"(chart-bar|chart-line|chart-pie|table|summary)"[\s\S]*?\})\s*\n?\s*```/);
    if (fencedMatch) {
      try {
        const parsed = JSON.parse(fencedMatch[1].trim()) as Artifact;
        if (parsed.type && parsed.data) artifact = parsed;
      } catch { /* */ }
    }
  }
  // Strategy 5 (new)
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
            if (parsed.type && parsed.data) { artifact = parsed; break; }
          } catch { /* */ }
          if (end === 0) break;
        }
      }
    }
  }

  let reply = cleanReplyText(text);

  // ─── Find the LAST answer-prefix and keep only content from there onward ──
  const lastAnswerIdx = findLastAnswerPrefixIndex(reply);
  if (lastAnswerIdx >= 0) {
    reply = reply.slice(lastAnswerIdx).replace(ANSWER_PREFIX_PATTERN, '').trim();
  } else {
    // No answer-prefix found. Check if the model went into explicit "Thinking
    // Process:" mode. If so, the model didn't deliver a clean answer — strip
    // everything (the fallback message will be shown).
    const thinkingHeaderIdx = findThinkingProcessHeader(reply);
    if (thinkingHeaderIdx >= 0) {
      reply = reply.slice(0, thinkingHeaderIdx).trim();
    }
  }

  reply = stripThinkingLines(reply);
  reply = stripPostAnswerThinking(reply);
  reply = stripSurroundingQuotes(reply);
  if (!reply) {
    reply = artifact ? 'Here you go.' : 'I had trouble generating a clean response — please try again.';
  }
  return { reply, artifact };
}

// ─── TEST CASES ──────────────────────────────────────────────────────────

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

// Case 1: User's exact failing paste (truncated mid-artifact, all thinking + JSON inline)
const userLeak = `The user wants to see duplicate invoices. I need to look at the "Duplicate Groups" section in the provided invoice data. There is one duplicate group listed: - Elite Auto Care & Performance | INV-2026-0702-001 | 2026-07-02: 8 copies (amounts: $67676767.00, $3787.30, $3787.30, $3787.30, $3787.30, $3787.30, $3787.30, $3787.30) ⚠️ AMOUNT MISMATCH
I should generate a table artifact showing these duplicates. The table columns should be: Vendor, Invoice #, Date, Amount, Count, IDs. Wait, the prompt says: "Generate a table artifact with columns: Vendor, Invoice #, Date, Amount, Count, IDs" Actually, usually for duplicates, I list the group details. Let's construct the table row for this group. Vendor: Elite Auto Care & Performance Invoice #: INV-2026-0702-001 Date: 2026-07-02 Amount: $3787.30 (7 copies) / $67676767.00 (1 copy) -> I'll list the amounts or note the mismatch. Count: 8 IDs: cmtfqxbyy0001l50431ak5o9x, cmtfp0gef0001l904g6i4f6tg, cmsuthi5a0001jx04fndn7l5j, cmstkp3i60001ib04u44nyppy, cmstiqw4u0001kw045t4qypan, cmsswovr90001jn04ctpkqnd9, cmss4s5hy0001ju04c4fz0lw8, cmss4h3ck0001js04omlsa418

Let's format the table carefully. Columns: Vendor, Invoice #, Date, Amount, Count, IDs Row: Elite Auto Care & Performance | INV-2026-0702-001 | 2026-07-02 | $3,787.30 (7x), $67,676,767.00 (1x) | 8 | cmtfqxbyy0001l50431ak5o9x, cmtfp0gef0001l904g6i4f6tg, cmsuthi5a0001jx04fndn7l5j, cmstkp3i60001ib04u44nyppy, cmstiqw4u0001kw045t4qypan, cmsswovr90001jn04ctpkqnd9, cmss4s5hy0001ju04c4fz0lw8, cmss4h3ck0001js04omlsa418

Wait, the prompt says "Generate a table artifact with columns: Vendor, Invoice #, Date, Amount, Count, IDs". I will follow that exactly.

Let's prepare the artifact. { "type": "table", "title": "Duplicate Invoices", "data": { "columns": ["Vendor", "Invoice #", "Date", "Amount", "Count", "IDs"], "rows": [ { "Vendor": "Elite Auto Care & Performance", "Invoice #": "INV-2026-0702-001", "Date": "2026-07`;

console.log('\nTest 1: User\'s exact leak case (all thinking + truncated inline JSON)');
const r1 = extractArtifact(userLeak);
check('reply contains no "The user wants to"', !r1.reply.includes('The user wants'));
check('reply contains no "I need to"', !r1.reply.includes('I need to'));
check('reply contains no "Let\'s prepare"', !r1.reply.includes("Let's prepare"));
check('reply contains no leaked JSON "{"type"', !r1.reply.includes('{"type"') && !r1.reply.includes('{ "type"'));
check('reply is non-empty / fallback message', r1.reply.length > 0);
check('artifact was NOT extracted (truncated JSON is unparseable)', r1.artifact === undefined);
console.log(`  → Final reply: "${r1.reply}"`);

// Case 2: A proper, well-formed response with artifact markers
const wellFormed = `Here are the duplicates:

<<<ARTIFACT>>>{"type":"table","title":"Duplicate Invoices","data":{"columns":["Vendor","Invoice #","Date","Amount","Count","IDs"],"rows":[{"Vendor":"Acme Corp","Invoice #":"INV-100","Date":"2026-07-02","Amount":"$1,234.56","Count":"3","IDs":"abc, def, ghi"}]}}<<<END_ARTIFACT>>>`;

console.log('\nTest 2: Well-formed response with proper artifact markers');
const r2 = extractArtifact(wellFormed);
check('reply keeps the intro text', r2.reply.includes('Here are the duplicates'));
check('reply has no <<<ARTIFACT>>> markers', !r2.reply.includes('<<<ARTIFACT>>>'));
check('reply has no leaked JSON', !r2.reply.includes('"type":"table"'));
check('artifact was extracted', r2.artifact !== undefined);
check('artifact is a table', r2.artifact?.type === 'table');
check('artifact has correct title', r2.artifact?.title === 'Duplicate Invoices');
check('artifact has 1 row', (r2.artifact?.data.rows as unknown[])?.length === 1);

// Case 3: A clean text-only answer (no artifact, no thinking)
const cleanAnswer = `You have **3 duplicate invoices** totaling **$3,787.30**. All are from Elite Auto Care & Performance, dated 2026-07-02, with invoice number INV-2026-0702-001.`;
console.log('\nTest 3: Clean text answer (no artifact, no thinking)');
const r3 = extractArtifact(cleanAnswer);
check('reply preserved', r3.reply.includes('3 duplicate invoices'));
check('no artifact', r3.artifact === undefined);

// Case 4: Bulleted summary (real content should not be stripped)
const bulleted = `Top vendors by spend:

- **Acme Corp**: $12,345.67 (5 invoices)
- **Beta LLC**: $8,901.23 (3 invoices)
- **Gamma Inc**: $3,456.78 (2 invoices)`;
console.log('\nTest 4: Bulleted answer (must preserve bullets)');
const r4 = extractArtifact(bulleted);
check('bullets preserved', r4.reply.includes('- **Acme Corp**'));
check('all 3 bullets present', r4.reply.includes('Gamma Inc'));

// Case 5: Leading thinking + clean answer (model mostly behaves but adds 1 line of thinking)
const mixedLeak = `Looking at the data, here are the duplicates:

- Acme Corp | INV-100 | $1,234.56
- Beta LLC | INV-200 | $2,000.00`;
console.log('\nTest 5: Leading thinking line + clean bullet answer');
const r5 = extractArtifact(mixedLeak);
check('thinking line stripped', !r5.reply.includes('Looking at the data'));
check('bullets preserved', r5.reply.includes('- Acme Corp'));

// Case 6: Inline JSON with no markers (Strategy 5 should recover it)
const inlineJson = `Here's the chart:

{ "type": "chart-bar", "title": "Vendor Spending", "data": { "data": [{"name":"Acme","value":1234.56},{"name":"Beta","value":2000.00}], "xKey": "name", "yKeys": ["value"], "colors": ["#f59e0b"] } }`;
console.log('\nTest 6: Inline JSON artifact (no markers, complete)');
const r6 = extractArtifact(inlineJson);
check('reply keeps intro', r6.reply.includes("Here's the chart"));
check('reply has no leaked JSON', !r6.reply.includes('"type": "chart-bar"'));
check('artifact extracted via Strategy 5', r6.artifact !== undefined);
check('artifact is chart-bar', r6.artifact?.type === 'chart-bar');
check('artifact has 2 data points', (r6.artifact?.data.data as unknown[])?.length === 2);

// Case 7: User's exact failing paste — llama-3.3 structured planning format
// The model says "The summary states:", "Plan:", "Draft:", "Refining:", "Final check:", "Output:"
// before delivering the actual answer. We need to strip ALL of that and just keep
// the actual answer ("You have 18 invoices..." + the bullets).
const llama33PlanningLeak = ` The summary states: "Current invoice data (18 total)". No artifact is needed for a simple count.
Plan:

State the total number of invoices.
Mention the breakdown by vendor if helpful, but the question is simple "How many".
Keep it to 1-2 sentences.
Draft: You have 18 invoices in total. This includes 8 from Elite Auto Care & Performance, 8 from Unknown vendors, 1 from ABC s.r.o., and 1 from exact company name.

Refining based on "Short answers: 2-4 sentences for simple questions". The draft looks good.

Final check of the data: Total: 18. Vendors:

Elite Auto Care & Performance: 8
ABC s.r.o.: 1
Unknown: 8
exact company name: 1 Sum: 8+1+8+1 = 18. Correct.
Output: You have 18 invoices in total. The breakdown by vendor is:

Elite Auto Care & Performance: 8
Unknown: 8
ABC s.r.o.: 1
exact company name: 1`;
console.log('\nTest 7: llama-3.3 structured planning leak (user\'s exact case)');
const r7 = extractArtifact(llama33PlanningLeak);
check('reply starts with actual answer (not "The summary")', r7.reply.startsWith('You have 18 invoices'));
check('reply has no "The summary states"', !r7.reply.includes('The summary states'));
check('reply has no "Plan"', !r7.reply.includes('Plan'));
check('reply has no "Draft"', !r7.reply.includes('Draft'));
check('reply has no "Refining"', !r7.reply.includes('Refining'));
check('reply has no "Final check"', !r7.reply.includes('Final check'));
check('reply has no "Output:"', !r7.reply.includes('Output:'));
check('reply has no "State the total"', !r7.reply.includes('State the total'));
check('reply has no "Mention the breakdown"', !r7.reply.includes('Mention the breakdown'));
check('reply has no "Keep it to"', !r7.reply.includes('Keep it to'));
check('reply has no "Correct."', !r7.reply.includes('Correct.'));
check('reply has no "Sum: 8+1+8+1"', !r7.reply.includes('Sum: 8+1+8+1'));
check('reply preserves vendor breakdown bullets', r7.reply.includes('Elite Auto Care & Performance: 8'));
check('reply preserves "Unknown: 8" line', r7.reply.includes('Unknown: 8'));
check('reply preserves "ABC s.r.o.: 1" line', r7.reply.includes('ABC s.r.o.: 1'));
check('reply preserves "exact company name: 1" line', r7.reply.includes('exact company name: 1'));
check('reply does NOT include "The draft looks good"', !r7.reply.includes('The draft looks good'));
check('reply does NOT include "No artifact is needed"', !r7.reply.includes('No artifact is needed'));
console.log(`  → Final reply:\n${r7.reply.split('\n').map(l => '    ' + l).join('\n')}`);

// Case 8: User's "give me summary of my invoices" paste — model uses "Thinking Process:"
// header followed by structured analysis, then "Text Construction:" as the answer marker.
// The artifact IS extracted correctly, but the thinking preamble leaked before it.
// We need to slice from the LAST "Text Construction:" marker to keep only the prose answer.
const summaryThinkingPaste = `Thinking Process:
Analyze the Request: The user wants a summary of their invoices.
Analyze the Data:
Total Invoices: 18
Total Amount: $67,723,512.87
Average Confidence: 80.0%
Duplicates: 3 (specifically one group of 8 duplicates for Elite Auto Care & Performance).
Vendor Breakdown:
Elite Auto Care & Performance: 8 invoices, $67,703,278.10
ABC s.r.o.: 1 invoice, $12,100.00
Unknown: 8 invoices, $6,666.65
exact company name: 1 invoice, $1,468.12
Determine Output Format: The user asked for a summary. The instructions specify generating an artifact for summaries.
Artifact Type: summary
Metrics to include: Total Amount, Total Invoices, Average Confidence, Duplicate Count.
Draft the Artifact:
Title: Invoice Summary
Metrics:
Total Amount: $67,723,512.87
Total Invoices: 18
Average Confidence: 80.0%
Duplicates Detected: 3
Draft the Text Response:
State the total amount and invoice count.
Mention the vendor breakdown.
Mention the duplicate issue (Elite Auto Care & Performance).
Refine Text:
"Your invoice data contains 18 invoices totaling $67,723,512.87 with an average confidence score of 80.0%."
"Elite Auto Care & Performance is the primary vendor, accounting for 8 invoices and the vast majority of the total amount."
"There are 3 duplicate groups detected, primarily involving Elite Auto Care & Performance."
Final Output Construction: Combine text and artifact.
Self-Correction during drafting: Ensure I don't use "Here is" or "Sure". Start directly with the answer.

Artifact Construction:

Text Construction: Your invoice data contains 18 invoices totaling $67,723,512.87 with an average confidence score of 80.0%.

Elite Auto Care & Performance is the dominant vendor, representing 8 invoices and $67,703,278.10 of the total value. The remaining invoices are split between ABC s.r.o. ($12,100.00), Unknown vendors ($6,666.65), and exact company name ($1,468.12).

Final Polish: Check constraints. No "Here is`;
console.log('\nTest 8: "Thinking Process:" + "Text Construction:" answer marker');
const r8 = extractArtifact(summaryThinkingPaste);
check('reply does NOT include "Thinking Process:"', !r8.reply.includes('Thinking Process'));
check('reply does NOT include "Analyze the Request"', !r8.reply.includes('Analyze the Request'));
check('reply does NOT include "Analyze the Data"', !r8.reply.includes('Analyze the Data'));
check('reply does NOT include "Vendor Breakdown"', !r8.reply.includes('Vendor Breakdown'));
check('reply does NOT include "Draft the Artifact"', !r8.reply.includes('Draft the Artifact'));
check('reply does NOT include "Self-Correction"', !r8.reply.includes('Self-Correction'));
check('reply does NOT include "Final Polish"', !r8.reply.includes('Final Polish'));
check('reply does NOT include "Text Construction:"', !r8.reply.includes('Text Construction'));
check('reply starts with actual prose answer', r8.reply.startsWith('Your invoice data contains 18 invoices'));
check('reply preserves vendor breakdown prose', r8.reply.includes('Elite Auto Care & Performance is the dominant vendor'));
check('reply preserves ABC s.r.o. mention', r8.reply.includes('ABC s.r.o. ($12,100.00)'));
console.log(`  → Final reply:\n${r8.reply.split('\n').map(l => '    ' + l).join('\n')}`);

// Case 9: User's "are any of them suspicious?" paste — model went into thinking mode
// and ran out of tokens mid-analysis. No artifact, no answer marker, just truncated thinking.
// We should show the fallback message instead of leaking the analysis.
const suspiciousTruncatedPaste = `Thinking Process:
Analyze the Request: The user is asking "are any of them suspicious?" based on the provided invoice data.

Scan the Data for Anomalies/Suspicious Indicators:

Vendor: Elite Auto Care & Performance
Total: $67,703,278.10 (Huge amount for a single vendor, especially an auto care shop).
Duplicates: 8 copies of INV-2026-0702-001.
Amount Mismatch: One copy is $67,676,767.00 (ID: cmtfqxbyy0001l50431ak5o9x), while the other 7 are $3,787.30.
Suspicion: The $67M invoice is likely a parsing error or a fraudulent alteration of the $3,787.30 invoice. The repetition of the exact same invoice number 8 times is also highly suspicious (potential duplicate payment fraud or system glitch).
Vendor: Unknown
8 invoices total.
4 invoices have $0.00 amount (IDs: cmstig4yb0001l104dnbzpkh3, cmstiezrv0001i604l3awke9l, cmst9pfyb0001jp04ci4us0fe).
4 invoices are identical: INV001, 2022-02-15, $1333.33 (IDs: cmst7tmqj0001lc04xufczk9m, cmst6xgnc0001jr04l9mo29ao, cmst5n9uc0005jr042yehnlnc, cmst5m7sh0001jr04i5s50cyc).
Suspicion: $0.00 invoices are often parsing failures or placeholders. The four identical $1333.33 invoices from "Unknown" with the same invoice number and date are likely duplicates or test data.
Vendor: exact company name
Invoice number: exact number. Date: YYYY-MM-DD.
Suspicion: This looks like a template or placeholder invoice, not real data.
Synthesize the Findings:

Elite Auto Care & Performance: Massive outlier amount ($67.6M vs $3.7k) for the same invoice number. High volume of duplicates (8 copies).
Unknown: Multiple $0.00 invoices (parsing errors). Four identical invoices ($1333.33, INV001).
exact company name: Placeholder data ("exact number", "YYYY-MM-DD").
Format the Output:

Direct answer.
Bullet points for the specific suspicious items.
Bold key numbers.
Generate a table artifact highlighting the suspicious invoices.
Drafting the Artifact:

Type: table
Title: "Suspicious Invoices"
Columns: ID, Vendor, Invoice #, Amount, Reason
Rows:
cmtfqxbyy0001l50431ak5o9x, Elite Auto Care..., INV-2026-0702-001, $67,676,767.00, Massive outlier vs duplicates
cmstig4yb0001l104dnbzpkh3, Unknown, N/A, $0.00, Zero amount
\`cmstiezrv000`;
console.log('\nTest 9: Truncated thinking — model ran out of tokens mid-analysis');
const r9 = extractArtifact(suspiciousTruncatedPaste);
check('reply does NOT include "Thinking Process:"', !r9.reply.includes('Thinking Process'));
check('reply does NOT include "Analyze the Request"', !r9.reply.includes('Analyze the Request'));
check('reply does NOT include "Scan the Data"', !r9.reply.includes('Scan the Data'));
check('reply does NOT include "Synthesize the Findings"', !r9.reply.includes('Synthesize the Findings'));
check('reply does NOT include "Format the Output"', !r9.reply.includes('Format the Output'));
check('reply does NOT include "Drafting the Artifact"', !r9.reply.includes('Drafting the Artifact'));
check('reply does NOT include "Vendor: Elite Auto Care"', !r9.reply.includes('Vendor: Elite Auto Care'));
check('reply does NOT include "Suspicion:"', !r9.reply.includes('Suspicion:'));
check('reply does NOT include the truncated row data', !r9.reply.includes('cmstiezrv000'));
check('reply is the fallback message (no artifact, no clean answer)', r9.reply === 'I had trouble generating a clean response — please try again.');
check('no artifact was extracted', r9.artifact === undefined);
console.log(`  → Final reply: "${r9.reply}"`);

// Case 10: JSON-mode structured response — the NEW primary path.
// When the model supports JSON mode, it returns a single JSON object with
// { "text": "...", "artifact": {...}|null }. This should parse cleanly with
// no thinking leak, no regex needed.
console.log('\nTest 10: JSON-mode structured response (primary path, no artifact)');
const jsonModeNoArtifact = JSON.stringify({
  text: "You have 18 invoices in total. The breakdown by vendor is:\n\n- Elite Auto Care & Performance: 8\n- Unknown: 8\n- ABC s.r.o.: 1\n- exact company name: 1",
  artifact: null,
});
const r10 = extractArtifact(jsonModeNoArtifact);
check('reply is the text field verbatim', r10.reply.includes('You have 18 invoices in total'));
check('reply preserves bullets', r10.reply.includes('- Elite Auto Care & Performance: 8'));
check('no artifact', r10.artifact === undefined);
check('reply has no JSON braces', !r10.reply.includes('{') && !r10.reply.includes('}'));
check('reply has no "text" key', !r10.reply.includes('"text"'));
console.log(`  → Final reply:\n${r10.reply.split('\n').map(l => '    ' + l).join('\n')}`);

// Case 11: JSON-mode structured response WITH artifact
console.log('\nTest 11: JSON-mode structured response (with table artifact)');
const jsonModeWithArtifact = JSON.stringify({
  text: "Here are the duplicate invoices I found. Acme Corp has 3 copies of INV-100 all dated 2026-07-02.",
  artifact: {
    type: "table",
    title: "Duplicate Invoices",
    data: {
      columns: ["Vendor", "Invoice #", "Date", "Amount", "Count", "IDs"],
      rows: [
        { Vendor: "Acme Corp", "Invoice #": "INV-100", Date: "2026-07-02", Amount: "$1,234.56", Count: "3", IDs: "abc, def, ghi" },
      ],
    },
  },
});
const r11 = extractArtifact(jsonModeWithArtifact);
check('reply is the prose text', r11.reply.includes('Here are the duplicate invoices'));
check('reply has no leaked JSON', !r11.reply.includes('"type":"table"') && !r11.reply.includes('"type": "table"'));
check('reply has no artifact markers', !r11.reply.includes('<<<ARTIFACT>>>'));
check('artifact was extracted', r11.artifact !== undefined);
check('artifact is a table', r11.artifact?.type === 'table');
check('artifact has correct title', r11.artifact?.title === 'Duplicate Invoices');
check('artifact has 1 row', (r11.artifact?.data.rows as unknown[])?.length === 1);
console.log(`  → Final reply:\n${r11.reply.split('\n').map(l => '    ' + l).join('\n')}`);

// Case 12: JSON-mode response wrapped in markdown fence (some models do this despite instructions)
console.log('\nTest 12: JSON-mode response wrapped in ```json fence (defensive)');
const jsonModeFenced = '```json\n' + JSON.stringify({
  text: "You have 18 invoices in total.",
  artifact: null,
}, null, 2) + '\n```';
const r12 = extractArtifact(jsonModeFenced);
check('reply extracts text despite fence wrapper', r12.reply === 'You have 18 invoices in total.');
check('reply has no fence markers', !r12.reply.includes('```'));
check('no artifact', r12.artifact === undefined);
console.log(`  → Final reply: "${r12.reply}"`);

// Case 13: JSON-mode response with summary artifact
console.log('\nTest 13: JSON-mode response with summary artifact');
const jsonModeSummary = JSON.stringify({
  text: "Your invoice portfolio contains 18 invoices totaling $67,723. Average confidence is 80%.",
  artifact: {
    type: "summary",
    title: "Invoice Summary",
    data: {
      metrics: [
        { label: "Total Amount", value: "$67,723", description: "Sum of all invoices" },
        { label: "Total Invoices", value: "18", description: "Number of invoices processed" },
      ],
    },
  },
});
const r13 = extractArtifact(jsonModeSummary);
check('reply is the prose summary', r13.reply.includes('18 invoices totaling $67,723'));
check('artifact is summary', r13.artifact?.type === 'summary');
check('artifact has 2 metrics', (r13.artifact?.data.metrics as unknown[])?.length === 2);
console.log(`  → Final reply: "${r13.reply}"`);

// Case 14: User's "do you see anything suspicious?" paste — qwen went into
// huge analysis mode in free-text (after JSON validation failed). Pattern:
// "Data Analysis:", "Vendor Breakdown:", "Suspicious items identified:",
// "Highlight the...", "Format the response as...", "Wait, the prompt says...",
// "I will stick to text..." — model ran out of tokens before producing answer.
// We should show the fallback message because there's no "Text: ..." answer.
const suspiciousAnalysisPaste = `Data Analysis:

Total Amount: $67,723,512.87. This is a very large sum.
Vendor Breakdown:
Elite Auto Care & Performance: 8 invoices, total $67,703,278.10. This vendor accounts for 99.97% of the total value.
ABC s.r.o.: 1 invoice, $12,100.00.
Unknown: 8 invoices, total $6,666.65.
exact company name: 1 invoice, $1,468.12.
Duplicate Groups:
Elite Auto Care & Performance | INV-2026-0702-001: 8 copies.
Amounts: One is $67,676,767.00. Seven are $3,787.30.
This is a massive outlier. The single invoice is worth ~17,800 times the others.
The total for this vendor is driven almost entirely by this one outlier.
Confidence Scores:
Most Elite Auto Care invoices have high confidence (96-98%).
Some "Unknown" invoices have 0% or 10% confidence.
Dates:
Elite Auto Care invoices are dated 2026-07-02.
Unknown invoices are dated 2022-02-15 or 2022-01-01.
Suspicious items identified:

Massive Outlier: The $67,676,767.00 invoice from Elite Auto Care is extremely suspicious.
Concentration: One vendor holds almost the entire value of the dataset.
Future Date: The date 2026-07-02 might be suspicious if not expected.
Duplicate Amount Mismatch: The duplicates have a huge amount discrepancy.

Highlight the massive outlier amount ($67.6M vs $3.7k).
Mention the date anomaly (2026).
Mention the concentration of value in a single vendor.
Format the response as JSON with text and a summary artifact (or just text if summary isn't explicitly requested, but the prompt asks for "anything suspicious" which implies a summary of findings is useful. However, strict rules say artifact is null unless asked for table/chart/summary. The user asked "do you see anything suspicious?". This is a question, not a request for a summary table. I will stick to text response, maybe a list in the text field. Wait, the prompt says "You help with... Summaries...". It doesn't say I must generate an artifact for every analysis, only "if the user asked for one". Did the user ask for a summary? No. They asked "do you see anything suspicious?". I will provide the answer in text. If I want to show the invoice, I could generate a table, but it's safer to stick to text unless I explicitly interpret "show me" or "table" in the prompt. I will stick to text to`;
console.log('\nTest 14: qwen free-text analysis — no "Text:" answer (truncated)');
const r14 = extractArtifact(suspiciousAnalysisPaste);
check('reply has no "Data Analysis:"', !r14.reply.includes('Data Analysis'));
check('reply has no "Vendor Breakdown:"', !r14.reply.includes('Vendor Breakdown'));
check('reply has no "Suspicious items identified:"', !r14.reply.includes('Suspicious items identified'));
check('reply has no "Highlight the"', !r14.reply.includes('Highlight the'));
check('reply has no "Format the response"', !r14.reply.includes('Format the response'));
check('reply has no "I will stick to text"', !r14.reply.includes('I will stick to text'));
check('reply has no "Wait, the prompt says"', !r14.reply.includes('Wait, the prompt says'));
// When the model produces a long analysis but no "Text: ..." answer, we keep the
// analysis findings (bullet list of suspicious items) — that's better than a
// "I had trouble..." fallback because the user gets useful information.
check('reply preserves the findings (Massive Outlier)', r14.reply.includes('Massive Outlier'));
check('reply preserves the findings (Concentration)', r14.reply.includes('Concentration'));
check('reply preserves the findings (Future Date)', r14.reply.includes('Future Date'));
check('reply preserves the findings (Duplicate Amount Mismatch)', r14.reply.includes('Duplicate Amount Mismatch'));
console.log(`  → Final reply (first 300 chars):\n${r14.reply.slice(0, 300).split('\n').map(l => '    ' + l).join('\n')}...`);

// Case 15: User's "Show duplicate invoices" paste — qwen free-text mode produced
// pseudo-JSON + Text: "..." answer at the end. We should slice from "Text:" and
// keep the actual answer.
const duplicateTextAnswerPaste = `"Duplicate Groups: - Elite Auto Care & Performance | INV-2026-0702-001 | 2026-07-02: 8 copies (amounts: $67676767.00, $3787.30, $3787.30, $3787.30, $3787.30, $3787.30, $3787.30, $3787.30) ⚠️ AMOUNT MISMATCH"
The columns should be Vendor, Invoice #, Date, Amount, Count, IDs. "columns": ["Vendor", "Invoice #", "Date", "Amount", "Count", "IDs"] "rows": [ { "Vendor": "Elite Auto Care & Performance", "Invoice #": "INV-2026-0702-001", "Date": "2026-07-02", "Amount": "$3,787.30 (1x $67,676,767.00)", "Count": "8", "IDs": "cmtfqxbyy0001l50431ak5o9x, cmtfp0gef0001l904g6i4f6tg, ..." } ]

cmtfqxbyy0001l50431ak5o9x ($67676767.00) cmtfp0gef0001l904g6i4f6tg ($3787.30) cmsuthi5a0001jx04fndn7l5j ($3787.30) cmstkp3i60001ib04u44nyppy ($3787.30) cmstiqw4u0001kw045t4qypan ($3787.30) cmsswovr90001jn04ctpkqnd9 ($3787.30) cmss4s5hy0001ju04c4fz0lw8 ($3787.30) cmss4h3ck0001js04omlsa418 ($3787.30)

Text: "I found 1 duplicate group containing 8 invoices from Elite Auto Care & Performance for invoice #INV-2026-0702-001 dated 2026-07-02. There is an amount mismatch in this group: 7 copies are for $3,787.30, while 1 copy is for $67,676,767.00."`;
console.log('\nTest 15: qwen free-text with "Text: \\"...\\"" answer marker');
const r15 = extractArtifact(duplicateTextAnswerPaste);
check('reply does NOT include "The columns should be"', !r15.reply.includes('The columns should be'));
check('reply does NOT include raw IDs listing', !r15.reply.includes('cmtfqxbyy0001l50431ak5o9x ($67676767.00)'));
check('reply does NOT include "Duplicate Groups:"', !r15.reply.includes('Duplicate Groups:'));
check('reply starts with the actual answer', r15.reply.includes('I found 1 duplicate group containing 8 invoices'));
check('reply preserves the amount mismatch detail', r15.reply.includes('amount mismatch in this group'));
check('reply preserves the $67,676,767.00 outlier', r15.reply.includes('$67,676,767.00'));
console.log(`  → Final reply:\n${r15.reply.split('\n').map(l => '    ' + l).join('\n')}`);

// Case 16: User's "Show duplicate invoices" paste — JSON-mode response where
// the model ALSO leaked artifact JSON inline in the text field. The user sees
// a styled table card AND raw JSON in the chat bubble. We should strip the JSON.
const jsonLeakedInTextPaste = JSON.stringify({
  text: `I found 1 duplicate group containing 8 invoices from Elite Auto Care & Performance for invoice #INV-2026-0702-001 dated 2026-07-02.
,{" "type": "table", "title": "Suspicious Invoices", "data": { "columns": ["Category", "Issue", "Details"], "rows": [ { "Category": "Elite Auto Care & Performance", "Issue": "Massive Duplicate Amount", "Details": "8 copies of INV-2026-0702-001. One is $67,676,767.00 while others are $3,787.30." } ] } }`,
  artifact: {
    type: "table",
    title: "Suspicious Invoices",
    data: {
      columns: ["Category", "Issue", "Details"],
      rows: [
        { Category: "Elite Auto Care & Performance", Issue: "Massive Duplicate Amount", Details: "8 copies of INV-2026-0702-001. One is $67,676,767.00 while others are $3,787.30." },
      ],
    },
  },
});
console.log('\nTest 16: JSON-mode with leaked artifact JSON in text field');
const r16 = extractArtifact(jsonLeakedInTextPaste);
check('reply contains the prose answer', r16.reply.includes('I found 1 duplicate group containing 8 invoices'));
check('reply does NOT contain leaked {"type":"table"} JSON', !r16.reply.includes('"type":"table"') && !r16.reply.includes('"type": "table"'));
check('reply does NOT contain "data": "columns"', !r16.reply.includes('"columns"') && !r16.reply.includes('"rows"'));
check('reply does NOT contain raw JSON artifact', !r16.reply.includes('{') || r16.reply.indexOf('{') === -1);
check('artifact was extracted correctly', r16.artifact !== undefined);
check('artifact is a table', r16.artifact?.type === 'table');
check('artifact has 1 row', (r16.artifact?.data.rows as unknown[])?.length === 1);
console.log(`  → Final reply:\n${r16.reply.split('\n').map(l => '    ' + l).join('\n')}`);

// Case 17: User's "that is the only suspicious one?" paste — qwen went into
// free-text analysis with patterns like "This implies...", "There is...",
// "The user's question...", "Structure: Text:", "Mention the...", then wrote
// "Text: Actually, there are a few other suspicious entries..." at the end.
// We should slice from "Text:" and keep only the actual answer.
const suspiciousFollowupPaste = `This implies a previous turn or context where "suspicious" invoices were discussed, or they are referring to the "Duplicate Groups" or "Unknown" vendors in the data provided. - There is a duplicate group for "Elite Auto Care & Performance" with an amount mismatch (one huge amount vs many small ones). - There are many "Unknown" vendors, which might be considered suspicious or just low confidence. - There is an invoice [cmstfoq7w0001l904nyqw6dqu] with vendor "exact company name" and invoice number "exact number", date "YYYY-MM-DD". This looks like a placeholder or test data, definitely suspicious. - There are invoices with 0% or 10% confidence.
The user's question "that is the only suspicious one?" suggests they might be referring to the duplicate group I just showed (hypothetically) or the "Unknown" ones. Also, the "exact company name" / "exact number" / "YYYY-MM-DD" is definitely suspicious (placeholder data). The "Unknown" vendors are suspicious due to lack of data.

The Elite Auto Care duplicate group has an amount mismatch.
The "exact company name" invoice has placeholder text.
Several invoices have 0% confidence.
The user's phrasing "that is the only suspicious one?" implies they think there's only one. I need to correct them.

Elite Auto Care duplicate group (amount mismatch)
"exact company name" (placeholder data)
Low confidence invoices (0%)
Structure: Text: Clarify that there are actually a few suspicious items. Mention the Elite Auto Care outlier, the placeholder invoice, and the zero-confidence ones.

The Elite Auto Care outlier ($67M)
The placeholder invoice ($1468.12)
The 0% confidence ones ($0.00)
[cmtfqxbyy0001l50431ak5o9x] Elite Auto Care... $67676767.00 - Amount mismatch in duplicate group
[cmstfoq7w0001l904nyqw6dqu] exact company name... YYYY-MM-DD - Placeholder/test data
[cmstig4yb0001l104dnbzpkh3] Unknown... $0.00 - 10% confidence
[cmstiezrv0001i604l3awke9l] Unknown... $0.00 - 0% confidence
[cmst9pfyb0001jp04ci4us0fe] Unknown... $0.00 - 0% confidence
Text: Actually, there are a few other suspicious entries beyond the duplicate group. The invoice from exact company name contains placeholder text like "YYYY-MM-DD". Additionally, there are three invoices with 0% or 10% confidence from unknown vendors.`;
console.log('\nTest 17: qwen free-text followup with "This implies..." analysis');
const r17 = extractArtifact(suspiciousFollowupPaste);
check('reply does NOT include "This implies"', !r17.reply.includes('This implies'));
check('reply does NOT include "The user\'s question"', !r17.reply.includes("The user's question"));
check('reply does NOT include "The user\'s phrasing"', !r17.reply.includes("The user's phrasing"));
check('reply does NOT include "I need to correct them"', !r17.reply.includes('I need to correct them'));
check('reply does NOT include "Structure: Text"', !r17.reply.includes('Structure: Text'));
check('reply does NOT include raw invoice IDs', !r17.reply.includes('cmtfqxbyy0001l50431ak5o9x'));
check('reply starts with the actual answer', r17.reply.startsWith('Actually, there are a few'));
check('reply preserves the placeholder text mention', r17.reply.includes('exact company name contains placeholder text'));
console.log(`  → Final reply:\n${r17.reply.split('\n').map(l => '    ' + l).join('\n')}`);

// Case 18: User's "where can i save money?" paste — model wrapped the answer
// in literal quotes AND appended "Check constraints: ... matches schema. Proceed.
// Self-Correction/Refinement during thought:" after the answer. We should:
//   - Strip the surrounding " " quotes
//   - Strip the "Check constraints: ... matches schema. Proceed." tail
//   - Strip the "Self-Correction/Refinement during thought:" tail
const jsonModeWithQuotesAndVerification = JSON.stringify({
  text: `"Based on your invoice data, the most significant opportunity to save money is addressing a major discrepancy with Elite Auto Care & Performance. There are 8 copies of invoice INV-2026-0702-001, where one amounts to $67,676,767.00 while the other 7 are $3,787.30. This likely indicates a duplicate payment or a data entry error that could save you over $67 million if corrected. Additionally, you have 8 invoices from 'Unknown' vendors (4 at $0.00 and 4 at $1,333.33) that should be reviewed for accuracy or potential cancellation." Check constraints: JSON only. Text field has markdown. Bold key numbers. 2-4 sentences. Looks good. One minor thing: The prompt says "2-4 sentences for simple questions." This fits. Elite Auto Care: 8 copies. One is $67,676,767.00. Seven are $3,787.30. Difference is huge. Unknown: 8 invoices. 4 are $0.00, 4 are $1,333.33. Total invoices: 18. All matches. matches schema. Proceed. Self-Correction/Refinement during thought:`,
  artifact: null,
});
console.log('\nTest 18: JSON-mode with surrounding quotes + self-verification tail');
const r18 = extractArtifact(jsonModeWithQuotesAndVerification);
check('reply does NOT start with a literal quote', !r18.reply.startsWith('"'));
check('reply does NOT end with a literal quote', !r18.reply.endsWith('"'));
check('reply starts with the actual answer', r18.reply.startsWith('Based on your invoice data'));
check('reply does NOT include "Check constraints"', !r18.reply.includes('Check constraints'));
check('reply does NOT include "Looks good"', !r18.reply.includes('Looks good'));
check('reply does NOT include "matches schema"', !r18.reply.includes('matches schema'));
check('reply does NOT include "Self-Correction"', !r18.reply.includes('Self-Correction'));
check('reply does NOT include "Self-Refinement"', !r18.reply.includes('Self-Refinement'));
check('reply does NOT include "The prompt says"', !r18.reply.includes('The prompt says'));
check('reply does NOT include "One minor thing"', !r18.reply.includes('One minor thing'));
check('reply does NOT include "This fits"', !r18.reply.includes('This fits'));
check('reply does NOT include "JSON only"', !r18.reply.includes('JSON only'));
check('reply does NOT include "Text field has markdown"', !r18.reply.includes('Text field has markdown'));
check('reply preserves the $67M opportunity mention', r18.reply.includes('most significant opportunity to save money'));
check('reply preserves the Unknown vendor mention', r18.reply.includes('Unknown') || r18.reply.includes('unknown'));
console.log(`  → Final reply:\n${r18.reply.split('\n').map(l => '    ' + l).join('\n')}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
