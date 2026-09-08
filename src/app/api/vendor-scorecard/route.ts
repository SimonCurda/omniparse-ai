import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';

// GET /api/vendor-scorecard — Vendor performance report (Business+)
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
        vendor: true, total: true, amount: true, confidence: true,
        isDuplicate: true, validationStatus: true, invDate: true,
        processingTime: true, lineItems: true, createdAt: true,
        approvalStatus: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by vendor
    const vendorMap = new Map<string, typeof invoices>();
    for (const inv of invoices) {
      const v = inv.vendor!;
      if (!vendorMap.has(v)) vendorMap.set(v, []);
      vendorMap.get(v)!.push(inv);
    }

    const scorecards = Array.from(vendorMap.entries()).map(([vendor, invs]) => {
      const totalAmount = invs.reduce((s, i) => s + (i.total ?? 0), 0);
      const avgAmount = totalAmount / invs.length;
      const avgConfidence = invs.reduce((s, i) => s + (i.confidence ?? 0), 0) / invs.length;
      const avgProcessingTime = invs.reduce((s, i) => s + (i.processingTime ?? 0), 0) / invs.length;
      const duplicateCount = invs.filter((i) => i.isDuplicate).length;
      const failCount = invs.filter((i) => i.validationStatus === 'fail').length;
      const warningCount = invs.filter((i) => i.validationStatus === 'warning').length;
      const passCount = invs.filter((i) => i.validationStatus === 'pass').length;

      // Price trend: compare first half vs second half avg
      const mid = Math.floor(invs.length / 2);
      const firstHalf = invs.slice(0, mid || 1);
      const secondHalf = invs.slice(mid || 1);
      const firstAvg = firstHalf.reduce((s, i) => s + (i.total ?? 0), 0) / firstHalf.length;
      const secondAvg = secondHalf.length > 0
        ? secondHalf.reduce((s, i) => s + (i.total ?? 0), 0) / secondHalf.length
        : firstAvg;
      const priceTrend = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

      // On-time invoicing: how many invoices have consistent date patterns
      const dates = invs.map((i) => i.invDate).filter(Boolean) as string[];
      const uniqueDays = new Set(dates.map((d) => d.slice(8, 10))); // day of month
      const invoicingRegularity = dates.length > 1 ? Math.min(100, (1 / uniqueDays.size) * 100) : 100;

      // Reliability score (0-100)
      const duplicateRate = invs.length > 0 ? (duplicateCount / invs.length) * 100 : 0;
      const failRate = invs.length > 0 ? (failCount / invs.length) * 100 : 0;
      const reliabilityScore = Math.max(0, Math.min(100,
        100 - (duplicateRate * 5) - (failRate * 3) - (warningCount > 0 ? (warningCount / invs.length) * 10 : 0)
      ));

      return {
        vendor,
        invoiceCount: invs.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        avgAmount: Math.round(avgAmount * 100) / 100,
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

    // Sort by total amount descending
    scorecards.sort((a, b) => b.totalAmount - a.totalAmount);

    return NextResponse.json({ scorecards, totalVendors: scorecards.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
