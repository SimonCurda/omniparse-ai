import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature, PLAN_LIMITS } from '@/lib/auth';
import {
  runValidationRules,
  runVarianceChecks,
  normalizeInvoiceData,
  checkTampering,
  extractImageMetadata,
  buildCustomFieldPrompt,
  DEFAULT_SETTINGS,
  type UserSettings,
  type ImageMetadata,
  type TamperingCheck,
} from '@/lib/invoice-engine';
import { analyzeImageForAiArtifacts } from '@/lib/ai-visual-analysis';
import { geminiVisionCall, geminiChatCall } from '@/lib/gemini';
import { extractPdfText as extractPdfContent } from '@/lib/pdf-extractor';

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 10 * 1024 * 1024;

/**
 * Extract invoice fields from prose text (last resort when the AI model
 * doesn't output JSON but writes its analysis as text).
 *
 * Example input: "The vendor is Acme Corp. The invoice number is INV-001.
 * The date is 2026-09-01. The total is $641.24."
 *
 * Looks for patterns like:
 * - "Vendor: Acme Corp" or "vendor is Acme Corp" or "Vendor" ... "Acme Corp"
 * - "Invoice #: INV-001" or "Invoice Number: INV-001"
 * - "Date: 2026-09-01" or "Invoice Date: 2026-09-01"
 * - "Total: $641.24" or "Total: 641.24"
 * - etc.
 */
