import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature, PLAN_LIMITS } from '@/lib/auth';
import { checkMonthlyParseLimit, incrementMonthlyParseCount } from '@/lib/parse-limit';
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
 * Detect the actual file type by inspecting magic bytes (file signature).
 *
 * The Content-Type header set by the browser can be spoofed — a malicious
 * user could upload an executable or a polyglot file with a .pdf extension
 * and Content-Type: application/pdf. This function inspects the actual bytes
 * to verify the file is what it claims to be.
 *
 * Returns one of the ALLOWED_TYPES, or 'unknown' if the signature doesn't
 * match any known type.
 *
 * Signature reference: https://en.wikipedia.org/wiki/List_of_file_signatures
 */
function detectFileTypeFromMagicBytes(buf: Buffer): string {
  if (buf.length < 12) return 'unknown';

  // PDF: starts with %PDF- (hex: 25 50 44 46 2D)
  if (
    buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 &&
    buf[3] === 0x46 && buf[4] === 0x2D
  ) {
    return 'application/pdf';
  }

  // JPEG: starts with \xFF\xD8\xFF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: starts with \x89PNG\r\n\x1A\n (8 bytes)
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
    buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A
  ) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP
  // Bytes 0-3: "RIFF" (52 49 46 46)
  // Bytes 4-7: file size (any)
  // Bytes 8-11: "WEBP" (57 45 42 50)
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return 'image/webp';
  }

  return 'unknown';
}

/**
 * Recursively strip NUL (\u0000) bytes from any string value nested inside
 * objects or arrays. SQLite (and therefore Prisma) rejects strings that
 * contain NUL bytes with a "database disk image is malformed" error.
 * Vision models occasionally emit NUL bytes (especially when OCR'ing
 * scanned PDFs with embedded font subsets), so we sanitize the entire
 * parsed payload before persisting it.
 */
