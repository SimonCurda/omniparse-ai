// ─── Email Classifier ─────────────────────────────────────────────────────
// Determines whether an email is likely an invoice before running the
// expensive AI extraction. This is a 2-stage filter:
//
// Stage 1: Keyword heuristic (free, instant)
//   - Check subject + sender name + attachment filename for invoice keywords
//   - If keywords match → return 'invoice' (proceed to full extraction)
//   - If no match → fall through to Stage 2
//
// Stage 2: AI quick-classify (cheap, ~$0.0005)
//   - Only for emails that passed Stage 1 with no keyword match
//   - Uses a cheap text model to look at subject + sender + a snippet of the
//     PDF text and decide YES/NO/MAYBE
//   - Returns 'invoice' | 'maybe' | 'no'
//
// Stage 3 (handled by caller): Confidence threshold
//   - Even if classified as 'invoice', if the full extraction returns low
//     confidence, the caller can downgrade to 'maybe'
//
// This file exports classifyEmail() which runs both stages.

export type EmailClassification = 'invoice' | 'maybe' | 'no';

export interface EmailInfo {
  fromAddress: string;
  fromName?: string | null;
  subject: string;
  attachmentFilename: string;
  // First ~500 chars of PDF/image text content, if extractable cheaply
  pdfTextSnippet?: string | null;
}

// ─── Stage 1: Keyword heuristic ────────────────────────────────────────────
//
// Multilingual — covers English, Czech, German, French, Spanish, Italian,
// Polish, Slovak, Portuguese, Dutch, and a few others.
// We check the subject, sender name, and attachment filename.

const INVOICE_KEYWORDS = [
  // English
  'invoice', 'tax invoice', 'bill', 'statement', 'receipt',
  'purchase invoice', 'sales invoice', 'vat invoice',
  // Czech
  'faktura', 'daňový doklad', 'účet', 'účtenka', 'stvrzenka',
  // Slovak
  'faktúra', 'daňový doklad',
  // German
  'rechnung', 'quittung', 'beleg', 'gutschrift',
  // French
  'facture', 'reçu', 'note',
  // Spanish
  'factura', 'recibo', 'cuenta',
  // Italian
  'fattura', 'ricevuta',
  // Polish
  'faktura', 'rachunek',
  // Portuguese
  'fatura', 'recibo',
  // Dutch
  'factuur', 'bon',
  // Generic filename hints
  '.pdf invoice', 'inv-', 'inv_', 'invoice-', 'invoice_',
];

/**
 * Stage 1 — keyword check. Returns true if any invoice keyword is found
 * in the subject, sender name, or attachment filename.
 */
function hasInvoiceKeywords(info: EmailInfo): boolean {
  const haystack = [
    info.subject || '',
    info.fromName || '',
    info.attachmentFilename || '',
  ].join(' ').toLowerCase();

  // Word-boundary check for short keywords to avoid false positives
  // (e.g. "bill" matching "billion")
  for (const keyword of INVOICE_KEYWORDS) {
    if (keyword.length <= 5) {
      // Use word boundary for short keywords
      const re = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(haystack)) return true;
    } else {
      if (haystack.includes(keyword.toLowerCase())) return true;
    }
  }
  return false;
}

// ─── Stage 2: AI quick-classify ─────────────────────────────────────────────
//
// Only invoked for emails that don't match keyword heuristics.
// Uses a cheap text-model call to look at subject + sender + a snippet of
// the PDF text and decide YES/NO/MAYBE.
//
// We use the existing geminiChatCall from src/lib/gemini.ts since it's
// already wired up in the app. Falls back gracefully if the AI is unavailable.

import { geminiChatCall } from '@/lib/gemini';

async function aiClassify(info: EmailInfo): Promise<EmailClassification> {
  // If we don't have a PDF text snippet, we can't give the AI much context.
  // Default to 'maybe' so the user reviews it.
  const snippet = (info.pdfTextSnippet || '').slice(0, 500);

  const systemPrompt = 'You are an email classifier. You decide whether an email contains an invoice (a request for payment). You reply with exactly ONE word: "invoice", "no", or "maybe".';

  const userPrompt = `Look at this email and decide if it contains an invoice (a request for payment) or just a receipt (payment confirmation).

Sender: ${info.fromAddress}
Sender name: ${info.fromName || '(none)'}
Subject: ${info.subject}
Attachment filename: ${info.attachmentFilename}
First 500 chars of attachment text:
${snippet || '(no text extracted)'}

Reply with exactly ONE word:
- "invoice" if this is clearly an invoice (vendor requesting payment, has line items / total / due date)
- "no" if this is clearly NOT an invoice (newsletter, marketing, bank statement, contract, shipping label, brochure, etc.)
- "maybe" if you're unsure or it's a receipt / quote / credit note

Reply:`;

  try {
    const response = await geminiChatCall(systemPrompt, [
      { role: 'user', content: userPrompt },
    ]);
    const cleaned = (response || '').trim().toLowerCase();
    // Take only the first word, strip any punctuation
    const firstWord = cleaned.split(/\s+/)[0]?.replace(/[^a-z]/g, '');
    if (firstWord === 'invoice') return 'invoice';
    if (firstWord === 'no') return 'no';
    return 'maybe';
  } catch {
    // If AI fails (network error, rate limit, etc.), default to 'maybe'
    // so the user reviews it instead of skipping a real invoice.
    return 'maybe';
  }
}

/**
 * Main entry point — runs Stage 1 (keywords) and Stage 2 (AI) as needed.
 *
 * Returns:
 *   - 'invoice' if keywords matched OR AI said yes
 *   - 'maybe' if AI said maybe, or AI failed
 *   - 'no' if AI said no
 */
export async function classifyEmail(info: EmailInfo): Promise<EmailClassification> {
  // Stage 1 — keywords (free)
  if (hasInvoiceKeywords(info)) {
    return 'invoice';
  }

  // Stage 2 — AI quick-classify (cheap)
  return await aiClassify(info);
}

/**
 * Synchronous version that only runs Stage 1 (keywords).
 * Useful when we don't want to incur AI cost — e.g. for a quick pre-filter
 * before downloading attachments.
 *
 * Returns 'invoice' if keywords matched, otherwise null (= unknown, needs AI).
 */
export function classifyEmailKeywordsOnly(info: Pick<EmailInfo, 'subject' | 'fromName' | 'attachmentFilename'>): EmailClassification | null {
  if (hasInvoiceKeywords(info as EmailInfo)) return 'invoice';
  return null;
}
