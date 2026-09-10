// ============================================================================
// OmniParse AI - Invoice Validation, Normalization & Analysis Engine
// Pure logic + exifr for EXIF extraction
// ============================================================================

// ---- Types ----

export interface ValidationRuleResult {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
}

export interface ValidationResults {
  status: 'pass' | 'warning' | 'fail';
  rules: ValidationRuleResult[];
  checkedAt: string;
}

export interface NormalizedData {
  vendor: string;
  invDate: string;
  dueDate: string;
  amount: number | null;
  total: number | null;
  currency: string;
}

export interface VarianceCheck {
  field: string;
  expected: number;
  actual: number;
  variance: number;
  variancePercent: number;
  threshold: number;
  status: 'pass' | 'warn' | 'reject';
}

export interface InvoiceAging {
  daysSinceCreation: number;
  daysUntilDue: number;
  daysOverdue: number;
  agingBucket: 'current' | '1-15' | '16-30' | '31-60' | '61-90' | '90+';
  status: 'current' | 'upcoming' | 'overdue';
}

export interface ProcessingMetrics {
  avgAccuracy: number;
  avgProcessingTime: number;
  costPerInvoice: number;
  totalProcessed: number;
  totalAmount: number;
  avgInvoiceAmount: number;
}

export interface BatchAnalysisResult {
  duplicates: Array<{ ids: string[]; vendor: string; amount: number; reason: string }>;
  outliers: Array<{ id: string; vendor: string; amount: number; reason: string }>;
  fieldDifferences: Record<string, { unique: number; mostCommon: string }>;
  summary: { count: number; avgAmount: number; totalAmount: number; vendors: string[] };
}

export interface PatternAnomaly {
  invoiceId: string;
  vendor: string;
  anomaly: string;
  severity: 'warning' | 'critical';
  detail: string;
}

export interface TamperingCheck {
  isSuspicious: boolean;
  checks: Array<{
    check: string;
    status: 'pass' | 'warn' | 'fail';
    detail: string;
    icon?: 'metadata' | 'editing' | 'ai' | 'date' | 'structure' | 'visual';
  }>;
}

export interface ImageMetadata {
  fileType: string;
  width?: number;
  height?: number;
  software?: string;
  creatorTool?: string;
  processingSoft?: string;
  cameraMake?: string;
  cameraModel?: string;
  dateTimeOriginal?: string;
  dateTimeDigitized?: string;
  dateTimeModified?: string;
  xmpCreatorTool?: string;
  xmpProducer?: string;
  dngVersion?: unknown;
  hasExif: boolean;
  hasXmp: boolean;
  hasIptc: boolean;
  exifData: Record<string, unknown>;
}

export interface UserSettings {
  validationRules: Record<string, boolean>; // which rules are enabled
  varianceThresholds: Record<string, { type: 'percent' | 'absolute'; value: number }>;
  customFields: Array<{ name: string; instruction: string; enabled: boolean }>;
  retentionDays?: number | null; // Plus+ feature: data retention period in days (null = forever)
}

export const DEFAULT_SETTINGS: UserSettings = {
  validationRules: {
    date_order: true,
    line_total_match: true,
    future_date: true,
    negative_amount: true,
    blank_vendor: true,
    amount_format: true,
    due_date_reasonable: true,
    vat_reasonable: true,
  },
  varianceThresholds: {
    line_item: { type: 'percent', value: 5 },
    total: { type: 'absolute', value: 100 },
    unit_price: { type: 'percent', value: 50 },
  },
  customFields: [],
};

// ---- 1. INVOICE VALIDATION RULES ENGINE ----

