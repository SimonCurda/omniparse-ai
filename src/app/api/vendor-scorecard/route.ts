import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';
import { computeOutlierExcludedStats } from '@/lib/invoice-engine';

// GET /api/vendor-scorecard — Vendor performance report (Business+)
//
// KEY: avgAmount is the OUTLIER-EXCLUDED average. If a vendor has 5 invoices
// at $200, $210, $190, $180, $50,000, the scorecard shows avgAmount = $195
// (not $10,156). The $50,000 invoice is flagged as a suspicious high outlier
// and excluded, with `excludedOutliers` listing what was excluded.
export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (!user || !hasFeature(user.plan, 'vendor_scorecard')) {
      return NextResponse.json({ error: 'Vendor scorecard requires Business plan or higher.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const vendorName = searchParams.get('vendor');

    const where: Record<string, unknown> = { userId: auth.userId, vendor: { not: null } };
    if (vendorName) where.vendor = vendorName;

    const invoices = await db.invoice.findMany({
      where,
      select: {
        id: true,
        vendor: true, total: true, amount: true, confidence: true,
        isDuplicate: true, validationStatus: true, invDate: true,
        processingTime: true, lineItems: true, createdAt: true,
        approvalStatus: true, currency: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by vendor + currency.
    const vendorCurrencyMap = new Map<string, typeof invoices>();
    for (const inv of invoices) {
      const v = inv.vendor!;
      const cur = (inv.currency || 'USD').toUpperCase();
      const key = `${v}|||${cur}`;
      if (!vendorCurrencyMap.has(key)) vendorCurrencyMap.set(key, []);
      vendorCurrencyMap.get(key)!.push(inv);
    }

    const scorecards = Array.from(vendorCurrencyMap.entries()).map(([key, invs]) => {
      const [vendor, currency] = key.split('|||');

      const outlierStats = computeOutlierExcludedStats(invs);
      const avgAmount = outlierStats.cleanAvg;

      // Total Amount still shows the TRUE total (incl. outliers) so the user's
      // books reconcile — but the avg is the clean one.
      const totalAmount = invs.reduce((s, i) => s + (i.total ?? 0), 0);

      const avgConfidence = invs.reduce((s, i) => s + (i.confidence ?? 0), 0) / invs.length;
      const avgProcessingTime = invs.reduce((s, i) => s + (i.processingTime ?? 0), 0) / invs.length;
      const duplicateCount = invs.filter((i) => i.isDuplicate).length;
      const failCount = invs.filter((i) => i.validationStatus === 'fail').length;
      const warningCount = invs.filter((i) => i.validationStatus === 'warning').length;
      const passCount = invs.filter((i) => i.validationStatus === 'pass').length;

      // Price trend: outlier-excluded averages per half.
      const mid = Math.floor(invs.length / 2);
      const firstHalf = invs.slice(0, mid || 1);
      const secondHalf = invs.slice(mid || 1);
      const firstStats = computeOutlierExcludedStats(firstHalf);
      const secondStats = computeOutlierExcludedStats(secondHalf);
      const firstAvg = firstStats.cleanAvg;
      const secondAvg = secondStats.cleanAvg > 0 ? secondStats.cleanAvg : firstAvg;
      const priceTrend = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

      const dates = invs.map((i) => i.invDate).filter(Boolean) as string[];
      const uniqueDays = new Set(dates.map((d) => d.slice(8, 10)));
      const invoicingRegularity = dates.length > 1 ? Math.min(100, (1 / uniqueDays.size) * 100) : 100;

      const duplicateRate = invs.length > 0 ? (duplicateCount / invs.length) * 100 : 0;
      const failRate = invs.length > 0 ? (failCount / invs.length) * 100 : 0;
      const reliabilityScore = Math.max(0, Math.min(100,
        100 - (duplicateRate * 5) - (failRate * 3) - (warningCount > 0 ? (warningCount / invs.length) * 10 : 0)
      ));

      return {
        vendor,
        currency,
        invoiceCount: invs.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        avgAmount: Math.round(avgAmount * 100) / 100,
        rawAvgAmount: Math.round(outlierStats.rawAvg * 100) / 100,
        outlierCount: outlierStats.outlierCount,
        outlierAmount: Math.round(outlierStats.outlierAmount * 100) / 100,
        excludedOutliers: outlierStats.outliers.map((o) => {
          const inv = invs.find((i) => i.id === o.id);
          return {
            id: o.id,
            amount: Math.round(o.amount * 100) / 100,
            direction: o.direction,
            reason: o.reason,
            invDate: inv?.invDate || null,
          };
        }),
        avgConfidence: Math.round(avgConfidence * 1000) / 1000,
        avgProcessingTime: Math.round(avgProcessingTime * 100) / 100,
        duplicateCount,
        failCount,
        warningCount,
        passCount,
        priceTrend: Math.round(priceTrend * 10) / 10,
        invoicingRegularity: Math.round(invoicingRegularity),
        reliabilityScore: Math.round(reliabilityScore),
        firstInvoiceDate: invs[invs.length - 1]?.invDate || invs[invs.length - 1]?.createdAt.toISOString().slice(0, 10),
        lastInvoiceDate: invs[0]?.invDate || invs[0]?.createdAt.toISOString().slice(0, 10),
      };
    });

    scorecards.sort((a, b) => b.totalAmount - a.totalAmount);

    return NextResponse.json({ scorecards, totalVendors: scorecards.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