function extractFieldsFromProse(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Vendor: look for "vendor" followed by a value
  // Skip markdown bold markers (**), list markers (- *), and quotes
  const vendorMatch = text.match(/(?:vendor|company|from)\s*(?:is|:|=)\s*["']?([A-Za-z][A-Za-z0-9\s&.,]+?)["']?(?:\s*[.\n]|$)/i);
  if (vendorMatch) {
    let v = vendorMatch[1].trim().replace(/^\*+|\*+$/g, '').replace(/^[-*]\s*/, '');
    // Don't accept very short or generic matches
    if (v.length > 1 && !/^(the|this|that|it|a|an)$/i.test(v)) {
      result.vendor = v;
    }
  }

  // Invoice number: match alphanumeric invoice numbers
  const invNumMatch = text.match(/(?:invoice\s*(?:number|#|no))?\s*(?:is|:|=)\s*["']?(INV[-A-Z0-9\-\/]+)["']?/i);
  if (invNumMatch) result.invoiceNumber = invNumMatch[1].trim();
  else {
    // Also try "Invoice #: XXX"
    const invNumMatch2 = text.match(/invoice\s*#?\s*:?\s*([A-Z]{3,}-[A-Z0-9\-]+)/i);
    if (invNumMatch2) result.invoiceNumber = invNumMatch2[1].trim();
  }

  // Invoice date: YYYY-MM-DD format
  const dateMatch = text.match(/(?:invoice\s*date|date)\s*(?:is|:|=)\s*["']?(\d{4}-\d{2}-\d{2})["']?/i);
  if (dateMatch) result.invoiceDate = dateMatch[1];

  // Due date
  const dueMatch = text.match(/(?:due\s*date)\s*(?:is|:|=)\s*["']?(\d{4}-\d{2}-\d{2})["']?/i);
  if (dueMatch) result.dueDate = dueMatch[1];

  // Amount (subtotal) - look for "subtotal" or "amount" followed by a number
  const amountMatch = text.match(/(?:subtotal|amount)\s*(?:is|:|=)\s*["']?\$?([\d,.]+)["']?/i);
  if (amountMatch) {
    const val = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) result.amount = val;
  }

  // VAT
  const vatMatch = text.match(/(?:vat|tax)\s*(?:is|:|=)\s*["']?\$?([\d,.]+)["']?/i);
  if (vatMatch) {
    const val = parseFloat(vatMatch[1].replace(/,/g, ''));
    if (!isNaN(val)) result.vatAmount = val;
  }

  // Total - look for "total" or "grand total" but NOT "subtotal" or "Unit Price" or "Total:" on a line item
  // Match "Total:" followed by a number, but the number must be > 100 to avoid matching line item totals
  const totalMatch = text.match(/(?:^|\n|\.\s)(?:grand\s*)?total\s*(?:is|:|=)\s*["']?\$?([\d,.]+)["']?/i);
  if (totalMatch) {
    const val = parseFloat(totalMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) result.total = val;
  }
  // If no total found, try to compute from amount + vat
  if (!result.total && result.amount && result.vatAmount) {
    result.total = Math.round((result.amount as number + result.vatAmount as number) * 100) / 100;
  }

  // Currency
  const currencyMatch = text.match(/(?:currency)\s*(?:is|:|=)\s*["']?(USD|EUR|GBP|CZK|JPY|CAD|AUD|CHF)["']?/i);
  if (currencyMatch) result.currency = currencyMatch[1].toUpperCase();
  else if (text.includes('$') || text.includes('USD')) result.currency = 'USD';
  else if (text.includes('EUR') || text.includes('\u20ac')) result.currency = 'EUR';
  else if (text.includes('GBP') || text.includes('\u00a3')) result.currency = 'GBP';

  // Confidence
  result.confidence = 0.7; // Lower confidence for prose extraction
  result.fieldConfidence = {
    vendor: result.vendor ? 0.7 : 0,
    invoiceNumber: result.invoiceNumber ? 0.7 : 0,
    invoiceDate: result.invoiceDate ? 0.7 : 0,
    dueDate: result.dueDate ? 0.7 : 0,
    amount: result.amount ? 0.7 : 0,
    vatAmount: result.vatAmount ? 0.7 : 0,
    total: result.total ? 0.7 : 0,
    currency: result.currency ? 0.8 : 0,
  };

  return result;
}

function buildVlmPrompt(customFieldsPart: string): string {
  const customSuffix = customFieldsPart ? ',\n  ...customFieldsHere' : '';
  return `You are an invoice parser. Extract ALL visible fields from the document image.

CRITICAL: Output ONLY the JSON object. Do NOT explain, do NOT analyze, do NOT write any text before or after the JSON.

Output this EXACT JSON schema (fill in the values, use null for missing fields):
{
  "vendor": "company name or null",
  "invoiceNumber": "invoice number string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "amount": 1234.56 or null,
  "vatAmount": 234.56 or null,
  "total": 1468.12 or null,
  "currency": "USD or EUR or GBP or CZK etc. or null",
  "lineItems": [{"description": "item", "quantity": 1, "unitPrice": 10.00}],
  "fieldConfidence": {
    "vendor": 0.95,
    "invoiceNumber": 0.99,
    "invoiceDate": 0.90,
    "dueDate": 0.90,
    "amount": 0.98,
    "vatAmount": 0.95,
    "total": 0.99,
    "currency": 1.0
  },
  "confidence": 0.93${customSuffix}
}

IMPORTANT: For each field, estimate your extraction confidence (0.0 to 1.0) in the fieldConfidence object. The overall confidence is the average of all field confidences. Be honest - if a field is unclear or smudged, give it a lower confidence. If you cannot find a field at all, use null and give that field a confidence of 0.

If a field is not found, use null. Extract all line items if present. Be precise with numbers.${customFieldsPart}`;
}

function extractPdfMetadata(buffer: Buffer): Record<string, unknown> | null {
  // Simple PDF metadata extraction from raw bytes
  // Look for /CreationDate, /Producer, /Creator, /ModDate in PDF cross-reference
  try {
    const text = buffer.toString('latin1');
    const meta: Record<string, unknown> = {};

    const extractField = (pattern: RegExp, key: string) => {
      const match = text.match(pattern);
      if (match) {
        meta[key] = match[1].trim();
      }
    };

    extractField(/\/CreationDate\s*\(([^)]*)\)/, 'CreationDate');
    extractField(/\/CreationDate\s*([^/\]\s]+)/, 'CreationDate');
    extractField(/\/Producer\s*\(([^)]*)\)/, 'Producer');
    extractField(/\/Producer\s*([^/\]\s]+)/, 'Producer');
    extractField(/\/Creator\s*\(([^)]*)\)/, 'Creator');
    extractField(/\/Creator\s*([^/\]\s]+)/, 'Creator');
    extractField(/\/ModDate\s*\(([^)]*)\)/, 'ModDate');
    extractField(/\/ModDate\s*([^/\]\s]+)/, 'ModDate');
    extractField(/\/Author\s*\(([^)]*)\)/, 'Author');
    extractField(/\/Author\s*([^/\]\s]+)/, 'Author');

    return Object.keys(meta).length > 0 ? meta : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    // Check plan limits
    const user = await db.user.findUnique({ where: { id: auth.userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Count invoices this month only (hard wall per month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const invoiceCount = await db.invoice.count({ where: { userId: auth.userId, createdAt: { gte: new Date(startOfMonth) } } });
    const limit = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
    if (invoiceCount >= limit) {
      return NextResponse.json({ error: `Plan limit reached (${limit} invoices). Upgrade to process more.` }, { status: 429 });
    }

    // Load user settings for custom fields and validation rules
    const userSettings: UserSettings = (user.settings as unknown as UserSettings) || DEFAULT_SETTINGS;
    const customFields = userSettings.customFields?.filter((f) => f.enabled) || [];
    const customFieldPrompt = buildCustomFieldPrompt(customFields);
    const VLM_PROMPT = buildVlmPrompt(customFieldPrompt);

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided. Send a file in the "file" field.' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Accepted: PDF, JPEG, PNG, WebP.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const dataUri = `data:${file.type};base64,${base64}`;

    // ── Metadata extraction for tampering detection ──
    let fileMetadata: Record<string, unknown> | ImageMetadata | null = null;
    if (file.type === 'application/pdf') {
      fileMetadata = extractPdfMetadata(buffer);
    } else if (file.type.startsWith('image/')) {
      fileMetadata = await extractImageMetadata(buffer, file.type);
    }

    // ── AI extraction: PDFs need text/image extraction first, images go straight to vision ──
    let responseText: string;

    if (file.type === 'application/pdf') {
      const pdfResult = await extractPdfContent(buffer);

      if (pdfResult.source === 'image' && pdfResult.images && pdfResult.images.length > 0) {
        // Scanned PDF: send extracted page images (JPEG) to vision model
        const visionContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
          { type: 'text', text: VLM_PROMPT },
        ];
        const MAX_IMG_RAW_BYTES = 3 * 1024 * 1024; // 3MB per image raw limit for Groq
        for (const imgBuf of pdfResult.images.slice(0, 3)) {
          // Validate image has proper JPEG magic bytes
          const isJpeg = imgBuf.length >= 3 && imgBuf[0] === 0xFF && imgBuf[1] === 0xD8 && imgBuf[2] === 0xFF;
          const isPng = imgBuf.length >= 8 && imgBuf[0] === 0x89 && imgBuf[1] === 0x50 && imgBuf[2] === 0x4E && imgBuf[3] === 0x47;
          if (!isJpeg && !isPng) continue; // skip invalid image data
          // Skip images larger than 3MB raw (~4MB base64)
          if (imgBuf.length > MAX_IMG_RAW_BYTES) continue;
          const imgMime = isJpeg ? 'image/jpeg' : 'image/png';
          const imgB64 = imgBuf.toString('base64');
          visionContent.push({
            type: 'image_url' as const,
            image_url: { url: `data:${imgMime};base64,${imgB64}` },
          });
        }
        if (visionContent.length <= 1) {
          // No valid images could be prepared
          return NextResponse.json(
            {
              error: 'Extracted images from PDF were invalid or too large for the AI vision model.',
              hint: 'Try uploading a photo/screenshot of the invoice instead (JPG or PNG).',
              diagnostics: pdfResult.errors,
              imageInfo: pdfResult.images?.map((img) => ({
                size: img.length,
                firstBytes: Array.from(img.slice(0, 4)).map((b) => b.toString(16).padStart(2, '0')).join(' '),
              })),
            },
            { status: 400 },
          );
        }
        responseText = await geminiVisionCall([{ role: 'user', content: visionContent }]);
      } else {
        // Text-based PDF: send extracted text to chat model
        const pdfText = pdfResult.text.trim();
        if (!pdfText) {
          // All extraction paths failed — build a detailed error
          const diagStr = pdfResult.errors?.join('; ') || 'no diagnostics available';
          console.error(`[parse] PDF extraction failed for ${file.name}: ${diagStr}`);
          return NextResponse.json(
            {
              error: 'Could not extract any text or images from this PDF.',
              hint: 'If this is a scanned document, take a screenshot or export as PNG/JPG and upload that instead. If it is a generated PDF, the file may be corrupted or use an unsupported encoding.',
              diagnostics: pdfResult.errors,
            },
            { status: 400 },
          );
        }
        const textHint = pdfText.length < 30
          ? '\n\nNOTE: The extracted text is very short. Do your best to extract any useful information from it.'
          : '';
        const textPrompt = `You are an expert invoice parser. I will give you the extracted text from a PDF invoice. Parse it and return ONLY valid JSON.

Return ONLY valid JSON with no markdown, no code fences, no explanation. Use this EXACT schema:
{
  "vendor": "company name or null",
  "invoiceNumber": "invoice number string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "amount": 1234.56 or null,
  "vatAmount": 234.56 or null,
  "total": 1468.12 or null,
  "currency": "USD or EUR or GBP or CZK etc. or null",
  "lineItems": [{"description": "item", "quantity": 1, "unitPrice": 10.00}],
  "fieldConfidence": {
    "vendor": 0.95, "invoiceNumber": 0.99, "invoiceDate": 0.90, "dueDate": 0.90,
    "amount": 0.98, "vatAmount": 0.95, "total": 0.99, "currency": 1.0
  },
  "confidence": 0.93${customFieldPrompt ? ',\n  ...customFieldsHere' : ''}
}

IMPORTANT: For each field, estimate your extraction confidence (0.0 to 1.0). If a field is not found, use null. Extract all line items if present. Be precise with numbers.${customFieldPrompt}${textHint}`;
        responseText = await geminiChatCall(textPrompt, [{ role: 'user', content: `Here is the invoice text:\n\n${pdfText}` }]);
      }
    } else {
      // Image files: send to vision model
      const content = [
        { type: 'text' as const, text: VLM_PROMPT },
        { type: 'image_url' as const, image_url: { url: dataUri } },
      ];
      responseText = await geminiVisionCall([{ role: 'user', content }]);
    }

    if (!responseText) {
      return NextResponse.json({ error: 'AI returned an empty response. The document may be unreadable.' }, { status: 500 });
    }

    // ─── Clean the AI response before parsing as JSON ────────────────────
    // The vision model (qwen3.6-27b) is a reasoning model and may leak its
    // thinking process before the JSON output. We need to extract just the
    // JSON from the response. Same patterns as the chat cleanup system.
    let cleanResponse = responseText;

    // Strategy 1: Extract from markdown code fences (```json ... ```)
    const fenceMatch = cleanResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      cleanResponse = fenceMatch[1].trim();
    }

    // Strategy 2: If no fence, find the first { and last } — extract JSON object
    if (!fenceMatch) {
      const firstBrace = cleanResponse.indexOf('{');
      const lastBrace = cleanResponse.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        cleanResponse = cleanResponse.slice(firstBrace, lastBrace + 1);
      }
    }

    // Strategy 3: Remove common thinking prefixes (same patterns as chat)
    // The vision model sometimes writes "The user wants me to..." before the JSON
    cleanResponse = cleanResponse.replace(/^[\s\S]*?(?=\{)/, (match) => {
      // Only strip if the text before the first { looks like thinking
      const beforeJson = match.trim();
      if (beforeJson.length < 5) return match;
      // Check for common thinking patterns
      if (/the user wants|I need to|I should|I will|I'll|I'm going to|Let me|The user is/i.test(beforeJson)) {
        return ''; // Strip everything before the first {
      }
      return match;
    });

    // Clean up any remaining markdown
    cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleanResponse);
    } catch {
      // If JSON.parse still fails, try to find any valid JSON object in the text
      const jsonRegex = /\{[\s\S]*\}/;
      const jsonMatch = responseText.match(jsonRegex);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          // ─── LAST RESORT: Prose-to-JSON extraction ──────────────────
          // If the model wrote its analysis as prose (e.g. "The vendor is
          // Acme Corp. The invoice number is INV-2026-001..."), try to
          // extract the fields from the text using pattern matching.
          parsed = extractFieldsFromProse(responseText);
          if (Object.keys(parsed).length === 0) {
            return NextResponse.json({ error: 'AI response could not be parsed as valid JSON.', raw: responseText }, { status: 500 });
          }
        }
      } else {
        // No JSON found at all — try prose extraction
        parsed = extractFieldsFromProse(responseText);
        if (Object.keys(parsed).length === 0) {
          return NextResponse.json({ error: 'AI response could not be parsed as valid JSON.', raw: responseText }, { status: 500 });
        }
      }
    }

    const processingTime = (Date.now() - startTime) / 1000;

    // Extract per-field confidence
    const fieldConfidence = parsed.fieldConfidence as Record<string, number> | undefined;
    const overallConfidence = typeof parsed.confidence === 'number'
      ? Math.min(1, Math.max(0, parsed.confidence))
      : (fieldConfidence
        ? Object.values(fieldConfidence).reduce((a, b) => a + b, 0) / Object.values(fieldConfidence).length
        : 0.8);

    // ---- QUICK WIN #1: Validation Rules Engine ----
    const validationResults = runValidationRules(
      {
        vendor: parsed.vendor as string | null,
        invoiceNumber: parsed.invoiceNumber as string | null,
        invoiceDate: parsed.invoiceDate as string | null,
        dueDate: parsed.dueDate as string | null,
        amount: typeof parsed.amount === 'number' ? parsed.amount : null,
        vatAmount: typeof parsed.vatAmount === 'number' ? parsed.vatAmount : null,
        total: typeof parsed.total === 'number' ? parsed.total : null,
        lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems as Array<{ description?: string; quantity?: number; unitPrice?: number }> : null,
      },
      userSettings.validationRules
    );

    // ---- QUICK WIN #2: Variance Tolerance Checking ----
    const varianceChecks = runVarianceChecks(
      {
        amount: typeof parsed.amount === 'number' ? parsed.amount : null,
        total: typeof parsed.total === 'number' ? parsed.total : null,
        vatAmount: typeof parsed.vatAmount === 'number' ? parsed.vatAmount : null,
        lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems as Array<{ quantity?: number; unitPrice?: number; unitTotal?: number }> : null,
      },
      userSettings.varianceThresholds
    );

    // ---- QUICK WIN #10: Automatic Data Normalization ----
    const normalized = normalizeInvoiceData({
      vendor: parsed.vendor as string | null,
      invoiceDate: parsed.invoiceDate as string | null,
      dueDate: parsed.dueDate as string | null,
      amount: typeof parsed.amount === 'number' ? parsed.amount : null,
      total: typeof parsed.total === 'number' ? parsed.total : null,
      currency: parsed.currency as string | null,
    });

    // ---- QUICK WIN #8: Metadata Tampering Detection (PDF + Image EXIF + AI patterns) ----
    const metadataTamperingCheck = checkTampering(fileMetadata, file.type, {
      invoiceDate: parsed.invoiceDate as string | null,
      vendor: parsed.vendor as string | null,
    });

    // ---- AI Visual Artifact Detection (VLM-based, for image files only) ----
    let visualAiCheck: TamperingCheck | null = null;
    if (file.type.startsWith('image/')) {
      visualAiCheck = await analyzeImageForAiArtifacts(base64, file.type);
    }

    // Merge visual AI checks into metadata tampering check
    let tamperingCheck = metadataTamperingCheck;
    if (visualAiCheck) {
      const mergedChecks = [...metadataTamperingCheck.checks, ...visualAiCheck.checks];
      tamperingCheck = {
        isSuspicious: metadataTamperingCheck.isSuspicious || visualAiCheck.isSuspicious,
        checks: mergedChecks,
      };
    }

    // Extract custom field values if present
    const customFieldValues: Record<string, unknown> = {};
    if (customFields.length > 0) {
      for (const cf of customFields) {
        if (parsed[cf.name] !== undefined) {
          customFieldValues[cf.name] = parsed[cf.name];
        }
      }
    }

    // Combine validation + variance into full results
    const fullValidationResults = {
      ...validationResults,
      varianceChecks,
      tamperingCheck,
    };

    // Determine overall validation status
    let validationStatus = validationResults.status;
    if (varianceChecks.some((v) => v.status === 'reject')) validationStatus = 'fail';
    else if (varianceChecks.some((v) => v.status === 'warn') && validationStatus === 'pass') validationStatus = 'warning';
    if (tamperingCheck.isSuspicious) validationStatus = 'fail';

    // Save to database
    const invoice = await db.invoice.create({
      data: {
        userId: auth.userId,
        filename: file.name,
        vendor: parsed.vendor as string || null,
        invNumber: (parsed.invoiceNumber as string) || null,
        invDate: (parsed.invoiceDate as string) || null,
        dueDate: (parsed.dueDate as string) || null,
        amount: typeof parsed.amount === 'number' ? parsed.amount : null,
        vatAmount: typeof parsed.vatAmount === 'number' ? parsed.vatAmount : null,
        total: typeof parsed.total === 'number' ? parsed.total : null,
        currency: (parsed.currency as string) || 'USD',
        status: validationStatus === 'fail' ? 'review' : validationStatus === 'warning' ? 'review' : overallConfidence >= 0.85 ? 'done' : 'review',
        confidence: overallConfidence,
        fieldConfidence: fieldConfidence ? JSON.parse(JSON.stringify(fieldConfidence)) : Prisma.JsonNull,
        rawExtraction: JSON.parse(JSON.stringify(parsed)),
        lineItems: Array.isArray(parsed.lineItems) ? JSON.parse(JSON.stringify(parsed.lineItems)) : Prisma.JsonNull,
        // New fields
        validationResults: JSON.parse(JSON.stringify(fullValidationResults)),
        validationStatus,
        normalizedVendor: normalized.vendor || null,
        normalizedInvDate: normalized.invDate || null,
        normalizedDueDate: normalized.dueDate || null,
        normalizedAmount: normalized.amount,
        normalizedTotal: normalized.total,
        normalizedCurrency: normalized.currency,
        pdfMetadata: fileMetadata ? JSON.parse(JSON.stringify(fileMetadata)) : Prisma.JsonNull,
        processingTime: Math.round(processingTime * 100) / 100,
        customFields: Object.keys(customFieldValues).length > 0 ? JSON.parse(JSON.stringify(customFieldValues)) : Prisma.JsonNull,
        fileData: base64,
        fileType: file.type,
        // Auto-purge file data after 30 days to save DB storage
        // Extraction results are kept forever; only the binary file preview expires
        fileDataExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // ---- Duplicate Detection ----
    let duplicateCheckResult: { isDuplicate: boolean; duplicateCount: number } | null = null;
    if (hasFeature(user.plan, 'duplicate_detection') && invoice.vendor && invoice.total !== null && invoice.invDate) {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const duplicates = await db.invoice.findMany({
        where: {
          userId: auth.userId,
          id: { not: invoice.id },
          vendor: invoice.vendor,
          total: invoice.total,
          invDate: invoice.invDate,
          createdAt: { gte: new Date(ninetyDaysAgo) },
        },
        take: 5,
      });
      if (duplicates.length > 0) {
        await db.invoice.update({ where: { id: invoice.id }, data: { isDuplicate: true } });
        await db.auditLog.create({
          data: {
            userId: auth.userId,
            invoiceId: invoice.id,
            action: 'uploaded',
            details: { filename: file.name, confidence: overallConfidence, flaggedAsDuplicate: true, duplicateCount: duplicates.length },
          },
        });
        duplicateCheckResult = { isDuplicate: true, duplicateCount: duplicates.length };
      } else {
        duplicateCheckResult = { isDuplicate: false, duplicateCount: 0 };
      }
    }

    // ---- Approval Workflow ----
    let approvalCheckResult: { approvalStatus: string; matchedRuleId: string | null } | null = null;
    if (hasFeature(user.plan, 'approval_workflows')) {
      const rules = await db.approvalRule.findMany({ where: { userId: auth.userId, active: true } });
      const total = invoice.total ?? 0;
      let approvalStatus = 'none';
      let matchedRuleId: string | null = null;
      for (const rule of rules) {
        const min = rule.minAmount ?? -Infinity;
        const max = rule.maxAmount ?? Infinity;
        if (total >= min && total <= max) {
          if (rule.action === 'auto_approve') approvalStatus = 'auto_approved';
          else if (rule.action === 'flag_for_review') { approvalStatus = 'pending_review'; matchedRuleId = rule.id; }
          else if (rule.action === 'block') { approvalStatus = 'blocked'; matchedRuleId = rule.id; }
          break;
        }
      }
      if (approvalStatus !== 'none') {
        await db.invoice.update({ where: { id: invoice.id }, data: { approvalStatus, approvalRuleId: matchedRuleId } });
      }
      approvalCheckResult = { approvalStatus, matchedRuleId };
    }

    // ---- Audit Log (always) ----
    if (!duplicateCheckResult?.isDuplicate) {
      await db.auditLog.create({
        data: {
          userId: auth.userId,
          invoiceId: invoice.id,
          action: 'uploaded',
          details: { filename: file.name, confidence: overallConfidence },
        },
      });
    }

    return NextResponse.json({
      id: invoice.id,
      filename: invoice.filename,
      vendor: invoice.vendor,
      invoiceNumber: invoice.invNumber,
      invoiceDate: invoice.invDate,
      dueDate: invoice.dueDate,
      amount: invoice.amount,
      vatAmount: invoice.vatAmount,
      total: invoice.total,
      currency: invoice.currency,
      status: invoice.status,
      confidence: invoice.confidence,
      fieldConfidence: invoice.fieldConfidence,
      lineItems: invoice.lineItems,
      createdAt: invoice.createdAt,
      // New response fields
      validationResults: invoice.validationResults,
      validationStatus: invoice.validationStatus,
      normalizedData: {
        vendor: invoice.normalizedVendor,
        invDate: invoice.normalizedInvDate,
        dueDate: invoice.normalizedDueDate,
        amount: invoice.normalizedAmount,
        total: invoice.normalizedTotal,
        currency: invoice.normalizedCurrency,
      },
      tamperingCheck: tamperingCheck,
      processingTime: invoice.processingTime,
      customFields: invoice.customFields,
      // Post-processing results
      isDuplicate: duplicateCheckResult?.isDuplicate ?? invoice.isDuplicate,
      approvalStatus: approvalCheckResult?.approvalStatus ?? invoice.approvalStatus,
      duplicateCheck: duplicateCheckResult,
      approvalCheck: approvalCheckResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during AI processing';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}