export function runValidationRules(
  data: {
    vendor?: string | null;
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
    dueDate?: string | null;
    amount?: number | null;
    vatAmount?: number | null;
    total?: number | null;
    lineItems?: Array<{ description?: string; quantity?: number; unitPrice?: number }>| null;
  },
  enabledRules?: Record<string, boolean>
): ValidationResults {
  const rules = enabledRules || DEFAULT_SETTINGS.validationRules;
  const results: ValidationRuleResult[] = [];

  // Rule: invoice_date < due_date
  if (rules.date_order && data.invoiceDate && data.dueDate) {
    const invDate = parseDate(data.invoiceDate);
    const dueDate = parseDate(data.dueDate);
    if (invDate && dueDate && invDate > dueDate) {
      results.push({
        rule: 'date_order',
        severity: 'error',
        message: 'Invoice date is after the due date — this is likely an extraction error.',
        field: 'dueDate',
      });
    }
  }

  // Rule: Validate unit_price × quantity = line_total (for line items)
  if (rules.line_total_match && Array.isArray(data.lineItems) && data.lineItems.length > 0) {
    for (let i = 0; i < data.lineItems.length; i++) {
      const item = data.lineItems[i];
      if (typeof item.quantity === 'number' && typeof item.unitPrice === 'number') {
        const expected = Math.round(item.quantity * item.unitPrice * 100) / 100;
        // We don't have line_total stored separately, but we can check against amount/total
        const desc = item.description || `Line item ${i + 1}`;
        if (expected <= 0 && item.quantity > 0) {
          results.push({
            rule: 'line_total_match',
            severity: 'warning',
            message: `"${desc}": unit price × quantity = $${expected} (unexpected zero/negative).`,
            field: 'lineItems',
          });
        }
      }
    }
    // Check if sum of line items approximately matches amount
    if (typeof data.amount === 'number' && data.lineItems.length > 0) {
      const lineSum = data.lineItems.reduce((sum, item) => {
        const qty = typeof item.quantity === 'number' ? item.quantity : 0;
        const price = typeof item.unitPrice === 'number' ? item.unitPrice : 0;
        return sum + (qty * price);
      }, 0);
      const diff = Math.abs(lineSum - data.amount);
      if (diff > 0.01 && Math.abs(data.amount) > 0) {
        const diffPct = (diff / Math.abs(data.amount)) * 100;
        if (diffPct > 5) {
          results.push({
            rule: 'line_total_match',
            severity: 'warning',
            message: `Line items sum ($${lineSum.toFixed(2)}) differs from amount ($${data.amount.toFixed(2)}) by ${diffPct.toFixed(1)}%.`,
            field: 'amount',
          });
        }
      }
    }
  }

  // Rule: Flag if invoice date is in the future
  if (rules.future_date && data.invoiceDate) {
    const invDate = parseDate(data.invoiceDate);
    if (invDate && invDate > new Date()) {
      results.push({
        rule: 'future_date',
        severity: 'warning',
        message: 'Invoice date is in the future — please verify.',
        field: 'invoiceDate',
      });
    }
  }

  // Rule: Check for negative amounts
  if (rules.negative_amount) {
    if (typeof data.amount === 'number' && data.amount < 0) {
      results.push({
        rule: 'negative_amount',
        severity: 'error',
        message: 'Net amount is negative — this may be a credit note or extraction error.',
        field: 'amount',
      });
    }
    if (typeof data.total === 'number' && data.total < 0) {
      results.push({
        rule: 'negative_amount',
        severity: 'error',
        message: 'Total amount is negative — this may be a credit note or extraction error.',
        field: 'total',
      });
    }
  }

  // Rule: Ensure vendor name isn't blank
  if (rules.blank_vendor && (!data.vendor || data.vendor.trim().length === 0)) {
    results.push({
      rule: 'blank_vendor',
      severity: 'warning',
      message: 'Vendor name is missing or blank — this invoice needs manual review.',
      field: 'vendor',
    });
  }

  // Rule: Validate amount format (no letters)
  if (rules.amount_format) {
    if (data.amount !== null && data.amount !== undefined && typeof data.amount !== 'number') {
      results.push({
        rule: 'amount_format',
        severity: 'error',
        message: 'Amount is not a valid number.',
        field: 'amount',
      });
    }
    if (data.total !== null && data.total !== undefined && typeof data.total !== 'number') {
      results.push({
        rule: 'amount_format',
        severity: 'error',
        message: 'Total is not a valid number.',
        field: 'total',
      });
    }
  }

  // Rule: Due date should be reasonable (within 1 year of invoice date)
  if (rules.due_date_reasonable && data.invoiceDate && data.dueDate) {
    const invDate = parseDate(data.invoiceDate);
    const dueDate = parseDate(data.dueDate);
    if (invDate && dueDate) {
      const diffDays = (dueDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 365) {
        results.push({
          rule: 'due_date_reasonable',
          severity: 'warning',
          message: `Due date is ${Math.round(diffDays)} days after invoice date — unusually long payment term.`,
          field: 'dueDate',
        });
      }
      if (diffDays < 0) {
        results.push({
          rule: 'due_date_reasonable',
          severity: 'error',
          message: 'Due date is before invoice date.',
          field: 'dueDate',
        });
      }
    }
  }

  // Rule: VAT should be reasonable (0-30% of amount)
  if (rules.vat_reasonable && typeof data.amount === 'number' && typeof data.vatAmount === 'number' && data.amount > 0) {
    const vatRate = (data.vatAmount / data.amount) * 100;
    if (vatRate > 30) {
      results.push({
        rule: 'vat_reasonable',
        severity: 'warning',
        message: `VAT rate is ${vatRate.toFixed(1)}% — higher than typical rates (0-25%).`,
        field: 'vatAmount',
      });
    }
    if (vatRate < 0) {
      results.push({
        rule: 'vat_reasonable',
        severity: 'error',
        message: 'VAT amount is negative.',
        field: 'vatAmount',
      });
    }
  }

  // Determine overall status
  const hasErrors = results.some((r) => r.severity === 'error');
  const hasWarnings = results.some((r) => r.severity === 'warning');

  return {
    status: hasErrors ? 'fail' : hasWarnings ? 'warning' : 'pass',
    rules: results,
    checkedAt: new Date().toISOString(),
  };
}

// ---- 2. VARIANCE TOLERANCE CHECKING ----

