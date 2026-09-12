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

  // ─── Multilingual field extraction ────────────────────────────────────
  // Matches field labels in English, Czech, German, French, Spanish, and
  // other languages. The patterns look for the label keyword followed by
  // a value (after a colon, equals, or "is").

  // Vendor: English, Czech, Slovak, German, French, Spanish, Italian, Polish, Portuguese
  const vendorPatterns = [
    /(?:vendor|company|from|supplier|seller)\s*(?:is|:|=)\s*["']?([A-Za-z][A-Za-z0-9\s&.,ěščřžýáíéúůťďňóöüäëïçàâîûôąćęłńóśźżãõáàéêóô]+?)["']?(?:\s*[.\n,]|$)/i,
    // Czech
    /(?:dodavatel|poskytovatel|prodávající)\s*(?:is|:|=|je)?\s*["']?([A-Za-z][A-Za-z0-9\s&.,ěščřžýáíéúůťďňóöüäëïçàâîûôąćęłńóśźż]+?)["']?(?:\s*[.\n,]|$)/i,
    // Slovak
    /(?:dodávateľ|poskytovateľ|predávajúci)\s*(?:is|:|=|je)?\s*["']?([A-Za-z][A-Za-z0-9\s&.,ěščřžýáíéúůťďňóöüäëïçàâîûôąćęłńóśźžľščťžýáíéú]+?)["']?(?:\s*[.\n,]|$)/i,
    // German
    /(?:lieferant|anbieter|rechnung\s+von|verkäufer)\s*(?:is|:|=|ist)?\s*["']?([A-Za-z][A-Za-z0-9\s&.,ěščřžýáíéúůťďňöüäëïçàâîûô]+?)["']?(?:\s*[.\n,]|$)/i,
    // French
    /(?:fournisseur|vendeur|émetteur)\s*(?:est|:|=)?\s*["']?([A-Za-z][A-Za-z0-9\s&.,ěščřžýáíéúůťďňöüäëïçàâîûô]+?)["']?(?:\s*[.\n,]|$)/i,
    // Spanish
    /(?:proveedor|empresa|emisor)\s*(?:es|:|=)?\s*["']?([A-Za-z][A-Za-z0-9\s&.,ěščřžýáíéúůťďňöüäëïçàâîûô]+?)["']?(?:\s*[.\n,]|$)/i,
    // Italian
    /(?:fornitore|venditore|emittente)\s*(?:è|:|=)?\s*["']?([A-Za-z][A-Za-z0-9\s&.,ěščřžýáíéúůťďňöüäëïçàâîûô]+?)["']?(?:\s*[.\n,]|$)/i,
    // Polish
    /(?:dostawca|sprzedawca|wystawca)\s*(?:to|:|=|jest)?\s*["']?([A-Za-z][A-Za-z0-9\s&.,ęąćłńóśźżěščřžýáíéúůťďňöüäëïçàâîûô]+?)["']?(?:\s*[.\n,]|$)/i,
    // Portuguese
    /(?:fornecedor|empresa|emitente|vendedor)\s*(?:é|:|=)?\s*["']?([A-Za-z][A-Za-z0-9\s&.,ěščřžýáíéúůťďňöüäëïçàâîûôãõáàéêóô]+?)["']?(?:\s*[.\n,]|$)/i,
  ];
  for (const p of vendorPatterns) {
    const m = text.match(p);
    if (m) {
      let v = m[1].trim().replace(/^\*+|\*+$/g, '').replace(/^[-*]\s*/, '');
      if (v.length > 1 && !/^(the|this|that|it|a|an|none|null)$/i.test(v)) {
        result.vendor = v;
        break;
      }
    }
  }

  // Invoice number: match patterns in multiple languages
  const invNumPatterns = [
    // English
    /(?:invoice\s*(?:number|#|no))\s*(?:is|:|=)?\s*["']?([A-Z0-9][A-Z0-9\-\/.]+)["']?/i,
    // Czech
    /(?:číslo\s*dokladu|č\.?\s*dokladu|doklad\s*č\.?)\s*[:=]?\s*["']?([0-9A-Z][0-9A-Z\-\/.]+)["']?/i,
    // Slovak
    /(?:číslo\s*dokladu|variabilný\s*symbol|č\.?\s*dokladu)\s*[:=]?\s*["']?([0-9A-Z][0-9A-Z\-\/.]+)["']?/i,
    // German
    /(?:rechnungsnummer|rechnung\s*nr\.?|belegnummer)\s*[:=]?\s*["']?([0-9A-Z][0-9A-Z\-\/.]+)["']?/i,
    // French
    /(?:numéro\s*(?:de\s*)?facture|n°?\s*facture|facture\s*n°?)\s*[:=]?\s*["']?([0-9A-Z][0-9A-Z\-\/.]+)["']?/i,
    // Spanish
    /(?:número\s*de\s*factura|factura\s*n°?)\s*[:=]?\s*["']?([0-9A-Z][0-9A-Z\-\/.]+)["']?/i,
    // Italian
    /(?:numero\s*fattura|fattura\s*n\.?|n\.?\s*fattura)\s*[:=]?\s*["']?([0-9A-Z][0-9A-Z\-\/.]+)["']?/i,
    // Polish
    /(?:numer\s*faktury|faktura\s*nr\.?|nr\.?\s*faktury)\s*[:=]?\s*["']?([0-9A-Z][0-9A-Z\-\/.]+)["']?/i,
    // Portuguese
    /(?:número\s*da\s*nota\s*fiscal|nota\s*fiscal\s*n°?|n°?\s*nota)\s*[:=]?\s*["']?([0-9A-Z][0-9A-Z\-\/.]+)["']?/i,
    // Generic
    /\b(INV[-A-Z0-9\-\/.]+)\b/i,
    /\b(20\d{4,}[-]?\d{2,})\b/i,
  ];
  for (const p of invNumPatterns) {
    const m = text.match(p);
    if (m) {
      result.invoiceNumber = m[1].trim();
      break;
    }
  }

  // Invoice date: multiple languages
  const datePatterns = [
    // English
    /(?:invoice\s*date|date\s*of\s*issue|issue\s*date)\s*(?:is|:|=)\s*["']?(\d{4}-\d{2}-\d{2}|\d{1,2}[.\/]\d{1,2}[.\/]\d{4})["']?/i,
    // Czech / Slovak
    /(?:datum\s*vystavení|datum\s*vydania|datum)\s*[:=]?\s*["']?(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{4}-\d{2}-\d{2})["']?/i,
    // German
    /(?:rechnungsdatum|datum)\s*[:=]?\s*["']?(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{4}-\d{2}-\d{2})["']?/i,
    // French
    /(?:date\s*d[ée]mission|date)\s*[:=]?\s*["']?(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{4}-\d{2}-\d{2})["']?/i,
    // Spanish
    /(?:fecha)\s*[:=]?\s*["']?(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{4}-\d{2}-\d{2})["']?/i,
    // Italian
    /(?:data\s*(?:emissione|fattura|documento)|data)\s*[:=]?\s*["']?(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{4}-\d{2}-\d{2})["']?/i,
    // Polish
    /(?:data\s*wystawienia|data)\s*[:=]?\s*["']?(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{4}-\d{2}-\d{2})["']?/i,
    // Portuguese
    /(?:data\s*(?:emissão|emissao)|data)\s*[:=]?\s*["']?(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{4}-\d{2}-\d{2})["']?/i,
    // Generic
    /(?:date|datum)\s*[:=]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[.\/]\d{1,2}[.\/]\d{4})/i,
  ];
  for (const p of datePatterns) {
    const m = text.match(p);
    if (m) {
      // Normalize date to YYYY-MM-DD
      let dateStr = m[1];
      // If DD.MM.YYYY or DD/MM/YYYY, convert
      const dmyMatch = dateStr.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
      if (dmyMatch) {
        dateStr = `${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`;
      }
      result.invoiceDate = dateStr;
      break;
    }
  }

  // Due date: multiple languages
  const dueDatePatterns = [
    /(?:due\s*date|date\s*due)\s*(?:is|:|=)\s*["']?(\d{4}-\d{2}-\d{2}|\d{1,2}[.\/]\d{1,2}[.\/]\d{4})["']?/i,
    // Czech / Slovak
    /(?:datum\s*splatnosti|splatnosť|splatnost)\s*[:=]?\s*["']?(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{4}-\d{2}-\d{2})["']?/i,
    // German
    /(?:fälligkeitsdatum|fällig\s*am|zahlbar\s*bis)\s*[:=]?\s*["']?(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{4}-\d{2}-\d{2})["']?/i,
    // French
    /(?:date\s*d[ée]chéance|échéance)\s*[:=]?\s*["']?(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{4}-\d{2}-\d{2})["']?/i,
    // Spanish
    /(?:fecha\s*vencimiento|vencimiento|vence)\s*[:=]?\s*["']?(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{4}-\d{2}-\d{2})["']?/i,
    // Italian
    /(?:scadenza|data\s*scadenza)\s*[:=]?\s*["']?(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{4}-\d{2}-\d{2})["']?/i,
    // Polish
    /(?:termin\s*platności|termin\s*platnosci|płatne\s*do)\s*[:=]?\s*["']?(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{4}-\d{2}-\d{2})["']?/i,
    // Portuguese
    /(?:data\s*vencimento|vencimento)\s*[:=]?\s*["']?(\d{1,2}[.\/]\d{1,2}[.\/]\d{4}|\d{4}-\d{2}-\d{2})["']?/i,
  ];
  for (const p of dueDatePatterns) {
    const m = text.match(p);
    if (m) {
      let dateStr = m[1];
      const dmyMatch = dateStr.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
      if (dmyMatch) {
        dateStr = `${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`;
      }
      result.dueDate = dateStr;
      break;
    }
  }

  // Amount (subtotal): multiple languages
  const amountPatterns = [
    /(?:subtotal|amount\s*(?:excl|net))\s*(?:is|:|=)\s*["']?[\$€£ Kč]*\s*([\d.,]+)\s*["']?/i,
    // Czech / Slovak
    /(?:základ|základ\s*daně|bez\s*DPH)\s*[:=]?\s*["']?([\d.,]+)\s* Kč?/i,
    // German
    /(?:betrag|netto|zwischensumme)\s*[:=]?\s*["']?€?\s*([\d.,]+)/i,
    // French
    /(?:montant\s*HT|sous-total|base\s*imposable)\s*[:=]?\s*["']?€?\s*([\d.,]+)/i,
    // Spanish
    /(?:base\s*imponible|subtotal|importe\s*base)\s*[:=]?\s*["']?[\$€]?\s*([\d.,]+)/i,
    // Italian
    /(?:imponibile|totale\s*imponibile|subtotale)\s*[:=]?\s*["']?€?\s*([\d.,]+)/i,
    // Polish
    /(?:wartość\s*netto|netto|podstawa)\s*[:=]?\s*["']?([\d.,]+)\s*zł?/i,
    // Portuguese
    /(?:valor\s*líquido|base\s*de\s*cálculo|subtotal)\s*[:=]?\s*["']?R?\$?\s*([\d.,]+)/i,
  ];
  for (const p of amountPatterns) {
    const m = text.match(p);
    if (m) {
      // Parse number (handle European format: 27.500,00 vs US: 27,500.00)
      let numStr = m[1].replace(/\s/g, '');
      // If it has both . and , → European format (. = thousands, , = decimal)
      if (numStr.includes('.') && numStr.includes(',')) {
        numStr = numStr.replace(/\./g, '').replace(',', '.');
      } else if (numStr.includes(',') && !numStr.includes('.')) {
        // Could be European decimal (27500,00) or US thousands (27,500)
        // If 2 digits after comma, treat as decimal
        const parts = numStr.split(',');
        if (parts[1] && parts[1].length <= 2) {
          numStr = numStr.replace(',', '.');
        } else {
          numStr = numStr.replace(/,/g, '');
        }
      }
      const val = parseFloat(numStr);
      if (!isNaN(val) && val > 0) {
        result.amount = val;
        break;
      }
    }
  }

  // VAT: multiple languages
  const vatPatterns = [
    /(?:vat|tax)\s*(?:is|:|=)\s*["']?[\$€£ Kč]*\s*([\d.,]+)\s*["']?/i,
    // Czech / Slovak
    /(?:dph|daň\s*z\s*přidané\s*hodnoty)\s*[:=]?\s*["']?([\d.,]+)\s* Kč?/i,
    // German
    /(?:mwst|ust\.?|umsatzsteuer)\s*[:=]?\s*["']?€?\s*([\d.,]+)/i,
    // French
    /(?:tva|taxe)\s*[:=]?\s*["']?€?\s*([\d.,]+)/i,
    // Spanish
    /(?:iva|impuesto)\s*[:=]?\s*["']?[\$€]?\s*([\d.,]+)/i,
    // Italian
    /(?:iva|imposta)\s*[:=]?\s*["']?€?\s*([\d.,]+)/i,
    // Polish
    /(?:vat|podatek\s*vat|ptu)\s*[:=]?\s*["']?([\d.,]+)\s*zł?/i,
    // Portuguese
    /(?:iva|imposto)\s*[:=]?\s*["']?R?\$?\s*([\d.,]+)/i,
  ];
  for (const p of vatPatterns) {
    const m = text.match(p);
    if (m) {
      let numStr = m[1].replace(/\s/g, '');
      if (numStr.includes('.') && numStr.includes(',')) {
        numStr = numStr.replace(/\./g, '').replace(',', '.');
      } else if (numStr.includes(',') && !numStr.includes('.')) {
        const parts = numStr.split(',');
        if (parts[1] && parts[1].length <= 2) {
          numStr = numStr.replace(',', '.');
        } else {
          numStr = numStr.replace(/,/g, '');
        }
      }
      const val = parseFloat(numStr);
      if (!isNaN(val)) {
        result.vatAmount = val;
        break;
      }
    }
  }

  // Total: multiple languages
  const totalPatterns = [
    /(?:^|\n|\.\s)(?:grand\s*)?total\s*(?:is|:|=)\s*["']?[\$€£ Kč]*\s*([\d.,]+)\s*["']?/i,
    // Czech / Slovak
    /(?:celkem|celková\s*částka|celkom)\s*(?:k\s*úhradě|k\s*úhrade)?\s*[:=]?\s*["']?([\d.,]+)\s* Kč?/i,
    // German
    /(?:gesamt|gesamtbetrag|endbetrag|summe|rechnungsbetrag)\s*[:=]?\s*["']?€?\s*([\d.,]+)/i,
    // French
    /(?:total\s*TTC|total\s*à\s*payer|montant\s*TTC|net\s*à\s*payer)\s*[:=]?\s*["']?€?\s*([\d.,]+)/i,
    // Spanish
    /(?:total|importe\s*total|total\s*a\s*pagar)\s*[:=]?\s*["']?[\$€]?\s*([\d.,]+)/i,
    // Italian
    /(?:totale|importo\s*totale|totale\s*da\s*pagare)\s*[:=]?\s*["']?€?\s*([\d.,]+)/i,
    // Polish
    /(?:razem|do\s*zapłaty|kwota\s*brutto)\s*[:=]?\s*["']?([\d.,]+)\s*zł?/i,
    // Portuguese
    /(?:total|valor\s*total|total\s*a\s*pagar)\s*[:=]?\s*["']?R?\$?\s*([\d.,]+)/i,
  ];
  for (const p of totalPatterns) {
    const m = text.match(p);
    if (m) {
      let numStr = m[1].replace(/\s/g, '');
      if (numStr.includes('.') && numStr.includes(',')) {
        numStr = numStr.replace(/\./g, '').replace(',', '.');
      } else if (numStr.includes(',') && !numStr.includes('.')) {
        const parts = numStr.split(',');
        if (parts[1] && parts[1].length <= 2) {
          numStr = numStr.replace(',', '.');
        } else {
          numStr = numStr.replace(/,/g, '');
        }
      }
      const val = parseFloat(numStr);
      if (!isNaN(val) && val > 0) {
        result.total = val;
        break;
      }
    }
  }
  // If no total found, try to compute from amount + vat
  if (!result.total && result.amount && result.vatAmount) {
    const amt = result.amount as number;
    const vat = result.vatAmount as number;
    result.total = Math.round((amt + vat) * 100) / 100;
  }

  // Currency: detect from symbols and codes
  if (text.includes('Kč') || text.includes('CZK')) result.currency = 'CZK';
  else if (text.includes('€') || text.includes('EUR')) result.currency = 'EUR';
  else if (text.includes('$') || text.includes('USD')) result.currency = 'USD';
  else if (text.includes('£') || text.includes('GBP')) result.currency = 'GBP';
  else if (text.includes('zł') || text.includes('PLN')) result.currency = 'PLN';
  else if (text.includes('SEK') || text.includes('kr')) result.currency = 'SEK';
  else if (text.includes('NOK')) result.currency = 'NOK';
  else if (text.includes('DKK')) result.currency = 'DKK';
  else if (text.includes('HUF') || text.includes('Ft')) result.currency = 'HUF';
  else if (text.includes('RON') || text.includes('lei')) result.currency = 'RON';
  else if (text.includes('¥') || text.includes('JPY')) result.currency = 'JPY';
  else if (text.includes('R$') || text.includes('BRL')) result.currency = 'BRL';
  else {
    const currMatch = text.match(/(?:currency|měna|währung|devise|moneda|valuta|moeda)\s*[:=]?\s*(CZK|EUR|USD|GBP|JPY|CAD|AUD|CHF|PLN|SEK|NOK|DKK|HUF|RON|BRL)/i);
    if (currMatch) result.currency = currMatch[1].toUpperCase();
  }

  // Confidence
  result.confidence = 0.7;
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

IMPORTANT: The invoice may be in ANY language (English, Czech, German, French, Spanish, etc.). Extract the fields regardless of the document language. Map foreign-language labels to their English equivalents:
- Czech: Dodavatel/Prodávající = vendor, Číslo dokladu/č. faktury = invoice number, Datum vystavení = invoice date, Datum splatnosti = due date, Celkem/Celkem uhradit = total, DPH = VAT, Kč = CZK, Sazba DPH = VAT rate, Základ = amount (net), Položka = line item
- German: Lieferant/Verkäufer = vendor, Rechnungsnummer = invoice number, Rechnungsdatum = invoice date, Fälligkeitsdatum = due date, Gesamtbetrag = total, MwSt/USt = VAT, € = EUR
- French: Fournisseur/Vendeur = vendor, Numéro de facture = invoice number, Date de facture = invoice date, Date d'échéance = due date, Total/Montant TTC = total, TVA = VAT

CRITICAL NUMBER PARSING RULES:
- European number format: "12 705,00" or "12.705,00" means 12705.00 (space/dot = thousands separator, comma = decimal)
- Always convert to standard float: "12 705,00 Kč" → 12705.00
- "7 000,00" → 7000.00 (NOT 7.00 — the space means thousands, not decimal)
- If a number has a space followed by 3 digits and then a comma, it's thousands: "15 300,50" → 15300.50

CRITICAL: Output ONLY the JSON object. Do NOT explain, do NOT analyze, do NOT write any text before or after the JSON. Do NOT include confidence labels or field names as values — only actual data from the document.

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

NEVER put confidence labels (like "High", "Low", "Medium") as field values. Only extract actual data from the document.

If a field is not found, use null. Extract all line items if present. Be precise with numbers — parse European number formats correctly (space = thousands separator, comma = decimal separator).${customFieldsPart}`;
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

The invoice may be in ANY language. Map foreign labels:
- Czech: Dodavatel=vendor, Číslo dokladu=invoice number, Datum vystavení=invoice date, Datum splatnosti=due date, Celkem/Celkem uhradit=total, DPH=VAT, Kč=CZK, Základ=amount(net)
- German: Lieferant=vendor, Rechnungsnummer=invoice number, Rechnungsdatum=invoice date, Fälligkeitsdatum=due date, Gesamtbetrag=total, MwSt=VAT
- French: Fournisseur=vendor, Numéro de facture=invoice number, Date d'échéance=due date, Montant TTC=total, TVA=VAT

EUROPEAN NUMBER FORMAT: "12 705,00" or "12.705,00" = 12705.00 (space/dot=thousands, comma=decimal). "7 000,00" = 7000.00 NOT 7.00.

NEVER put confidence labels ("High", "Low") as field values. Only extract actual data.

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

IMPORTANT: For each field, estimate your extraction confidence (0.0 to 1.0). If a field is not found, use null. Extract all line items if present. Be precise with numbers — parse European number formats correctly.${customFieldPrompt}${textHint}`;
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