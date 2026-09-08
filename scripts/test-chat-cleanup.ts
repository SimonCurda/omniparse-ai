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
  /^\s*actually[,:]\s/i,
  /^\s*hmm[,:]\s/i,
  /^\s*ok[,:]\s/i,
  /^\s*alright[,:]\s/i,
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
  /^\s*columns?\s*[:=]\s/i,
  /^\s*rows?\s*[:=]\s/i,
  /^\s*artifact\s*[:=]\s/i,
  /^\s*prepare\s+the\s+artifact/i,
  /^\s*construct\s+the\s+/i,
  /^\s*format\s+the\s+(table|chart|artifact)/i,
];

function stripThinkingLines(reply: string): string {
  if (!reply || reply.length < 20) return reply;
  const lines = reply.split('\n');
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { kept.push(line); continue; }
    if (trimmed.startsWith('<<<ARTIFACT>>>') || trimmed.startsWith('<<<END_ARTIFACT>>>')) { kept.push(line); continue; }
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

function extractArtifact(text: string): { reply: string; artifact: Artifact | undefined } {
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
  reply = stripThinkingLines(reply);
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