export function runVarianceChecks(
  extracted: { amount?: number | null; total?: number | null; vatAmount?: number | null; lineItems?: Array<{ quantity?: number; unitPrice?: number; unitTotal?: number }> | null },
 thresholds?: Record<string, { type: 'percent' | 'absolute'; value: number }>
): VarianceCheck[] {
  const th = thresholds || DEFAULT_SETTINGS.varianceThresholds;
  const results: VarianceCheck[] = [];

  // Check line items: unit price reasonableness
  if (extracted.lineItems && th.unit_price) {
    const prices = extracted.lineItems
      .map((li) => li.unitPrice)
      .filter((p): p is number => typeof p === 'number' && p > 0);
    if (prices.length >= 2) {
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const maxPrice = Math.max(...prices);
      if (avg > 0) {
        const variancePct = ((maxPrice - avg) / avg) * 100;
        if (variancePct > th.unit_price.value) {
          results.push({
            field: 'unit_price',
            expected: avg,
            actual: maxPrice,
            variance: maxPrice - avg,
            variancePercent: variancePct,
            threshold: th.unit_price.value,
            status: 'warn',
          });
        }
      }
    }
  }

  // Check total vs amount + VAT
  if (typeof extracted.amount === 'number' && typeof extracted.vatAmount === 'number' && typeof extracted.total === 'number') {
    const expected = extracted.amount + extracted.vatAmount;
    const diff = Math.abs(extracted.total - expected);
    const thTotal = th.total;
    if (thTotal) {
      if (thTotal.type === 'absolute' && diff > thTotal.value) {
        results.push({
          field: 'total',
          expected: Math.round(expected * 100) / 100,
          actual: extracted.total,
          variance: Math.round(diff * 100) / 100,
          variancePercent: expected > 0 ? (diff / expected) * 100 : 0,
          threshold: thTotal.value,
          status: diff > thTotal.value * 2 ? 'reject' : 'warn',
        });
      } else if (thTotal.type === 'percent' && expected > 0) {
        const variancePct = (diff / expected) * 100;
        if (variancePct > thTotal.value) {
          results.push({
            field: 'total',
            expected: Math.round(expected * 100) / 100,
            actual: extracted.total,
            variance: Math.round(diff * 100) / 100,
            variancePercent: variancePct,
            threshold: thTotal.value,
            status: variancePct > thTotal.value * 2 ? 'reject' : 'warn',
          });
        }
      }
    }
  }

  // Check line item variance
  if (extracted.lineItems && th.line_item) {
    const totals = extracted.lineItems
      .map((li) => {
        if (typeof li.quantity === 'number' && typeof li.unitPrice === 'number') {
          return li.quantity * li.unitPrice;
        }
        return li.unitTotal ?? null;
      })
      .filter((t): t is number => t !== null && t > 0);
    if (totals.length >= 2) {
      const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
      for (const t of totals) {
        const diff = Math.abs(t - avg);
        const variancePct = avg > 0 ? (diff / avg) * 100 : 0;
        if (variancePct > th.line_item.value) {
          results.push({
            field: 'line_item',
            expected: Math.round(avg * 100) / 100,
            actual: Math.round(t * 100) / 100,
            variance: Math.round(diff * 100) / 100,
            variancePercent: Math.round(variancePct * 10) / 10,
            threshold: th.line_item.value,
            status: 'warn',
          });
          break; // One warning per field type is enough
        }
      }
    }
  }

  return results;
}

// ---- 3. AUTOMATIC DATA NORMALIZATION ----

export function normalizeInvoiceData(data: {
  vendor?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  amount?: number | null;
  total?: number | null;
  currency?: string | null;
}): NormalizedData {
  return {
    vendor: normalizeVendor(data.vendor),
    invDate: normalizeDate(data.invoiceDate),
    dueDate: normalizeDate(data.dueDate),
    amount: data.amount !== null && data.amount !== undefined ? Math.round(data.amount * 100) / 100 : null,
    total: data.total !== null && data.total !== undefined ? Math.round(data.total * 100) / 100 : null,
    currency: normalizeCurrency(data.currency),
  };
}

function normalizeVendor(vendor?: string | null): string {
  if (!vendor) return '';
  // Trim whitespace, fix multiple spaces, title case
  return vendor
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b([a-z])([a-z]+)\b/gi, (_, first, rest) => first.toUpperCase() + rest.toLowerCase())
    .replace(/[^\w\s&.,'-]/g, '') // Remove weird characters
    .trim();
}

function normalizeDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  if (!d) return dateStr; // Return original if can't parse
  // Always output ISO format YYYY-MM-DD
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const CURRENCY_MAP: Record<string, string> = {
  'usd': 'USD', 'eur': 'EUR', 'gbp': 'GBP', 'czk': 'CZK',
  'us$': 'USD', '€': 'EUR', '£': 'GBP', 'kč': 'CZK',
  'dollars': 'USD', 'euros': 'EUR', 'pounds': 'GBP',
};

function normalizeCurrency(currency?: string | null): string {
  if (!currency) return 'USD';
  const cleaned = currency.trim().toLowerCase();
  return CURRENCY_MAP[cleaned] || currency.trim().toUpperCase().slice(0, 3) || 'USD';
}

// ---- 4. INVOICE AGING / SLA TRACKING ----

export function calculateAging(invoice: {
  invDate?: string | null;
  dueDate?: string | null;
  createdAt: string;
}): InvoiceAging {
  const now = new Date();
  const createdDate = new Date(invoice.createdAt);
  const daysSinceCreation = Math.max(0, Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));

  const dueDate = invoice.dueDate ? parseDate(invoice.dueDate) : null;
  let daysUntilDue = Infinity;
  let daysOverdue = 0;
  let agingBucket: InvoiceAging['agingBucket'] = 'current';
  let status: InvoiceAging['status'] = 'current';

  if (dueDate) {
    daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      daysOverdue = Math.abs(daysUntilDue);
      if (daysOverdue <= 15) agingBucket = '1-15';
      else if (daysOverdue <= 30) agingBucket = '16-30';
      else if (daysOverdue <= 60) agingBucket = '31-60';
      else if (daysOverdue <= 90) agingBucket = '61-90';
      else agingBucket = '90+';
      status = 'overdue';
    } else if (daysUntilDue <= 7) {
      agingBucket = 'current';
      status = 'upcoming';
    } else {
      agingBucket = 'current';
      status = 'current';
    }
  }

  return { daysSinceCreation, daysUntilDue, daysOverdue, agingBucket, status };
}

// ---- 5. COST PER INVOICE METRICS ----

