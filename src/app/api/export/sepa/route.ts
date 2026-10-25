import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';
import { generateSepaXml, type SepaPayment } from '@/lib/sepa';

// ─── SEPA XML Export ─────────────────────────────────────────────────────────
//
// POST /api/export/sepa
// Body: {
//   invoiceIds: string[],            // invoices to include
//   initiatingParty: {
//     name: string,                  // your company / personal name
//     iban: string,                  // your IBAN (debtor account)
//     bic?: string,                  // your BIC (optional for EEA banks)
//     accountHolderName?: string,    // exact name on the bank account
//   },
//   executionDate?: string (ISO),    // default: today (bank processes on next business day)
//   includeCreditorBic?: boolean,    // default: false — most EU IBANs are lookup-able from IBAN
//                                    //   set true if you want to send the BIC you have on the
//                                    //   invoice customFields
// }
//
// WHAT THIS DOES
// ==============
// Generates an ISO 20022 pain.001.001.09 SEPA Credit Transfer Initiation
// XML file that can be imported into any EU bank's internet banking —
// Fio, KB, Ceska Sporitelna, Raiffeisen, Revolut Business, Wise, Monese,
// ING, Commerzbank, etc.
//
// The XML creates ONE SEPA batch with one CdtTrfTxInf per invoice.
// The bank pays each creditor the specified amount from the debtor's
// account on (or after) the execution date.
//
// PLAN ACCESS
// ============
// Available on Plus and higher. Why: SEPA XML is a high-value business
// feature; Free + Pro users can still export CSV/JSON + manually build
// the SEPA batch in their bank.
//
// CURRENCY CONSTRAINT
// ===================
// SEPA supports only EUR. Invoices with non-EUR currency are filtered
// out + returned in the response as `skipped`. The user must convert
// those payments manually (e.g. via their bank's standard transfer).
//
// VAT NOTE
// ========
// SEPA transfers do NOT carry VAT data. The invoice VAT amount is
// informational only — the creditor (vendor) issues the invoice, the
// debtor (OmniParse customer) pays the gross amount (total). The
// vendor handles VAT reporting on their side.

interface SepaExportBody {
  invoiceIds: string[];
  initiatingParty: {
    name: string;
    iban: string;
    bic?: string;
    accountHolderName?: string;
  };
  executionDate?: string;
  includeCreditorBic?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Plan-gate: Plus and higher (custom_export_templates is on Plus+)
    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (!user || !hasFeature(user.plan, 'custom_export_templates')) {
      return NextResponse.json({
        error: 'SEPA XML export requires Plus plan or higher.',
      }, { status: 403 });
    }

    const body = await req.json() as SepaExportBody;
    if (!body?.invoiceIds || !Array.isArray(body.invoiceIds) || body.invoiceIds.length === 0) {
      return NextResponse.json({ error: 'invoiceIds (non-empty array) is required.' }, { status: 400 });
    }
    if (!body?.initiatingParty?.iban || !body?.initiatingParty?.name) {
      return NextResponse.json({
        error: 'initiatingParty.name and initiatingParty.iban are required.',
      }, { status: 400 });
    }

    // Load invoices — only those that belong to the user + have EUR currency
    // + have a vendor + have a total
    const invoices = await db.invoice.findMany({
      where: {
        id: { in: body.invoiceIds },
        userId: auth.userId,
        currency: 'EUR',  // SEPA constraint
        vendor: { not: null },
        total: { not: null },
      },
      select: {
        id: true,
        invNumber: true,
        vendor: true,
        total: true,
        currency: true,
        customFields: true,
      },
    });

    // Track skipped invoices (not EUR, no vendor, no total, or not owned)
    const foundIds = new Set(invoices.map(i => i.id));
    const skipped = body.invoiceIds.filter(id => !foundIds.has(id));

    if (invoices.length === 0) {
      return NextResponse.json({
        error: 'No eligible invoices. SEPA requires EUR currency + non-empty vendor + non-empty total. Use the invoices tab to filter.',
        skipped,
      }, { status: 400 });
    }

    // Build payments — the user can optionally provide creditorBic per
    // invoice via customFields.bic or customFields.swiftBic
    const payments: SepaPayment[] = [];
    const skippedMissingIban: string[] = [];

    for (const inv of invoices) {
      const customFields = (inv.customFields as Record<string, unknown> | null) ?? {};
      const creditorIban = (
        typeof customFields.iban === 'string' ? customFields.iban :
        typeof customFields.IBAN === 'string' ? customFields.IBAN :
        ''
      ).trim();
      const creditorBic = (
        typeof customFields.bic === 'string' ? customFields.bic :
        typeof customFields.swift === 'string' ? customFields.swift :
        typeof customFields.BIC === 'string' ? customFields.BIC :
        undefined
      );

      if (!creditorIban) {
        skippedMissingIban.push(inv.id);
        continue;
      }

      payments.push({
        endToEndId: truncateAscii(inv.invNumber || inv.id, 35),
        creditorName: inv.vendor!.slice(0, 70),
        creditorIban,
        creditorBic: body.includeCreditorBic ? creditorBic : undefined,
        amount: inv.total!,
        currency: inv.currency,
        remittanceInfo: inv.invNumber ? `Invoice ${inv.invNumber}` : undefined,
      });
    }

    if (payments.length === 0) {
      return NextResponse.json({
        error: 'None of the selected invoices have an IBAN in their customFields. Add IBAN to invoices (Edit → Custom fields → "IBAN") before exporting SEPA.',
        skipped,
        skippedMissingIban,
      }, { status: 400 });
    }

    // Generate unique IDs — message ID must be unique over 90 days
    // Format: OMNI-<userId>-<timestamp>-<random>
    const now = Date.now();
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const messageId = `OMNI-${auth.userId.slice(-8)}-${now}-${rand}`.slice(0, 35);
    const paymentId = `PMT-${auth.userId.slice(-8)}-${now}`.slice(0, 35);
    const executionDate = body.executionDate ? new Date(body.executionDate) : new Date();

    const xml = generateSepaXml({
      messageId,
      paymentId,
      executionDate,
      initiatingParty: body.initiatingParty,
      payments,
    });

    // Return as XML download
    const filename = `sepa-payment-${executionDate.toISOString().slice(0, 10)}.xml`;
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[export/sepa] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Truncate to max length + ASCII-only (for SEPA EndToEndId etc.)
function truncateAscii(s: string, max: number): string {
  return s.replace(/[^\x20-\x7E]/g, '').slice(0, max);
}