function stripNullBytes(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/\u0000/g, '');
  if (Array.isArray(value)) return value.map(stripNullBytes);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) result[key] = stripNullBytes(val);
    return result;
  }
  return value;
}

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
  // Also handles reasoning model format: **Vendor (Dodavatel):** "Alfa Tech s.r.o."
  const vendorPatterns = [
    // Reasoning model format: **Vendor (Dodavatel):** "value" or **Vendor:** value
    /\*{0,2}vendor\s*\(?(?:dodavatel|prodávající|lieferant|fournisseur|proveedor)?\)?\*{0,2}\s*[:=]\s*["']?([A-Za-z][A-Za-z0-9\s&.,ěščřžýáíéúůťďňóöüäëïçàâîûôąćęłńóśźżãõáàéêóô]+?)["']?(?:\s*[.\n,(]|$)/i,
    // Standard format
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
    // Reasoning model format: **Invoice Number (Číslo dokladu):** "202609015"
    /\*{0,2}invoice\s*number\s*\(?(?:číslo\s*dokladu|variabilný\s*symbol|rechnungsnummer|numéro)?\)?\*{0,2}\s*[:=]?\s*["']?([0-9A-Z][0-9A-Z\-\/.]+)["']?/i,
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
- Czech: Dodavatel/Prodávající = vendor, Číslo dokladu/č. faktury = invoice number, Datum vystavení = invoice date, Datum splatnosti = due date, Celkem/Celkem uhradit/K úhradě = total, DPH = VAT, Kč = CZK, Sazba DPH = VAT rate, Základ = amount (net), Položka = line item
- German: Lieferant/Verkäufer = vendor, Rechnungsnummer = invoice number, Rechnungsdatum = invoice date, Fälligkeitsdatum = due date, Gesamtbetrag/Gesamt = total, MwSt/USt = VAT, € = EUR
- French: Fournisseur/Vendeur = vendor, Numéro de facture = invoice number, Date de facture = invoice date, Date d'échéance = due date, Total/Montant TTC = total, TVA = VAT

CRITICAL: TOTAL FIELD
- "total" is the FINAL AMOUNT TO PAY — the grand total including VAT/tax
- Look for labels like: "Total", "Grand Total", "Amount Due", "Balance Due", "Total TTC", "Celkem", "K úhradě", "Gesamtbetrag", "Total a pagar", "Totale"
- ALWAYS return "total" as a NUMBER (not a string). Example: 1234.56, NOT "1,234.56"
- If the total is written as "1.234,56" (European), convert to 1234.56
- If the total is written as "1,234.56" (US), convert to 1234.56
- If you cannot find a total, look for "amount due", "balance", "to pay", "k úhradě", "zu zahlen"
- If there is NO total visible, compute it: total = amount (net) + vatAmount (tax). Set total to this computed value.

CRITICAL NUMBER PARSING RULES:
- European number format: "12 705,00" or "12.705,00" means 12705.00 (space/dot = thousands separator, comma = decimal)
- US number format: "12,705.00" means 12705.00 (comma = thousands separator, dot = decimal)
- Always convert to standard float: "12 705,00 Kč" → 12705.00
- "7 000,00" → 7000.00 (NOT 7.00 — the space means thousands, not decimal)
- If a number has a space followed by 3 digits and then a comma, it's thousands: "15 300,50" → 15300.50
- ALL numeric fields (amount, vatAmount, total) MUST be returned as numbers, not strings.

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

  // ─── Debug log collector ───────────────────────────────────────────────
  // Users with `debugEnabled` get a full trace of every step of the parse
  // pipeline (PDF extraction, cascade calls, AI response, post-processing)
  // persisted to ParseDebugLog. This is invaluable for diagnosing "the AI
  // returned nothing" tickets without asking the user to re-upload.
  let debugEnabled = false;
  let debugAuthUserId: string | null = null;
  const debugLogs: Array<{ timestamp: string; step: string; data: unknown }> = [];
  const addDebugLog = (step: string, data: unknown) => {
    if (debugEnabled) {
      debugLogs.push({ timestamp: new Date().toISOString(), step, data });
      console.warn(`[parse-debug] ${step}:`, typeof data === 'string' ? data.slice(0, 200) : data);
    }
  };
  let debugFileName: string | null = null;
  let debugFileType: string | null = null;
  let _debugLogSaved = false;

  // Hoisted so the catch block can read it for the pending_retry fallback.
  let buffer: Buffer | undefined;

  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    // Check plan limits
    const user = await db.user.findUnique({ where: { id: auth.userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    debugEnabled = user.debugEnabled === true;
    debugAuthUserId = auth.userId;
    addDebugLog('parse_start', { debugEnabled });

    // Frozen account check — admin can freeze accounts for abuse prevention
    if (!user.active) {
      return NextResponse.json(
        { error: user.frozenReason || 'Your account has been frozen. Please contact support.', code: 'ACCOUNT_FROZEN' },
        { status: 403 },
      );
    }

    // ─── Hard monthly parse limit ────────────────────────────────────
    // Uses a persistent counter on the User model — if a Free user parses
    // 15 invoices, deletes them all, they STILL can't parse more this month.
    // Counter resets on the 1st of each month (checked at runtime).
    const parseLimit = await checkMonthlyParseLimit(auth.userId, user.plan);
    if (!parseLimit.allowed) {
      return NextResponse.json(
        { error: parseLimit.message || `Monthly limit reached (${parseLimit.count}/${parseLimit.limit}). Resets on the 1st of next month.`, code: 'MONTHLY_LIMIT_REACHED' },
        { status: 429 },
      );
    }

    // Load user settings for custom fields and validation rules
    const userSettings: UserSettings = (user.settings as unknown as UserSettings) || DEFAULT_SETTINGS;
    const customFields = userSettings.customFields?.filter((f) => f.enabled) || [];
    const customFieldPrompt = buildCustomFieldPrompt(customFields);
    const VLM_PROMPT = buildVlmPrompt(customFieldPrompt);

    const formData = await req.formData();
    const file = formData.get('file');

    // ─── Email source provenance ────────────────────────────────────────
    // When the request comes from the email approval flow (or future
    // auto-approval webhook), the caller passes email metadata as FormData
    // fields. We stamp these onto the Invoice at creation time so the
    // "From Email" badge shows up regardless of which path triggered parse.
    //
    // Fields (all optional):
    //   emailSource         — 'true' to mark this invoice as email-originated
    //   emailFromAddress    — sender email address
    //   emailFromName       — sender display name
    //   emailSubject        — email subject line
    //   emailDate           — ISO date string when email was received
    //   pendingReviewId     — ID of the PendingReview record this came from
    const emailSource = formData.get('emailSource') === 'true';
    const emailFromAddress = (formData.get('emailFromAddress') as string | null) || null;
    const emailFromName = (formData.get('emailFromName') as string | null) || null;
    const emailSubject = (formData.get('emailSubject') as string | null) || null;
    const emailDate = (formData.get('emailDate') as string | null) || null;
    const pendingReviewId = (formData.get('pendingReviewId') as string | null) || null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided. Send a file in the "file" field.' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Accepted: PDF, JPEG, PNG, WebP.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    // ─── Filename sanitization (defense-in-depth) ──────────────────────
    // Strip everything except [A-Za-z0-9_.\-] — defends against CRLF header
    // injection and path traversal. Also reject suspicious extensions.
    const sanitizedName = (file.name || 'invoice').replace(/[^\w.\-]/g, '_').slice(0, 100);
    if (/\.(exe|bat|cmd|sh|php|js|html?|svg|swf|jar|apk|dll|so)$/i.test(sanitizedName)) {
      return NextResponse.json(
        { error: 'Suspicious filename extension. Upload rejected.' },
        { status: 400 },
      );
    }

    debugFileName = sanitizedName;
    debugFileType = file.type;
    addDebugLog('file_received', { filename: sanitizedName, fileType: file.type, fileSize: file.size });

    buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');

    // ─── Magic byte validation ────────────────────────────────────────
    // The Content-Type header is set by the browser and can be spoofed.
    // Verify the actual file content matches the claimed MIME type by
    // inspecting the first few bytes (file signature).
    //
    // Signatures:
    //   PDF:   %PDF- (25 50 44 46 2D)
    //   JPEG:  \xFF\xD8\xFF
    //   PNG:   \x89PNG\r\n\x1A\n (89 50 4E 47 0D 0A 1A 0A)
    //   WebP:  RIFF....WEBP (52 49 46 46 ?? ?? ?? ?? 57 45 42 50)
    //
    // Rejects polyglot files, MIME-type spoofing, and corrupted uploads
    // that could crash pdfjs-dist or the image parser.
    const detectedType = detectFileTypeFromMagicBytes(buffer);
    if (detectedType !== file.type) {
      console.warn(`[parse] Magic byte mismatch: claimed=${file.type} detected=${detectedType}`);
      return NextResponse.json(
        { error: `File content does not match its claimed type. Claimed ${file.type}, but file signature indicates ${detectedType}. Upload rejected for security.` },
        { status: 400 },
      );
    }

    // ─── PDF JavaScript detection ─────────────────────────────────────
    // PDFs can contain embedded JavaScript (/JS, /JavaScript, /OpenAction,
    // /AA entries). When rendered inline, this JS executes in the user's
    // session context. As defense-in-depth (we also force Content-Disposition:
    // attachment on the download endpoint), scan for these markers and reject.
    if (file.type === 'application/pdf') {
      const pdfText = buffer.toString('latin1');
      const jsPatterns: Array<{ pattern: RegExp; label: string }> = [
        { pattern: /\/JS\s*\(/g, label: '/JS' },
        { pattern: /\/JavaScript\s*\(/g, label: '/JavaScript' },
        { pattern: /\/JavaScript\s*\//g, label: '/JavaScript (ref)' },
        { pattern: /\/OpenAction\s*\(/g, label: '/OpenAction' },
        { pattern: /\/AA\s*\(/g, label: '/AA (additional actions)' },
      ];
      const detected = jsPatterns.find((p) => p.pattern.test(pdfText));
      if (detected) {
        console.warn(`[parse] PDF with embedded JavaScript detected (${detected.label}). Rejecting upload.`);
        return NextResponse.json(
          {
            error: 'PDF contains embedded JavaScript or auto-launch actions. For security, such PDFs cannot be uploaded. Please remove the embedded scripts and try again.',
            reason: 'pdf_embedded_js',
            pattern: detected.label,
          },
          { status: 400 },
        );
      }
    }

    // ─── Image resizing for vision models ──────────────────────────────
    // Vision providers reject payloads over ~2MB and time out on huge
    // images. resizeForVisionAI downsamples to a max long edge of 1568px
    // and re-encodes as JPEG q85 — well under every provider's limit.
    // For PDFs we keep the raw buffer (the PDF extractor handles images).
    let visionBuffer: Buffer = buffer;
    let visionMimeType = file.type;
    if (file.type.startsWith('image/')) {
      const { resizeForVisionAI } = await import('@/lib/image-resize');
      const resized = await resizeForVisionAI(buffer, file.type);
      visionBuffer = resized.buffer;
      visionMimeType = resized.mimeType;
      addDebugLog('image_resized', { originalSize: buffer.length, resizedSize: visionBuffer.length, mimeType: visionMimeType });
    }
    const visionBase64 = visionBuffer.toString('base64');
    const dataUri = `data:${visionMimeType};base64,${visionBase64}`;

    // ── Metadata extraction for tampering detection ──
    let fileMetadata: Record<string, unknown> | ImageMetadata | null = null;
    if (file.type === 'application/pdf') {
      fileMetadata = extractPdfMetadata(buffer);
    } else if (file.type.startsWith('image/')) {
      fileMetadata = await extractImageMetadata(buffer, file.type);
    }

    // ── AI extraction: PDFs and images both go to vision model ──────
    // Previously, text-based PDFs used geminiChatCall (text cascade) which
    // has fewer providers and fails more often. Now ALL files go through
    // geminiVisionCall (4-provider vision cascade) for reliability.
    // Text extraction is only used as a fallback if vision also fails.
    let responseText: string;

    if (file.type === 'application/pdf') {
      const pdfResult = await extractPdfContent(buffer);
      addDebugLog('pdf_extraction_result', {
        source: pdfResult.source,
        textLength: pdfResult.text?.length ?? 0,
        textPreview: pdfResult.text?.slice(0, 500) ?? '',
        imageCount: pdfResult.images?.length ?? 0,
        errors: pdfResult.errors,
      });

      // ── Path A: PDF has extractable images (scanned PDFs) ────────
      // Send images directly to vision model.
      if (pdfResult.source === 'image' && pdfResult.images && pdfResult.images.length > 0) {
        const visionContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
          { type: 'text', text: VLM_PROMPT },
        ];
        const MAX_IMG_RAW_BYTES = 3 * 1024 * 1024;
        for (const imgBuf of pdfResult.images.slice(0, 3)) {
          const isJpeg = imgBuf.length >= 3 && imgBuf[0] === 0xFF && imgBuf[1] === 0xD8 && imgBuf[2] === 0xFF;
          const isPng = imgBuf.length >= 8 && imgBuf[0] === 0x89 && imgBuf[1] === 0x50 && imgBuf[2] === 0x4E && imgBuf[3] === 0x47;
          if (!isJpeg && !isPng) continue;
          if (imgBuf.length > MAX_IMG_RAW_BYTES) continue;
          const imgMime = isJpeg ? 'image/jpeg' : 'image/png';
          visionContent.push({
            type: 'image_url' as const,
            image_url: { url: `data:${imgMime};base64,${imgBuf.toString('base64')}` },
          });
        }
        if (visionContent.length > 1) {
          try {
            responseText = await geminiVisionCall([{ role: 'user', content: visionContent }]);
            addDebugLog('pdf_vision_success', { responseLength: responseText.length });
          } catch (visionErr) {
            // Vision cascade failed entirely — try text extraction as fallback.
            // Scanned PDFs sometimes have OCR text layer; if so, use text cascade.
            addDebugLog('pdf_vision_failed', { error: visionErr instanceof Error ? visionErr.message : String(visionErr) });
            console.warn('[parse] Vision cascade failed, trying text fallback:', visionErr instanceof Error ? visionErr.message : String(visionErr));
            if (pdfResult.text.trim()) {
              const textPrompt = VLM_PROMPT + '\n\n--- EXTRACTED PDF TEXT (fallback) ---\n' + pdfResult.text;
              addDebugLog('text_cascade_start', { promptLength: textPrompt.length, trigger: 'vision_failed' });
              try {
                responseText = await geminiChatCall(
                  'You are an invoice parser. Extract all fields and return ONLY valid JSON.',
                  [{ role: 'user', content: textPrompt }],
                );
                addDebugLog('text_cascade_success', { responseLength: responseText.length, responsePreview: responseText.slice(0, 300) });
              } catch (textErr) {
                addDebugLog('text_cascade_failed', { error: textErr instanceof Error ? textErr.message : String(textErr) });
                throw visionErr; // No text — re-throw the vision error
              }
            } else {
              throw visionErr; // No text — re-throw the vision error
            }
          }
        } else {
          // Images were invalid — try text path as fallback
          if (pdfResult.text.trim()) {
            const textPrompt = VLM_PROMPT + '\n\n--- EXTRACTED PDF TEXT ---\n' + pdfResult.text;
            addDebugLog('text_cascade_start', { promptLength: textPrompt.length, trigger: 'invalid_images' });
            responseText = await geminiChatCall('You are an invoice parser. Extract all fields and return ONLY valid JSON.', [{ role: 'user', content: textPrompt }]);
            addDebugLog('text_cascade_success', { responseLength: responseText.length, responsePreview: responseText.slice(0, 300) });
          } else {
            return NextResponse.json({ error: 'Could not extract usable content from this PDF.', diagnostics: pdfResult.errors }, { status: 400 });
          }
        }
      }
      // ── Path B: PDF has extractable text (text-based PDFs) ───────
      // Send the text to the TEXT chat cascade (NOT vision). Text models
      // have much higher rate limits (30k OTPM on Groq vs 2k on vision)
      // and more available free-tier models. This fixes the "all vision
      // models unavailable" error that happens when vision providers are
      // rate-limited but text providers are fine.
      else if (pdfResult.text.trim()) {
        const normalizedText = pdfResult.text
          .replace(/(\d)\s(\d{3}),(\d{2})/g, '$1$2.$3')
          .replace(/(\d)\.(\d{3}),(\d{2})/g, '$1$2.$3')
          .replace(/(\d),(\d{2})\b/g, '$1.$2');

        // Use text cascade (Mistral small/open-mistral-7b → Groq llama-3.1)
        // instead of vision cascade (pixtral → Groq vision). Text models
        // are more reliable and have higher rate limits.
        const textPrompt = VLM_PROMPT + '\n\n--- EXTRACTED PDF TEXT ---\n' + normalizedText;
        addDebugLog('text_cascade_start', { promptLength: textPrompt.length });
        try {
          responseText = await geminiChatCall(
            'You are an invoice parser. Extract all fields and return ONLY valid JSON.',
            [{ role: 'user', content: textPrompt }],
          );
          addDebugLog('text_cascade_success', { responseLength: responseText.length, responsePreview: responseText.slice(0, 300) });
        } catch (textErr) {
          // Text cascade failed — try the vision cascade with a text-only
          // payload (no image). Some vision providers accept pure-text
          // turns and have different rate-limit pools than the text
          // providers, so this often recovers a parse that would otherwise
          // hard-fail.
          addDebugLog('text_cascade_failed', { error: textErr instanceof Error ? textErr.message : String(textErr) });
          addDebugLog('vision_text_fallback_start', {});
          const visionTextContent = [
            { type: 'text' as const, text: VLM_PROMPT },
            { type: 'text' as const, text: '--- EXTRACTED PDF TEXT ---\n' + normalizedText },
          ];
          try {
            responseText = await geminiVisionCall([{ role: 'user', content: visionTextContent }]);
            addDebugLog('vision_text_fallback_success', { responseLength: responseText.length, responsePreview: responseText.slice(0, 300) });
          } catch (visionErr) {
            addDebugLog('vision_text_fallback_failed', { error: visionErr instanceof Error ? visionErr.message : String(visionErr) });
            throw textErr;
          }
        }
      } else {
        // No text and no images — try direct PDF-to-vision (send raw PDF
        // bytes as a base64 application/pdf data URI). Several vision
        // providers (Gemini, OpenAI) accept PDFs directly and will render
        // the pages server-side. If that also fails we fall back to
        // rendering the first page to a PNG with pdfjs-dist + canvas.
        addDebugLog('no_text_no_images', { source: pdfResult.source, errors: pdfResult.errors });
        let pdfVisionSucceeded = false;
        try {
          const pdfBase64 = buffer.toString('base64');
          const pdfVisionContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
            { type: 'text', text: VLM_PROMPT },
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBase64}` } },
          ];
          addDebugLog('direct_pdf_to_vision_start', { pdfBytes: buffer.length });
          responseText = await geminiVisionCall([{ role: 'user', content: pdfVisionContent }]);
          addDebugLog('direct_pdf_to_vision_success', { responseLength: responseText.length, responsePreview: responseText.slice(0, 300) });
          pdfVisionSucceeded = true;
        } catch (visionErr) {
          addDebugLog('direct_pdf_to_vision_failed', { error: visionErr instanceof Error ? visionErr.message : String(visionErr) });
        }

        if (!pdfVisionSucceeded) {
          // Fall back to rendering the first page to a PNG image, then
          // sending that to the vision cascade.
          try {
            const { renderPdfFirstPageToPng } = await import('@/lib/pdf-to-image');
            const imgBuf = await renderPdfFirstPageToPng(buffer);
            if (imgBuf) {
              addDebugLog('pdf_to_image_render_success', { imageBytes: imgBuf.length });
              const imgContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
                { type: 'text', text: VLM_PROMPT },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${imgBuf.toString('base64')}` } },
              ];
              responseText = await geminiVisionCall([{ role: 'user', content: imgContent }]);
              addDebugLog('pdf_to_image_vision_success', { responseLength: responseText.length, responsePreview: responseText.slice(0, 300) });
            } else {
              addDebugLog('pdf_to_image_render_empty', {});
              return NextResponse.json(
                { error: 'Could not extract any text or images from this PDF.', hint: 'Try uploading a photo/screenshot (JPG or PNG) instead.', diagnostics: pdfResult.errors },
                { status: 400 },
              );
            }
          } catch (renderErr) {
            addDebugLog('pdf_to_image_fallback_failed', { error: renderErr instanceof Error ? renderErr.message : String(renderErr) });
            return NextResponse.json(
              { error: 'Could not extract any text or images from this PDF.', hint: 'Try uploading a photo/screenshot (JPG or PNG) instead.', diagnostics: pdfResult.errors },
              { status: 400 },
            );
          }
        }
      }
    } else {
      // Image files: send to vision model
      const content = [
        { type: 'text' as const, text: VLM_PROMPT },
        { type: 'image_url' as const, image_url: { url: dataUri } },
      ];
      addDebugLog('image_vision_start', { mimeType: visionMimeType, dataUriBytes: visionBase64.length });
      try {
        responseText = await geminiVisionCall([{ role: 'user', content }]);
        addDebugLog('image_vision_success', { responseLength: responseText.length, responsePreview: responseText.slice(0, 300) });
      } catch (visionErr) {
        addDebugLog('image_vision_failed', { error: visionErr instanceof Error ? visionErr.message : String(visionErr) });
        throw visionErr;
      }
    }

    if (!responseText) {
      addDebugLog('empty_ai_response', {});
      return NextResponse.json({ error: 'AI returned an empty response. The document may be unreadable.' }, { status: 500 });
    }

    addDebugLog('raw_ai_response', { length: responseText.length, preview: responseText.slice(0, 500) });

    // ─── Clean the AI response before parsing as JSON ────────────────────
    // The vision model (qwen3.6-27b) is a reasoning model and may leak its
    // thinking process before the JSON output. We need to extract just the
    // JSON from the response.
    let cleanResponse = responseText;

    // Strategy 1: Extract from markdown code fences (```json ... ```)
    const fenceMatch = cleanResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      cleanResponse = fenceMatch[1].trim();
    }

    // Strategy 2: Find the ACTUAL JSON object by looking for {"vendor" or
    // { "vendor" — this is the start of our expected JSON schema.
    // The reasoning model writes thinking text that may contain { characters
    // inside prose (e.g. "Vendor (Dodavatel): {Alfa Tech}"), so we can't
    // just use the first {.
    if (!fenceMatch) {
      // Try to find the JSON object that starts with {"vendor or { "vendor
      const jsonStartMatch = cleanResponse.match(/\{\s*"vendor"\s*:/);
      if (jsonStartMatch && jsonStartMatch.index !== undefined) {
        const lastBrace = cleanResponse.lastIndexOf('}');
        if (lastBrace > jsonStartMatch.index) {
          cleanResponse = cleanResponse.slice(jsonStartMatch.index, lastBrace + 1);
        }
      } else {
        // Fallback: find first { and last }
        const firstBrace = cleanResponse.indexOf('{');
        const lastBrace = cleanResponse.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          cleanResponse = cleanResponse.slice(firstBrace, lastBrace + 1);
        }
      }
    }

    // Strategy 3: Remove common thinking prefixes
    cleanResponse = cleanResponse.replace(/^[\s\S]*?(?=\{)/, (match) => {
      const beforeJson = match.trim();
      if (beforeJson.length < 5) return match;
      if (/the user wants|I need to|I should|I will|I'll|I'm going to|Let me|The user is/i.test(beforeJson)) {
        return '';
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
          parsed = extractFieldsFromProse(responseText);
          if (Object.keys(parsed).length === 0) {
            return NextResponse.json({ error: 'AI response could not be parsed as valid JSON.', raw: responseText }, { status: 500 });
          }
        }
      } else {
        parsed = extractFieldsFromProse(responseText);
        if (Object.keys(parsed).length === 0) {
          return NextResponse.json({ error: 'AI response could not be parsed as valid JSON.', raw: responseText }, { status: 500 });
        }
      }
    }

    // ─── Post-parse cleanup: detect and fix thinking-leak field values ──
    // Reasoning models (qwen3.6-27b) sometimes leak their thinking into
    // JSON values. Examples:
    //   vendor: "High confidence" → should be the actual vendor name
    //   invoiceNumber: "High" → should be the actual invoice number
    //   vendor: "The vendor is Acme Corp" → should be "Acme Corp"
    // We detect and clean these patterns.
    const THINKING_LEAK_PATTERNS = /^(high|low|medium|none|n\/a|not found|unknown|the vendor is|the invoice number is|confidence:?\s)/i;
    const stringFields = ['vendor', 'invoiceNumber', 'invoiceDate', 'dueDate', 'currency'];
    for (const field of stringFields) {
      if (typeof parsed[field] === 'string') {
        const val = (parsed[field] as string).trim();
        // Check for thinking leaks
        if (THINKING_LEAK_PATTERNS.test(val) || val.toLowerCase() === 'high confidence') {
          console.warn(`[parse] Detected thinking-leak in field "${field}": "${val}" → setting to null`);
          parsed[field] = null;
        }
        // Check for "The vendor is X" pattern → extract X
        const prefixMatch = val.match(/^the\s+(?:vendor|invoice\s+number|date|currency)\s+is\s+(.+)/i);
        if (prefixMatch) {
          parsed[field] = prefixMatch[1].trim();
        }
      }
    }

    // ─── Coerce non-string fields to strings (defensive) ──────────────
    // Vision models sometimes return string fields as arrays or objects
    // (e.g. vendor: ["Acme Ltd"] or vendor: {name: "Acme Ltd"}).
    // Coerce them to strings so downstream code that calls .trim() doesn't crash.
    for (const field of stringFields) {
      const val = parsed[field];
      if (val === null || val === undefined) continue;
      if (typeof val === 'string') continue;
      if (Array.isArray(val)) {
        // Take first element if it's a string, else stringify
        parsed[field] = typeof val[0] === 'string' ? val[0] : String(val[0] ?? '');
        console.warn(`[parse] Coerced ${field} from array to string: ${JSON.stringify(val)} → ${parsed[field]}`);
      } else if (typeof val === 'object') {
        // Try common keys: name, vendor, company
        const v = val as Record<string, unknown>;
        const candidate = v.name ?? v.vendor ?? v.company ?? v.value ?? '';
        parsed[field] = typeof candidate === 'string' ? candidate : String(candidate ?? '');
        console.warn(`[parse] Coerced ${field} from object to string: ${JSON.stringify(val)} → ${parsed[field]}`);
      } else {
        parsed[field] = String(val);
        console.warn(`[parse] Coerced ${field} from ${typeof val} to string: ${val} → ${parsed[field]}`);
      }
    }

    // ─── Post-parse cleanup: fix European number format in numeric fields ──
    // The AI might return numbers as strings with European format
    // (e.g. "12 705,00" or "12705,00"). Convert to proper float.
    const numericFields = ['amount', 'vatAmount', 'total'];
    for (const field of numericFields) {
      if (typeof parsed[field] === 'string') {
        const strVal = parsed[field] as string;
        // Parse number from string — handle both European and US formats.
        //
        // European: "1.234,56" or "1 234,56" (dot/space = thousands, comma = decimal)
        // US:       "1,234.56"              (comma = thousands, dot = decimal)
        //
        // Strategy: detect which format by checking if there's a comma AFTER
        // the last dot (European) or a dot AFTER the last comma (US).
        let cleaned = strVal;

        // Step 1: Remove currency symbols and labels
        cleaned = cleaned
          .replace(/[€$£¥Kč\sczk]/gi, '')  // remove currency chars + spaces
          .trim();

        // Step 2: Detect format
        const lastComma = cleaned.lastIndexOf(',');
        const lastDot = cleaned.lastIndexOf('.');

        if (lastComma > lastDot) {
          // European format: comma is decimal separator
          // Remove dots (thousands separator): "1.234,56" → "1234,56"
          cleaned = cleaned.replace(/\./g, '');
          // Replace comma with dot: "1234,56" → "1234.56"
          cleaned = cleaned.replace(/,/g, '.');
        } else if (lastDot > lastComma) {
          // US format: dot is decimal separator
          // Remove commas (thousands separator): "1,234.56" → "1234.56"
          cleaned = cleaned.replace(/,/g, '');
        }
        // If neither comma nor dot, just parse as-is

        const num = parseFloat(cleaned);
        if (!isNaN(num)) {
          parsed[field] = num;
          console.warn(`[parse] Converted field "${field}" from string "${strVal}" to number ${num} (cleaned: ${cleaned})`);
        } else {
          console.warn(`[parse] Could not parse number from "${strVal}" (cleaned: ${cleaned})`);
        }
      }
    }

    // ─── Fallback: compute total from amount + VAT if total is missing ──
    // If the AI couldn't extract total but did extract amount (net) and
    // vatAmount, compute total = amount + vatAmount.
    if (typeof parsed.total !== 'number' || parsed.total === null) {
      const amt = typeof parsed.amount === 'number' ? parsed.amount : null;
      const vat = typeof parsed.vatAmount === 'number' ? parsed.vatAmount : null;
      if (amt !== null && vat !== null) {
        const computedTotal = Math.round((amt + vat) * 100) / 100;
        parsed.total = computedTotal;
        console.warn(`[parse] Total was missing — computed from amount(${amt}) + vat(${vat}) = ${computedTotal}`);
      } else if (amt !== null && vat === null) {
        // If we have amount but no VAT, assume amount IS the total
        parsed.total = amt;
        console.warn(`[parse] Total was missing — using amount(${amt}) as total (no VAT extracted)`);
      }
    }

    // ─── Fallback: compute total from line items if still missing ──────
    if (typeof parsed.total !== 'number' || parsed.total === null) {
      if (Array.isArray(parsed.lineItems) && parsed.lineItems.length > 0) {
        const lineTotal = parsed.lineItems.reduce((sum: number, item: Record<string, unknown>) => {
          const qty = typeof item.quantity === 'number' ? item.quantity : 1;
          const price = typeof item.unitPrice === 'number' ? item.unitPrice : 0;
          return sum + (qty * price);
        }, 0);
        if (lineTotal > 0) {
          parsed.total = Math.round(lineTotal * 100) / 100;
          console.warn(`[parse] Total was missing — computed from ${parsed.lineItems.length} line items = ${parsed.total}`);
        }
      }
    }

    // ─── Post-parse cleanup: detect VAT rate mistaken for VAT amount ──
    // If vatAmount is a small number that looks like a percentage (e.g. 21.00
    // when the VAT rate is 21%), it's probably the rate, not the amount.
    // Fix: if vatAmount < 100 and total > 0, calculate the actual VAT from
    // the total (assuming the total includes VAT).
    if (typeof parsed.vatAmount === 'number' && typeof parsed.total === 'number' && parsed.total > 0) {
      const vat = parsed.vatAmount as number;
      const total = parsed.total as number;
      // If the VAT "amount" looks like a percentage (0-100) and is much
      // smaller than what the actual VAT should be, recalculate
      if (vat > 0 && vat <= 100 && vat < total * 0.01) {
        // Try to find the VAT rate from the document
        const possibleRates = [21, 20, 19, 15, 10, 25, 12, 5, 0]; // common EU rates
        for (const rate of possibleRates) {
          if (Math.abs(vat - rate) < 0.5) {
            // Found the rate — calculate actual VAT amount
            const calculatedVat = Math.round(total * rate / (100 + rate) * 100) / 100;
            console.warn(`[parse] VAT ${vat} looks like rate ${rate}%, not amount. Recalculated VAT amount: ${calculatedVat} (from total ${total})`);
            parsed.vatAmount = calculatedVat;
            parsed.amount = Math.round((total - calculatedVat) * 100) / 100;
            break;
          }
        }
      }
    }

    const processingTime = (Date.now() - startTime) / 1000;

    // Extract per-field confidence
    const fieldConfidence = parsed.fieldConfidence as Record<string, number> | undefined;
    let overallConfidence = typeof parsed.confidence === 'number'
      ? Math.min(1, Math.max(0, parsed.confidence))
      : (fieldConfidence
        ? Object.values(fieldConfidence).reduce((a, b) => a + b, 0) / Object.values(fieldConfidence).length
        : 0.8);

    // ─── All-nulls fallback ──────────────────────────────────────────────
    // If the AI returned confidence === 0 AND every primary field is null,
    // the text extraction likely produced garbage that confused the model.
    // For PDFs, render the first page to a PNG and re-run the vision
    // cascade — this usually recovers a real parse from scanned PDFs
    // whose embedded text layer is corrupt or empty.
    if (file.type === 'application/pdf' && overallConfidence === 0) {
      const allFieldsNull =
        parsed.vendor == null &&
        parsed.invoiceNumber == null &&
        parsed.invoiceDate == null &&
        parsed.total == null &&
        parsed.amount == null;
      if (allFieldsNull) {
        addDebugLog('all_nulls_fallback_start', {});
        try {
          const { renderPdfFirstPageToPng } = await import('@/lib/pdf-to-image');
          const imgBuf = await renderPdfFirstPageToPng(buffer);
          if (imgBuf) {
            addDebugLog('all_nulls_fallback_rendered', { imageBytes: imgBuf.length });
            const fallbackContent: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
              { type: 'text', text: VLM_PROMPT },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${imgBuf.toString('base64')}` } },
            ];
            const fallbackResponse = await geminiVisionCall([{ role: 'user', content: fallbackContent }]);
            addDebugLog('all_nulls_fallback_response', { responseLength: fallbackResponse.length, responsePreview: fallbackResponse.slice(0, 300) });

            // Extract JSON from the fallback response (reuse the same
            // cleaning strategy as the primary path).
            let cleanFallback = fallbackResponse;
            const fenceMatch2 = cleanFallback.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (fenceMatch2) {
              cleanFallback = fenceMatch2[1].trim();
            } else {
              const jsonStartMatch2 = cleanFallback.match(/\{\s*"vendor"\s*:/);
              if (jsonStartMatch2 && jsonStartMatch2.index !== undefined) {
                const lastBrace2 = cleanFallback.lastIndexOf('}');
                if (lastBrace2 > jsonStartMatch2.index) {
                  cleanFallback = cleanFallback.slice(jsonStartMatch2.index, lastBrace2 + 1);
                }
              } else {
                const firstBrace2 = cleanFallback.indexOf('{');
                const lastBrace2 = cleanFallback.lastIndexOf('}');
                if (firstBrace2 >= 0 && lastBrace2 > firstBrace2) {
                  cleanFallback = cleanFallback.slice(firstBrace2, lastBrace2 + 1);
                }
              }
            }
            cleanFallback = cleanFallback.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();

            try {
              const fallbackParsed = JSON.parse(cleanFallback) as Record<string, unknown>;
              // Only adopt the fallback if it produced at least one
              // real field — otherwise we'd be replacing one empty
              // parse with another.
              const fbVendor = fallbackParsed.vendor;
              const fbInvNum = fallbackParsed.invoiceNumber;
              const fbTotal = fallbackParsed.total;
              if (fbVendor != null || fbInvNum != null || fbTotal != null) {
                parsed = fallbackParsed;
                // Recompute confidence from the fallback payload.
                const fc = parsed.fieldConfidence as Record<string, number> | undefined;
                if (typeof parsed.confidence === 'number') {
                  overallConfidence = Math.min(1, Math.max(0, parsed.confidence as number));
                } else if (fc) {
                  const vals = Object.values(fc);
                  overallConfidence = vals.reduce((a, b) => a + b, 0) / vals.length;
                }
                addDebugLog('all_nulls_fallback_used', { vendor: parsed.vendor, total: parsed.total, confidence: overallConfidence });
              } else {
                addDebugLog('all_nulls_fallback_empty', {});
              }
            } catch (parseErr) {
              addDebugLog('all_nulls_fallback_parse_failed', { error: parseErr instanceof Error ? parseErr.message : String(parseErr) });
            }
          } else {
            addDebugLog('all_nulls_fallback_no_image', {});
          }
        } catch (fallbackErr) {
          addDebugLog('all_nulls_fallback_failed', { error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr) });
        }
      }
    }

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

    // ─── Stamp email provenance onto customFields ──────────────────────
    // We add this AFTER extracting customFieldValues so the source metadata
    // is preserved even if the user's template doesn't include a "source"
    // field. This way, /api/parse handles source tracking once at creation
    // time — no post-creation update needed in the approve route.
    if (emailSource) {
      customFieldValues.source = 'email';
      if (emailFromAddress) customFieldValues.emailFromAddress = emailFromAddress;
      if (emailFromName) customFieldValues.emailFromName = emailFromName;
      if (emailSubject) customFieldValues.emailSubject = emailSubject;
      if (emailDate) customFieldValues.emailDate = emailDate;
      if (pendingReviewId) customFieldValues.pendingReviewId = pendingReviewId;
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

    // ─── NULL byte sanitization ──────────────────────────────────────────
    // Vision models occasionally emit NUL (\u0000) bytes — typically when
    // OCR'ing scanned PDFs with embedded subset fonts. SQLite rejects NUL
    // bytes inside TEXT columns with "database disk image is malformed",
    // which would crash the entire parse. stripNullBytes walks the parsed
    // payload recursively and removes them from every string value.
    parsed = stripNullBytes(parsed) as Record<string, unknown>;
    const sanitizedVendor = (parsed.vendor as string) || null;
    const sanitizedInvNumber = (parsed.invoiceNumber as string) || null;
    const sanitizedInvDate = (parsed.invoiceDate as string) || null;
    const sanitizedDueDate = (parsed.dueDate as string) || null;
    const sanitizedCurrency = (parsed.currency as string) || 'USD';
    const sanitizedFileName = sanitizedName.replace(/\u0000/g, '');
    const sanitizedFieldConfidence = fieldConfidence ? stripNullBytes(fieldConfidence) : fieldConfidence;
    const sanitizedRawExtraction = stripNullBytes(parsed);
    const sanitizedLineItems = parsed.lineItems ? stripNullBytes(parsed.lineItems) : parsed.lineItems;
    const sanitizedValidationResults = stripNullBytes(fullValidationResults);
    const sanitizedCustomFieldValues = Object.keys(customFieldValues).length > 0 ? stripNullBytes(customFieldValues) as Record<string, unknown> : customFieldValues;
    const sanitizedNormalized = stripNullBytes(normalized) as { vendor?: string; invDate?: string; dueDate?: string; amount?: number | null; total?: number | null; currency?: string };
    const sanitizedFileMetadata = fileMetadata ? stripNullBytes(fileMetadata) : fileMetadata;

    addDebugLog('ai_response_parsed', {
      vendor: sanitizedVendor,
      invNumber: sanitizedInvNumber,
      invDate: sanitizedInvDate,
      total: parsed.total,
      confidence: overallConfidence,
    });

    // Save to database
    const invoice = await db.invoice.create({
      data: {
        userId: auth.userId,
        filename: sanitizedFileName,
        vendor: sanitizedVendor,
        invNumber: sanitizedInvNumber,
        invDate: sanitizedInvDate,
        dueDate: sanitizedDueDate,
        amount: typeof parsed.amount === 'number' ? parsed.amount : null,
        vatAmount: typeof parsed.vatAmount === 'number' ? parsed.vatAmount : null,
        total: typeof parsed.total === 'number' ? parsed.total : null,
        currency: sanitizedCurrency,
        status: validationStatus === 'fail' ? 'review' : validationStatus === 'warning' ? 'review' : overallConfidence >= 0.85 ? 'done' : 'review',
        confidence: overallConfidence,
        fieldConfidence: sanitizedFieldConfidence ? JSON.parse(JSON.stringify(sanitizedFieldConfidence)) : Prisma.JsonNull,
        rawExtraction: JSON.parse(JSON.stringify(sanitizedRawExtraction)),
        lineItems: Array.isArray(sanitizedLineItems) ? JSON.parse(JSON.stringify(sanitizedLineItems)) : Prisma.JsonNull,
        // New fields
        validationResults: JSON.parse(JSON.stringify(sanitizedValidationResults)),
        validationStatus,
        normalizedVendor: sanitizedNormalized.vendor || null,
        normalizedInvDate: sanitizedNormalized.invDate || null,
        normalizedDueDate: sanitizedNormalized.dueDate || null,
        normalizedAmount: sanitizedNormalized.amount,
        normalizedTotal: sanitizedNormalized.total,
        normalizedCurrency: sanitizedNormalized.currency,
        pdfMetadata: sanitizedFileMetadata ? JSON.parse(JSON.stringify(sanitizedFileMetadata)) : Prisma.JsonNull,
        processingTime: Math.round(processingTime * 100) / 100,
        customFields: Object.keys(sanitizedCustomFieldValues).length > 0 ? JSON.parse(JSON.stringify(sanitizedCustomFieldValues)) : Prisma.JsonNull,
        fileData: base64,
        fileType: file.type,
        // Auto-purge file data after 30 days to save DB storage
        // Extraction results are kept forever; only the binary file preview expires
        fileDataExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // ─── Increment the hard monthly parse counter ─────────────────────
    // This counter is NOT affected by invoice deletion — once you've
    // parsed 15 invoices this month, you can't parse more even if you
    // delete them all. Resets on the 1st of each month.
    await incrementMonthlyParseCount(auth.userId);

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
            details: { filename: sanitizedName, confidence: overallConfidence, flaggedAsDuplicate: true, duplicateCount: duplicates.length },
          },
        });
        duplicateCheckResult = { isDuplicate: true, duplicateCount: duplicates.length };
      } else {
        duplicateCheckResult = { isDuplicate: false, duplicateCount: 0 };
      }
    }

    // ---- Approval Workflow ----
    // Rules are evaluated with PRIORITY: block > flag_for_review > auto_approve.
    // This prevents a "flag above $10,000" rule from shadowing a "block above
    // $100,000" rule when an invoice is $200,000 (both match, but block wins).
    let approvalCheckResult: { approvalStatus: string; matchedRuleId: string | null } | null = null;
    if (hasFeature(user.plan, 'approval_workflows')) {
      const rules = await db.approvalRule.findMany({
        where: { userId: auth.userId, active: true },
        orderBy: { createdAt: 'desc' },
      });
      const total = invoice.total ?? 0;

      const matching = rules.filter((rule) => {
        const min = rule.minAmount ?? -Infinity;
        const max = rule.maxAmount ?? Infinity;
        return total >= min && total <= max;
      });

      let approvalStatus = 'none';
      let matchedRuleId: string | null = null;
      const blockRule = matching.find((r) => r.action === 'block');
      const flagRule = matching.find((r) => r.action === 'flag_for_review');
      const autoRule = matching.find((r) => r.action === 'auto_approve');
      if (blockRule) {
        approvalStatus = 'blocked';
        matchedRuleId = blockRule.id;
      } else if (flagRule) {
        approvalStatus = 'pending_review';
        matchedRuleId = flagRule.id;
      } else if (autoRule) {
        approvalStatus = 'auto_approved';
        matchedRuleId = autoRule.id;
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
          details: { filename: sanitizedName, confidence: overallConfidence },
        },
      });
    }

    // ─── Persist debug logs (success path) ──────────────────────────────
    // We save the trace only AFTER all the post-parse side effects
    // (duplicate check, approval rules, audit log) have completed, so a
    // late failure doesn't double-write. _debugLogSaved gates the finally
    // block from adding a duplicate "early return" entry.
    if (debugEnabled && debugAuthUserId && debugLogs.length > 0) {
      try {
        await db.parseDebugLog.create({
          data: {
            userId: debugAuthUserId,
            filename: debugFileName ?? undefined,
            fileType: debugFileType ?? undefined,
            logs: JSON.parse(JSON.stringify(debugLogs)),
            success: true,
          },
        });
        _debugLogSaved = true;
      } catch (logErr) {
        console.warn('[parse-debug] Failed to save success debug log:', logErr instanceof Error ? logErr.message : String(logErr));
      }
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
    console.error('[parse] Error:', message);
    addDebugLog('parse_failed', { error: message });

    // ─── Graceful degradation: save as pending_retry ────────────────────
    // Instead of returning a hard 500 to the user (which forces them to
    // re-upload the file later when the AI service is back), persist the
    // raw file as a pending_retry invoice. A background reaper will pick
    // these up and re-run the parse once the providers recover.
    //
    // We do this BEFORE saving debug logs so the pending_retry_saved
    // entry is included in the persisted trace.
    let pendingRetryResponse: NextResponse | null = null;
    if (debugAuthUserId && debugFileName && debugFileType) {
      try {
        const pendingInvoice = await db.invoice.create({
          data: {
            userId: debugAuthUserId,
            filename: debugFileName,
            status: 'pending_retry',
            confidence: 0,
            currency: 'USD',
            fileData: buffer?.toString('base64') || null,
            fileType: debugFileType,
            fileDataExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            errorMessage: message.slice(0, 500),
          },
        });
        addDebugLog('pending_retry_saved', { invoiceId: pendingInvoice.id });
        pendingRetryResponse = NextResponse.json({
          id: pendingInvoice.id,
          filename: pendingInvoice.filename,
          status: 'pending_retry',
          message: 'Your document has been saved. We\'ll process it automatically when service is restored.',
        });
      } catch (saveErr) {
        addDebugLog('pending_retry_save_failed', { error: saveErr instanceof Error ? saveErr.message : String(saveErr) });
        console.error('[parse] Failed to save pending_retry invoice:', saveErr instanceof Error ? saveErr.message : String(saveErr));
      }
    }

    // ─── Persist debug logs (failure path) ──────────────────────────────
    if (debugEnabled && debugAuthUserId && debugLogs.length > 0 && !_debugLogSaved) {
      try {
        await db.parseDebugLog.create({
          data: {
            userId: debugAuthUserId,
            filename: debugFileName ?? undefined,
            fileType: debugFileType ?? undefined,
            logs: JSON.parse(JSON.stringify(debugLogs)),
            success: false,
            error: message.slice(0, 500),
          },
        });
        _debugLogSaved = true;
      } catch (logErr) {
        console.warn('[parse-debug] Failed to save failure debug log:', logErr instanceof Error ? logErr.message : String(logErr));
      }
    }

    if (pendingRetryResponse) return pendingRetryResponse;
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // ─── Safety net for early returns ────────────────────────────────────
    // If we bailed out before the success/catch blocks had a chance to
    // persist the trace (e.g. a 4xx return from inside the try block,
    // or a thrown error inside the catch's pending_retry branch), make
    // one last attempt to save whatever debug logs we collected.
    if (debugEnabled && debugAuthUserId && debugLogs.length > 0 && !_debugLogSaved) {
      try {
        await db.parseDebugLog.create({
          data: {
            userId: debugAuthUserId,
            filename: debugFileName ?? undefined,
            fileType: debugFileType ?? undefined,
            logs: JSON.parse(JSON.stringify(debugLogs)),
            success: false,
            error: 'Early return (no AI processing reached)',
          },
        });
      } catch {}
    }
  }
}