export function calculateMetrics(invoices: Array<{
  confidence?: number | null;
  processingTime?: number | null;
  total?: number | null;
  createdAt: string;
  validationStatus?: string | null;
}>): ProcessingMetrics {
  if (invoices.length === 0) {
    return { avgAccuracy: 0, avgProcessingTime: 0, costPerInvoice: 0, totalProcessed: 0, totalAmount: 0, avgInvoiceAmount: 0 };
  }

  const withConf = invoices.filter((i) => i.confidence !== null && i.confidence !== undefined);
  const avgAccuracy = withConf.length > 0
    ? withConf.reduce((s, i) => s + (i.confidence!), 0) / withConf.length
    : 0;

  const withTime = invoices.filter((i) => i.processingTime !== null && i.processingTime !== undefined);
  const avgProcessingTime = withTime.length > 0
    ? withTime.reduce((s, i) => s + i.processingTime!, 0) / withTime.length
    : 0;

  // Cost per invoice: based on AI API cost estimation
  // ~$0.002 per image inference + $0.001 per 1K tokens output
  const estimatedCostPerInvoice = 0.003; // ~$0.003 base
  const avgCost = estimatedCostPerInvoice + (avgProcessingTime > 10 ? 0.001 : 0);

  const totalAmount = invoices.reduce((s, i) => s + (i.total ?? 0), 0);
  const withTotal = invoices.filter((i) => i.total !== null && i.total !== undefined && i.total! > 0);
  const avgInvoiceAmount = withTotal.length > 0
    ? withTotal.reduce((s, i) => s + i.total!, 0) / withTotal.length
    : 0;

  return {
    avgAccuracy,
    avgProcessingTime,
    costPerInvoice: avgCost,
    totalProcessed: invoices.length,
    totalAmount,
    avgInvoiceAmount,
  };
}

// ---- 6. CUSTOM FIELD EXTRACTION PROMPT BUILDER ----

export function buildCustomFieldPrompt(customFields: Array<{ name: string; instruction: string }>): string {
  if (!customFields || customFields.length === 0) return '';
  const fields = customFields
    .filter((f) => f.name && f.instruction)
    .map((f) => `  "${f.name}": "extracted value or null" — ${f.instruction}`)
    .join('\n');
  return `\n
Additionally, extract these custom fields defined by the user:\n${fields}\nInclude them in the JSON output alongside the standard fields.`;
}

// ---- 7. INVOICE COMPARISON / BATCH ANALYSIS ----

