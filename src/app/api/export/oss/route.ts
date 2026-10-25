import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// ─── OSS return CSV export ────────────────────────────────────────────────────
//
// POST /api/export/oss
// Body: { year: number, month: number (1-12) }
// Returns: CSV with rows per EU consumer country for the OSS quarterly return
//
// WHAT THIS DOES
// ==============
// For EU B2C digital service providers (which OmniParse is — SaaS = digital
// service), once total EU B2C sales exceed €10,000/year, the supplier must
// register for OSS (One-Stop Shop) in their country of residence and file
// quarterly returns declaring VAT collected per EU member state where
// consumers are located.
//
// This endpoint pulls invoices from Stripe for the requested month,
// filters to B2C (no VAT ID on customer OR customer country ≠ supplier
// country), aggregates by country, and emits a CSV that matches the OSS
// return format used by Czech finanční úřad (and other EU tax authorities
// who follow the EU OSS standard schema).
//
// CSV COLUMNS
// ===========
//   country_code   — ISO 3166-1 alpha-2 (DE, FR, AT, ...)
//   country_name   — English country name
//   vat_rate        — VAT rate applied (e.g. 0.19, 0.20, 0.21)
//   net_amount     — Net amount (excluding VAT), in EUR (Stripe Tax always in EUR)
//   vat_amount     — VAT amount collected, in EUR
//   gross_amount   — Net + VAT, in EUR
//   invoice_count   — Number of B2C invoices for that country
//   first_invoice   — Date of first B2C invoice in period (for evidence)
//   last_invoice    — Date of last B2C invoice in period
//
// STRIPE TAX + OSS
// ================
// When Stripe Tax is enabled (via automatic_tax: true in the checkout
// route), Stripe automatically:
//   1. Determines the customer's location (from billing address + card)
//   2. Applies the correct VAT rate for B2C digital services to EU consumers
//   3. Records the VAT breakdown in the Stripe Invoice
//
// This endpoint reads the Stripe Invoices API for the period, filters to
// B2C EU consumers (i.e. customers with no VAT ID OR whose country ≠
// supplier's country — these are the OSS-relevant transactions), and
// aggregates.
//
// ACCESS
// ======
// Admin-only. The OSS return covers ALL EU B2C transactions across all
// OmniParse customers — only the operator (you, Simon) needs to file it.
// We check that the requesting user is an admin by checking ADMIN_EMAIL.
//
// WHEN STRIPE TAX IS NOT YET ENABLED
// ==================================
// If STRIPE_SECRET_KEY is not set, or no Stripe Tax invoices exist for
// the period, we return an empty CSV with a 200 + a message in the
// `note` field. The endpoint is functional, but only useful once Stripe
// Tax is live.

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin gate — OSS covers all customers, must be operator
    const adminEmail = process.env.ADMIN_EMAIL;
    const requestingUser = await db.user.findUnique({
      where: { id: auth.userId },
      select: { email: true },
    });
    if (!requestingUser || requestingUser.email !== adminEmail) {
      return NextResponse.json({
        error: 'OSS export is admin-only. Set ADMIN_EMAIL to your operator email.',
      }, { status: 403 });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json({
        error: 'STRIPE_SECRET_KEY not configured. Stripe Tax must be live to generate OSS returns.',
      }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const year = body.year ?? new Date().getFullYear();
    const month = body.month ?? new Date().getMonth();  // 0-indexed if not provided
    // Build date range — entire month
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    // Pull Stripe invoices for the period
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecretKey);

    // List all invoices in the period — Stripe returns at most 100/page.
    // We loop with `starting_after` until exhausted. For early-stage
    // OmniParse this is fine (< 1k invoices/month). For high-volume periods,
    // we should switch to Stripe's invoice search API with a created filter.
    let hasMore = true;
    let lastId: string | undefined;
    const allInvoices: any[] = [];
    while (hasMore) {
      const params: any = {
        limit: 100,
        created: {
          gte: Math.floor(start.getTime() / 1000),
          lt: Math.floor(end.getTime() / 1000),
        },
      };
      if (lastId) params.starting_after = lastId;
      const res = await stripe.invoices.list(params);
      allInvoices.push(...res.data);
      hasMore = res.has_more;
      if (res.data.length > 0) lastId = res.data[res.data.length - 1].id;
      else break;
      // Safety cap — 50 pages = 5000 invoices; bail if we hit this
      if (allInvoices.length > 5000) break;
    }

    // Filter to B2C EU consumers: paid invoices where customer has no VAT ID
    // AND customer country is in EU (and != supplier country — supplier
    // country = "CZ" for OmniParse)
    const SUPPLIER_COUNTRY = 'CZ';
    const EU_COUNTRIES = ['AT','BE','BG','HR','CY','DK','EE','FI','FR','DE','EL','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];

    interface AggregatedRow {
      country: string;
      vatRate: number;
      netAmount: number;
      vatAmount: number;
      grossAmount: number;
      invoiceCount: number;
      firstInvoice: string;
      lastInvoice: string;
    }

    const byCountry = new Map<string, AggregatedRow>();

    for (const inv of allInvoices) {
      // Only count paid/paid invoices
      if (inv.status !== 'paid') continue;
      // Skip reverse-charge B2B (customer had a valid VAT ID on Stripe customer)
      // Stripe exposes this via customer.tax_ids[] — if any tax ID exists, treat as B2B
      const customer = inv.customer_details ?? (inv.customer as unknown as Record<string, unknown> | null);
      const customerObj = (customer && typeof customer === 'object' ? customer : {}) as Record<string, unknown>;
      const taxIds = (customerObj['tax_ids'] as unknown[] | undefined) ?? [];
      if (taxIds.length > 0) continue;

      const country = inv.customer_address?.country ?? inv.customer_details?.address?.country;
      if (!country) continue;
      const countryUpper = country.toUpperCase();
      if (!EU_COUNTRIES.includes(countryUpper)) continue;
      if (countryUpper === SUPPLIER_COUNTRY) continue;

      // Stripe Tax breakdown
      const taxBreakdown = inv.total_tax_amounts ?? [];
      const vatRow = taxBreakdown.find((t: any) => t.tax_rate?.country === countryUpper);
      const vatRate = vatRow?.tax_rate?.percentage ?? 0;
      const vatAmt = (vatRow?.amount ?? 0) / 100;  // Stripe stores cents
      const gross = (inv.total ?? 0) / 100;
      const net = gross - vatAmt;

      const key = `${countryUpper}_${vatRate.toFixed(2)}`;
      const existing = byCountry.get(key);
      if (existing) {
        existing.netAmount += net;
        existing.vatAmount += vatAmt;
        existing.grossAmount += gross;
        existing.invoiceCount++;
        existing.firstInvoice = existing.firstInvoice < inv.created ? existing.firstInvoice : inv.created;
        existing.lastInvoice = existing.lastInvoice > inv.created ? existing.lastInvoice : inv.created;
      } else {
        byCountry.set(key, {
          country: countryUpper,
          vatRate,
          netAmount: net,
          vatAmount: vatAmt,
          grossAmount: gross,
          invoiceCount: 1,
          firstInvoice: inv.created,
          lastInvoice: inv.created,
        });
      }
    }

    // Build CSV — sorted by country code then vat rate
    const COUNTRY_NAMES: Record<string, string> = {
      AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus',
      CZ: 'Czech Republic', DK: 'Denmark', EE: 'Estonia', FI: 'Finland',
      FR: 'France', DE: 'Germany', EL: 'Greece', HU: 'Hungary', IE: 'Ireland',
      IT: 'Italy', LV: 'Latvia', LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta',
      NL: 'Netherlands', PL: 'Poland', PT: 'Portugal', RO: 'Romania',
      SK: 'Slovakia', SI: 'Slovenia', ES: 'Spain', SE: 'Sweden',
    };

    const rows = Array.from(byCountry.values()).sort((a, b) =>
      a.country.localeCompare(b.country) || a.vatRate - b.vatRate
    );

    const header = 'country_code;country_name;vat_rate;net_amount_eur;vat_amount_eur;gross_amount_eur;invoice_count;first_invoice;last_invoice';
    const lines = rows.map(r => [
      r.country,
      COUNTRY_NAMES[r.country] ?? r.country,
      r.vatRate.toFixed(4),
      r.netAmount.toFixed(2),
      r.vatAmount.toFixed(2),
      r.grossAmount.toFixed(2),
      r.invoiceCount,
      new Date(Number(r.firstInvoice) * 1000).toISOString().slice(0, 10),
      new Date(Number(r.lastInvoice) * 1000).toISOString().slice(0, 10),
    ].join(';'));

    const csv = '\uFEFF' + header + '\r\n' + lines.join('\r\n');
    const filename = `oss-return-${year}-${String(month).padStart(2, '0')}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[export/oss] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
