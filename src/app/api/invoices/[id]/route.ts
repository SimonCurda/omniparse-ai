import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';

// ─── Invoice Edit Validation Schema ──────────────────────────────────────────

const KNOWN_CURRENCIES = [
  'USD','EUR','GBP','JPY','CAD','AUD','CHF','CNY','INR','MXN','BRL','KRW','SGD',
  'HKD','NOK','SEK','DKK','NZD','ZAR','RUB','TRY','PLN','CZK','HUF','ILS','THB',
  'IDR','MYR','PHP','TWD','SAR','AED','ARS','CLP','COP','PEN','VND','EGP','NGN',
  'KES','PKR','BDT','LKR','UAH','RON','BGN','HRK','ISK','GEL','AMD','AZN','KZT',
  'UZS','MNT','LAK','KHR','MMK','NPR','AFN','TJS','TMT','UYS','PYG','BOB','DOP',
  'GTQ','HNL','NIO','SVC','CRC','PAB','JMD','TTD','BBD','BZD','GYD','SRD','AWG',
  'CDF','MGA','MUR','SCR','SOS','ETB','GHS','TZS','UGX','RWF','BIF','CDF','XOF',
  'XAF','MAD','DZD','TND','LYD','SYP','JOD','IQD','LBP','IRR','OMR','QAR','BHD',
  'KWD','YER','AFN','BSD','BMD','KYD','XCD','ANG','SBD','FJD','PGK','VUV','WST',
  'TOP','TVL','KID','NZD','AUD','USD','EUR','GBP',
];

const isoDateSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  'Invalid date format (expected ISO 8601)'
);

const invoiceEditSchema = z.object({
  vendor: z.string().min(1).max(200, 'Vendor name must be at most 200 characters').optional(),
  invNumber: z.string().min(1).max(50, 'Invoice number must be at most 50 characters').optional(),
  invDate: isoDateSchema.optional(),
  dueDate: isoDateSchema.optional(),
  amount: z.number().refine((v) => !isNaN(v), 'Amount must be a valid number').optional(),
  vatAmount: z.number().refine((v) => !isNaN(v), 'VAT amount must be a valid number').optional(),
  total: z.number().refine((v) => !isNaN(v), 'Total must be a valid number').optional(),
  currency: z.string().length(3, 'Currency must be a 3-letter code').refine(
    (c) => KNOWN_CURRENCIES.includes(c.toUpperCase()),
    'Unknown currency code'
  ).optional(),
}).strict();

// GET /api/invoices/[id] — Get single invoice detail (excludes fileData to avoid 4.5MB response limit)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const invoice = await db.invoice.findFirst({
      where: { id, userId: auth.userId },
      select: {
        id: true, filename: true, vendor: true, invNumber: true, invDate: true,
        dueDate: true, amount: true, vatAmount: true, total: true, currency: true,
        status: true, isDuplicate: true, confidence: true, fieldConfidence: true,
        createdAt: true, validationResults: true, validationStatus: true,
        normalizedVendor: true, normalizedInvDate: true, normalizedDueDate: true,
        normalizedAmount: true, normalizedTotal: true, normalizedCurrency: true,
        processingTime: true, customFields: true, approvalStatus: true,
        lifecycleStatus: true, rawExtraction: true, lineItems: true,
      },
    });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    return NextResponse.json(invoice);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/invoices/[id] — Edit invoice fields (Pro+)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (!user || !hasFeature(user.plan, 'invoice_editing')) {
      return NextResponse.json({ error: 'Invoice editing requires Pro plan or higher.' }, { status: 403 });
    }

    const invoice = await db.invoice.findFirst({ where: { id, userId: auth.userId } });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const rawBody = await req.json();

    // Validate input with Zod schema
    const parsed = invoiceEditSchema.safeParse(rawBody);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const validatedData = parsed.data;
    const editableFields = ['vendor', 'invNumber', 'invDate', 'dueDate', 'amount', 'vatAmount', 'total', 'currency'] as const;
    const updates: Record<string, unknown> = {};
    const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

    for (const field of editableFields) {
      if (validatedData[field] !== undefined && validatedData[field] !== invoice[field as keyof typeof invoice]) {
        updates[field] = validatedData[field];
        changes.push({ field, oldValue: invoice[field as keyof typeof invoice], newValue: validatedData[field] });
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No changes provided.' }, { status: 400 });
    }

    const updated = await db.invoice.update({ where: { id }, data: updates });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: auth.userId,
        invoiceId: id,
        action: 'edited',
        details: { changes } as any,
      },
    });

    // Re-run validation on edited invoice (simplified)
    // In production this would call the full validation engine
    const validationStatus = updated.amount !== null && updated.total !== null && updated.vendor
      ? 'pass' : 'warning';

    await db.invoice.update({ where: { id }, data: { validationStatus } });

    return NextResponse.json({
      id: updated.id,
      vendor: updated.vendor,
      invNumber: updated.invNumber,
      invDate: updated.invDate,
      dueDate: updated.dueDate,
      amount: updated.amount,
      vatAmount: updated.vatAmount,
      total: updated.total,
      currency: updated.currency,
      validationStatus,
      changes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/invoices/[id] — Change lifecycle status (Pro+: basic, Plus+: custom)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (!user || !hasFeature(user.plan, 'lifecycle_status_basic')) {
      return NextResponse.json({ error: 'Status tracking requires Pro plan or higher.' }, { status: 403 });
    }

    const invoice = await db.invoice.findFirst({ where: { id, userId: auth.userId } });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const body = await req.json();
    const newStatus = body.status;
    if (!newStatus || typeof newStatus !== 'string') {
      return NextResponse.json({ error: 'Status is required.' }, { status: 400 });
    }

    // For Plus+, validate custom statuses exist
    if (hasFeature(user.plan, 'custom_lifecycle_statuses')) {
      const basicStatuses = ['pending', 'approved', 'exported', 'paid'];
      if (!basicStatuses.includes(newStatus)) {
        const customStatus = await db.customStatus.findFirst({ where: { userId: auth.userId, name: newStatus } });
        if (!customStatus) {
          return NextResponse.json({ error: `Unknown status: ${newStatus}` }, { status: 400 });
        }
      }
    } else {
      // Pro: only basic statuses
      const allowed = ['pending', 'approved', 'exported', 'paid'];
      if (!allowed.includes(newStatus)) {
        return NextResponse.json({ error: `Status must be one of: ${allowed.join(', ')}` }, { status: 400 });
      }
    }

    const oldStatus = invoice.lifecycleStatus;
    const updated = await db.invoice.update({
      where: { id },
      data: { lifecycleStatus: newStatus },
    });

    await db.auditLog.create({
      data: {
        userId: auth.userId,
        invoiceId: id,
        action: 'status_changed',
        details: { oldStatus, newStatus },
      },
    });

    return NextResponse.json({ id: updated.id, lifecycleStatus: updated.lifecycleStatus, oldStatus, newStatus });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