export function analyzeBatch(invoices: Array<{
  id: string;
  vendor?: string | null;
  total?: number | null;
  invNumber?: string | null;
  amount?: number | null;
}>): BatchAnalysisResult {
  const duplicates: BatchAnalysisResult['duplicates'] = [];
  const outliers: BatchAnalysisResult['outliers'] = [];
  const vendors = new Set<string>();
  let totalAmount = 0;

  const withTotal = invoices.filter((i) => typeof i.total === 'number' && i.total > 0);
  const avgAmount = withTotal.length > 0
    ? withTotal.reduce((s, i) => s + i.total!, 0) / withTotal.length
    : 0;

  // Find potential duplicates (same vendor + same/similar total)
  const byVendor: Record<string, typeof invoices> = {};
  for (const inv of invoices) {
    const v = (inv.vendor || 'Unknown').toLowerCase();
    if (!byVendor[v]) byVendor[v] = [];
    byVendor[v].push(inv);
  }

  for (const [vendor, invs] of Object.entries(byVendor)) {
    vendors.add(invs[0].vendor || 'Unknown');
    if (invs.length > 1) {
      for (let i = 0; i < invs.length; i++) {
        for (let j = i + 1; j < invs.length; j++) {
          const a = invs[i];
          const b = invs[j];
          if (typeof a.total === 'number' && typeof b.total === 'number') {
            if (Math.abs(a.total - b.total) < 0.01) {
              duplicates.push({
                ids: [a.id, b.id],
                vendor: vendor.charAt(0).toUpperCase() + vendor.slice(1),
                amount: a.total,
                reason: 'Identical amount from same vendor',
              });
            } else if (a.invNumber && b.invNumber && a.invNumber === b.invNumber) {
              duplicates.push({
                ids: [a.id, b.id],
                vendor: vendor.charAt(0).toUpperCase() + vendor.slice(1),
                amount: a.total,
                reason: 'Same invoice number',
              });
            }
          }
        }
      }
    }
  }

  // Find outliers (>3x average)
  for (const inv of withTotal) {
    if (avgAmount > 0 && inv.total! > avgAmount * 3) {
      outliers.push({
        id: inv.id,
        vendor: inv.vendor || 'Unknown',
        amount: inv.total!,
        reason: `Amount is ${(inv.total! / avgAmount).toFixed(1)}x the average ($${avgAmount.toFixed(2)})`,
      });
    }
  }

  // Field differences
  const fieldDiffs: BatchAnalysisResult['fieldDifferences'] = {};
  for (const field of ['vendor', 'currency'] as const) {
    const values: Record<string, number> = {};
    for (const inv of invoices) {
      const v = String(inv[field] ?? 'N/A');
      values[v] = (values[v] || 0) + 1;
    }
    const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
    if (entries.length > 0) {
      fieldDiffs[field] = { unique: entries.length, mostCommon: entries[0][0] };
    }
  }

  for (const inv of invoices) {
    if (typeof inv.total === 'number') totalAmount += inv.total;
  }

  return {
    duplicates,
    outliers,
    fieldDifferences: fieldDiffs,
    summary: {
      count: invoices.length,
      avgAmount: Math.round(avgAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      vendors: Array.from(vendors),
    },
  };
}

// ---- 8. METADATA TAMPERING DETECTION ----

// Known image editing software signatures (EXIF Software, ProcessingSoft, CreatorTool fields)
const EDITING_SOFTWARE = [
  'photoshop', 'adobe photoshop', 'adobe lightroom', 'adobe illustrator', 'adobe indesign',
  'gimp', 'gimp 2', 'gnu image manipulation',
  'affinity photo', 'affinity designer', 'paint.net', 'paint.net v',
  'coreldraw', 'corel photo-paint', 'corel paintshop',
  'canva', 'figma', 'sketch',
  'pixelmator', 'acorn', 'preview', // macOS Preview
  'ms paint', 'microsoft paint', 'windows paint', 'paint 3d',
  'snapseed', 'vscocam', 'lightroom',
  'picasa', 'irfanview', 'xnview', 'imagemagick',
  'capture one', 'darktable', 'rawtherapee',
  'online-image-editor', 'photopea', 'pixlr',
];

// Known AI image generation / editing tool signatures
const AI_TOOL_SIGNATURES: Array<{ patterns: string[]; label: string }> = [
  {
    label: 'Stable Diffusion',
    patterns: ['stable diffusion', 'stability ai', 'automatic1111', 'comfyui', 'a1111',
      'compel', 'invoke ai', 'fooocus'],
  },
  {
    label: 'DALL-E / ChatGPT / GPT-4o',
    patterns: ['dall-e', 'dall·e', 'dall e', 'openai', 'gpt-image', 'chatgpt',
      'gpt-4o', 'gpt4o', 'gpt-4', 'sora', 'openai image', 'mygpt'],
  },
  {
    label: 'Midjourney',
    patterns: ['midjourney', 'mj_', 'midjourn'],
  },
  {
    label: 'Google Gemini / Imagen',
    patterns: ['gemini', 'imagen', 'google deepmind', 'deepmind', 'google ai',
      'bard', 'google bard', 'vertex ai', 'google imagen'],
  },
  {
    label: 'Claude / Anthropic',
    patterns: ['claude', 'anthropic', 'anthropic ai', 'claude-3', 'claude-3.5',
      'claude-3.7', 'claude-4', 'claude sonnet', 'claude opus', 'claude haiku'],
  },
  {
    label: 'Adobe Firefly',
    patterns: ['firefly', 'adobe firefly', 'generative fill', 'generative recolor'],
  },
  {
    label: 'Microsoft Copilot / Designer',
    patterns: ['microsoft copilot', 'copilot', 'bing image creator', 'ms designer',
      'microsoft designer', 'bing chat', 'bimg'],
  },
  {
    label: 'Leonardo AI',
    patterns: ['leonardo ai', 'leonardo.ai'],
  },
  {
    label: 'Ideogram',
    patterns: ['ideogram', 'ideogram ai'],
  },
  {
    label: 'Playground AI',
    patterns: ['playground ai', 'playground.com'],
  },
  {
    label: 'Craiyon / DALL-E Mini',
    patterns: ['craiyon', 'dall-e mini'],
  },
  {
    label: 'Flux / Black Forest Labs',
    patterns: ['flux', 'black forest labs', 'bfl'],
  },
  {
    label: 'TensorFlow / PyTorch',
    patterns: ['tensorflow', 'pytorch', 'torch'],
  },
  {
    label: 'AI Upscaling',
    patterns: ['real-esrgan', 'esrgan', 'waifu2x', 'topaz', 'topaz gigapixel',
      'topaz photo ai', 'enhance.ai', 'letsenhance', 'remini', 'upscayl'],
  },
  {
    label: 'AI Background Removal',
    patterns: ['remove.bg', 'removebg', 'slazzer', 'erase.bg', 'photoroom'],
  },
  {
    label: 'General AI Tool',
    patterns: ['ai generated', 'ai-enhanced', 'ai upscaled', 'ai edited',
      'generated by ai', 'created with ai', 'ai image',
      'inpainting', 'outpainting', 'image-to-image',
      'ai-art', 'ai art', 'dreamstudio', 'nightcafe', 'artbreeder'],
  },
];

// AI-generated images often have telltale dimension signatures
const SUSPICIOUS_DIMENSIONS = [
  // Common Stable Diffusion defaults
  [512, 512], [512, 768], [768, 512], [512, 640], [640, 512],
  // Midjourney defaults
  [1024, 1024], [1024, 1536], [1536, 1024],
  // DALL-E defaults
  [1024, 1792], [1792, 1024],
  // Common AI upscaling targets
  [2048, 2048], [1024, 1024],
];

/**
 * Extract EXIF/XMP/IPTC metadata from image buffers (JPEG, PNG, WebP)
 * Returns structured metadata or null if extraction fails
 */
export async function extractImageMetadata(
  buffer: Buffer,
  mimeType: string
): Promise<ImageMetadata | null> {
  try {
    // exifr needs a Buffer or Uint8Array
    const uint8 = new Uint8Array(buffer);

    // Parse all available metadata segments
    const exifData = await (await import('exifr')).parse(uint8, {
      tiff: true,
      xmp: true,
      icc: false,
      iptc: true,
      jfif: true,
      ihdr: true,
      exif: true,
      gps: false,
      interop: false,
      translateValues: true,
      translateKeys: true,
      reviveValues: true,
    }).catch(() => null);

    // Also get just the basic image structure
    const basicInfo = await (await import('exifr')).parse(uint8, {
      tiff: false, xmp: false, icc: false, iptc: false,
      jfif: false, ihdr: true, exif: false, gps: false,
    }).catch(() => null);

    if (!exifData && !basicInfo) {
      return {
        fileType: mimeType,
        hasExif: false,
        hasXmp: false,
        hasIptc: false,
        exifData: {},
      };
    }

    const all = { ...basicInfo, ...exifData };

    return {
      fileType: mimeType,
      width: all.ImageWidth || all.Width || all.imageWidth || undefined,
      height: all.ImageHeight || all.Height || all.imageHeight || undefined,
      software: all.Software || undefined,
      creatorTool: all.CreatorTool || undefined,
      processingSoft: all.ProcessingSoft || undefined,
      cameraMake: all.Make || undefined,
      cameraModel: all.Model || undefined,
      dateTimeOriginal: all.DateTimeOriginal || all.CreateDate || undefined,
      dateTimeDigitized: all.DateTimeDigitized || undefined,
      dateTimeModified: all.ModifyDate || all.DateTime || undefined,
      xmpCreatorTool: all.creatorTool || undefined,
      xmpProducer: all.producer || undefined,
      dngVersion: all.DNGVersion || undefined,
      hasExif: !!(all.ExifIFDPointer || all.Make || all.Model || all.DateTimeOriginal),
      hasXmp: !!(all.creatorTool || all.producer || all.xmpMM !== undefined),
      hasIptc: !!(all.ObjectName || all.Caption || all.Keywords),
      exifData: all as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

/**
 * Detect AI generation / editing patterns in image metadata
 * Checks for AI tool signatures, suspicious dimension patterns,
 * stripped metadata, and other red flags
 */
export function detectAiTamperingPatterns(meta: ImageMetadata): TamperingCheck {
  const checks: TamperingCheck['checks'] = [];

  // ── Check 1: Known AI tool signatures in all text fields ──
  const allTextFields = [
    meta.software, meta.creatorTool, meta.processingSoft,
    meta.xmpCreatorTool, meta.xmpProducer,
  ].filter(Boolean).map(String);

  const allTextLower = allTextFields.join(' ').toLowerCase();

  let aiToolDetected: string | null = null;
  for (const aiTool of AI_TOOL_SIGNATURES) {
    for (const pattern of aiTool.patterns) {
      if (allTextLower.includes(pattern.toLowerCase())) {
        aiToolDetected = aiTool.label;
        break;
      }
    }
    if (aiToolDetected) break;
  }

  if (aiToolDetected) {
    checks.push({
      check: 'ai_tool_detected',
      status: 'fail',
      detail: `AI tool signature found: ${aiToolDetected}. Source: ${allTextFields.filter(t => {
        const lower = t.toLowerCase();
        return AI_TOOL_SIGNATURES.some(at => at.patterns.some(p => lower.includes(p.toLowerCase())));
      }).join(', ') || 'metadata field'}.`,
      icon: 'ai',
    });
  } else {
    checks.push({
      check: 'ai_tool_detected',
      status: 'pass',
      detail: 'No known AI generation tool signatures found in metadata.',
      icon: 'ai',
    });
  }

  // ── Check 2: Image editing software ──
  let editingToolDetected: string | null = null;
  for (const tool of EDITING_SOFTWARE) {
    if (allTextLower.includes(tool)) {
      editingToolDetected = tool;
      break;
    }
  }

  if (editingToolDetected) {
    // Capitalize first letter for display
    const displayName = editingToolDetected.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    checks.push({
      check: 'editing_software',
      status: 'warn',
      detail: `Image editing software detected: ${displayName}. The document may have been modified.`,
      icon: 'editing',
    });
  } else {
    checks.push({
      check: 'editing_software',
      status: 'pass',
      detail: 'No known image editing software signatures in metadata.',
      icon: 'editing',
    });
  }

  // ── Check 3: Stripped metadata (suspicious for JPEG) ──
  if (meta.fileType === 'image/jpeg') {
    if (!meta.hasExif && !meta.hasXmp) {
      checks.push({
        check: 'stripped_metadata',
        status: 'warn',
        detail: 'JPEG has no EXIF or XMP metadata. This is common for screenshots, AI-generated images, or intentionally stripped metadata.',
        icon: 'metadata',
      });
    } else {
      checks.push({
        check: 'stripped_metadata',
        status: 'pass',
        detail: `JPEG contains ${[meta.hasExif && 'EXIF', meta.hasXmp && 'XMP'].filter(Boolean).join(' + ')} metadata.`,
        icon: 'metadata',
      });
    }
  } else if (meta.fileType === 'image/png') {
    // PNGs normally have minimal metadata; missing XMP is not suspicious
    if (meta.hasXmp) {
      checks.push({
        check: 'stripped_metadata',
        status: 'pass',
        detail: 'PNG contains XMP metadata.',
        icon: 'metadata',
      });
    } else {
      checks.push({
        check: 'stripped_metadata',
        status: 'pass',
        detail: 'PNG has standard metadata (no XMP — normal for PNG).',
        icon: 'metadata',
      });
    }
  } else {
    checks.push({
      check: 'stripped_metadata',
      status: 'pass',
      detail: 'Metadata extracted successfully.',
      icon: 'metadata',
      });
    }

  // ── Check 4: Suspicious dimensions (common AI output sizes) ──
  if (meta.width && meta.height) {
    const isSuspicious = SUSPICIOUS_DIMENSIONS.some(
      ([w, h]) => (meta.width === w && meta.height === h) || (meta.width === h && meta.height === w)
    );

    // Also check for exact power-of-2 dimensions (very common in AI generation)
    const isPowerOf2 = (n: number) => n > 0 && (n & (n - 1)) === 0;
    const bothPowerOf2 = isPowerOf2(meta.width) && isPowerOf2(meta.height);

    // Very specific AI-typical aspect ratios
    const ratio = meta.width / meta.height;
    const isAiRatio = Math.abs(ratio - 1) < 0.01 || // 1:1 (SD, MJ)
      Math.abs(ratio - 0.5714) < 0.02 || // 4:7 (portrait SD)
      Math.abs(ratio - 1.7778) < 0.02 || // 16:9 (DALL-E)
      Math.abs(ratio - 0.5625) < 0.02;  // 9:16 (portrait DALL-E)

    if (isSuspicious || (bothPowerOf2 && isAiRatio)) {
      checks.push({
        check: 'suspicious_dimensions',
        status: 'warn',
        detail: `Image dimensions ${meta.width}×${meta.height} match common AI generation output sizes. This alone is not conclusive but is a red flag.`,
        icon: 'ai',
      });
    } else {
      checks.push({
        check: 'suspicious_dimensions',
        status: 'pass',
        detail: `Image dimensions ${meta.width ?? '?'}×${meta.height ?? '?'} do not match known AI output patterns.`,
        icon: 'ai',
      });
    }
  } else {
    checks.push({
      check: 'suspicious_dimensions',
      status: 'pass',
      detail: 'Could not verify dimensions.',
      icon: 'ai',
    });
  }

  // ── Check 5: Camera vs non-camera origin ──
  if (meta.fileType === 'image/jpeg') {
    if (!meta.cameraMake && !meta.cameraModel) {
      if (!meta.software && !meta.creatorTool) {
        // No camera, no software = likely screenshot or AI-generated
        checks.push({
          check: 'origin_analysis',
          status: 'warn',
          detail: 'No camera make/model and no software field detected. Image may be a screenshot, AI-generated, or had its metadata stripped.',
          icon: 'metadata',
        });
      } else {
        checks.push({
          check: 'origin_analysis',
          status: 'pass',
          detail: `No camera info. Software: ${meta.software || meta.creatorTool || 'unknown'}. Likely a digital document, scan export, or edited image.`,
          icon: 'metadata',
        });
      }
    } else {
      checks.push({
        check: 'origin_analysis',
        status: 'pass',
        detail: `Captured with ${meta.cameraMake || ''} ${meta.cameraModel || ''}`.trim() + '.',
        icon: 'metadata',
      });
    }
  }

  // ── Check 6: Date consistency (original vs digitized vs modified) ──
  if (meta.dateTimeOriginal && meta.dateTimeModified) {
    const origDate = parseDate(String(meta.dateTimeOriginal));
    const modDate = parseDate(String(meta.dateTimeModified));
    if (origDate && modDate) {
      const diffMs = Math.abs(modDate.getTime() - origDate.getTime());
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours > 1) {
        checks.push({
          check: 'date_inconsistency',
          status: 'warn',
          detail: `Original: ${meta.dateTimeOriginal}, Modified: ${meta.dateTimeModified}. Image was edited ${diffHours > 24 ? `${(diffHours / 24).toFixed(0)} days` : `${Math.round(diffHours)} hours`} after capture.`,
          icon: 'date',
        });
      } else {
        checks.push({
          check: 'date_inconsistency',
          status: 'pass',
          detail: 'Capture and modification timestamps are consistent.',
          icon: 'date',
        });
      }
    }
  }

  const hasFail = checks.some(c => c.status === 'fail');
  return {
    isSuspicious: hasFail,
    checks,
  };
}

export function checkTampering(
  fileMetadata: Record<string, unknown> | ImageMetadata | null,
  fileType: string,
  extractedData: { invoiceDate?: string | null; vendor?: string | null }
): TamperingCheck {
  // ── Image path (JPEG, PNG, WebP) ──
  if (fileType.startsWith('image/') && fileMetadata && 'hasExif' in (fileMetadata as ImageMetadata)) {
    const imgMeta = fileMetadata as ImageMetadata;
    return detectAiTamperingPatterns(imgMeta);
  }

  // ── PDF path ──
  const checks: TamperingCheck['checks'] = [];
  const pdfMeta = fileMetadata as Record<string, unknown> | null;

  if (!pdfMeta) {
    return { isSuspicious: false, checks: [{ check: 'metadata', status: 'pass', detail: 'No metadata available for this file.', icon: 'metadata' }] };
  }

  // Check: Creation date vs invoice date
  const creationDate = pdfMeta.CreationDate || pdfMeta.creationDate || pdfMeta.created;
  if (creationDate && extractedData.invoiceDate) {
    const pdfDate = parseDate(String(creationDate));
    const invDate = parseDate(extractedData.invoiceDate);
    if (pdfDate && invDate) {
      const diffYears = Math.abs(pdfDate.getFullYear() - invDate.getFullYear());
      if (diffYears > 2) {
        checks.push({
          check: 'date_mismatch',
          status: 'fail',
          detail: `PDF created ${pdfDate.getFullYear()} but invoice dated ${invDate.getFullYear()} — ${diffYears} year gap.`,
          icon: 'date',
        });
      } else if (diffYears > 1) {
        checks.push({
          check: 'date_mismatch',
          status: 'warn',
          detail: `PDF created ${pdfDate.getFullYear()}, invoice dated ${invDate.getFullYear()}.`,
          icon: 'date',
        });
      } else {
        checks.push({
          check: 'date_mismatch',
          status: 'pass',
          detail: 'PDF creation date and invoice date are consistent.',
          icon: 'date',
        });
      }
    }
  }

  // Check: Producer/Creator tool (extended list)
  const producer = String(pdfMeta.Producer || pdfMeta.producer || '');
  const creator = String(pdfMeta.Creator || pdfMeta.creator || '');
  const allProducerText = (producer + ' ' + creator).toLowerCase();

  // Check for AI tools in PDF metadata too
  let pdfAiTool: string | null = null;
  for (const aiTool of AI_TOOL_SIGNATURES) {
    for (const pattern of aiTool.patterns) {
      if (allProducerText.includes(pattern.toLowerCase())) {
        pdfAiTool = aiTool.label;
        break;
      }
    }
    if (pdfAiTool) break;
  }
  if (pdfAiTool) {
    checks.push({
      check: 'ai_tool_detected',
      status: 'fail',
      detail: `AI tool signature found in PDF metadata: ${pdfAiTool}.`,
      icon: 'ai',
    });
  }

  // Check for image editing software
  let pdfEditTool: string | null = null;
  for (const tool of EDITING_SOFTWARE) {
    if (allProducerText.includes(tool)) {
      pdfEditTool = tool;
      break;
    }
  }
  if (pdfEditTool) {
    const displayName = pdfEditTool.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    checks.push({
      check: 'editing_software',
      status: 'warn',
      detail: `PDF appears edited with: ${displayName}.`,
      icon: 'editing',
    });
  } else if (producer || creator) {
    checks.push({
      check: 'editing_software',
      status: 'pass',
      detail: `Created with: ${producer || creator}.`,
      icon: 'editing',
    });
  }

  // Check: Modified date
  const modDate = pdfMeta.ModDate || pdfMeta.modificationDate;
  if (modDate && creationDate) {
    const mod = parseDate(String(modDate));
    const cre = parseDate(String(creationDate));
    if (mod && cre && mod.getTime() > cre.getTime() + 60000) {
      checks.push({
        check: 'modified_after_creation',
        status: 'warn',
        detail: 'PDF was modified after initial creation.',
        icon: 'date',
      });
    }
  }

  return {
    isSuspicious: checks.some((c) => c.status === 'fail'),
    checks: checks.length > 0 ? checks : [{ check: 'metadata', status: 'pass', detail: 'No anomalies detected in PDF metadata.', icon: 'metadata' }],
  };
}

// ---- 9. HISTORICAL PATTERN DETECTION ----

export function detectPatterns(
  allInvoices: Array<{
    id: string;
    vendor?: string | null;
    total?: number | null;
    invDate?: string | null;
    createdAt: string;
  }>
): PatternAnomaly[] {
  const anomalies: PatternAnomaly[] = [];
  if (allInvoices.length < 3) return anomalies; // Need at least 3 for patterns

  // Group by vendor
  const byVendor: Record<string, typeof allInvoices> = {};
  for (const inv of allInvoices) {
    const v = (inv.vendor || 'Unknown').toLowerCase();
    if (!byVendor[v]) byVendor[v] = [];
    byVendor[v].push(inv);
  }

  for (const [vendorKey, vendorInvoices] of Object.entries(byVendor)) {
    const vendorName = vendorInvoices[0].vendor || 'Unknown';
    const totals = vendorInvoices
      .map((i) => i.total)
      .filter((t): t is number => typeof t === 'number' && t > 0);

    if (totals.length < 2) continue;

    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const stdDev = Math.sqrt(totals.reduce((s, t) => s + Math.pow(t - avg, 2), 0) / totals.length);

    // Anomaly: Invoice amount > avg + 3*stdDev
    if (stdDev > 0) {
      for (const inv of vendorInvoices) {
        if (typeof inv.total === 'number' && inv.total > avg + 3 * stdDev) {
          anomalies.push({
            invoiceId: inv.id,
            vendor: vendorName,
            anomaly: 'Unusual amount',
            severity: 'warning',
            detail: `$${inv.total.toFixed(2)} is ${(stdDev > 0 ? ((inv.total - avg) / stdDev).toFixed(1) : '?')}σ above the vendor average of $${avg.toFixed(2)}.`,
          });
        }
      }
    }

    // Anomaly: Amount is >5x the vendor's average
    if (avg > 0) {
      for (const inv of vendorInvoices) {
        if (typeof inv.total === 'number' && inv.total > avg * 5) {
          if (!anomalies.find((a) => a.invoiceId === inv.id)) {
            anomalies.push({
              invoiceId: inv.id,
              vendor: vendorName,
              anomaly: 'Spike in amount',
              severity: 'critical',
              detail: `$${inv.total.toFixed(2)} is ${((inv.total / avg)).toFixed(1)}x the vendor's average of $${avg.toFixed(2)}.`,
            });
          }
        }
      }
    }
  }

  return anomalies;
}

// ---- Helpers ----

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();

  // Try ISO format first: YYYY-MM-DD
  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    if (!isNaN(d.getTime())) return d;
  }

  // Try DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[/\.\-](\d{1,2})[/\.\-](\d{4})/);
  if (dmyMatch) {
    const d = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
    if (!isNaN(d.getTime())) return d;
  }

  // Try MM/DD/YYYY
  const mdyMatch = cleaned.match(/^(\d{1,2})[/\.\-](\d{1,2})[/\.\-](\d{4})/);
  if (mdyMatch) {
    const d = new Date(parseInt(mdyMatch[3]), parseInt(mdyMatch[1]) - 1, parseInt(mdyMatch[2]));
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback: Date.parse
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;

  return null;
}
