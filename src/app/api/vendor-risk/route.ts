import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!hasFeature(user.plan, 'vendor_risk_scoring')) {
      return NextResponse.json({ error: 'Vendor risk scoring requires Plus plan or higher' }, { status: 403 });
    }

    // Get all invoices for the user
    const invoices = await db.invoice.findMany({
      where: { userId: user.id },
      select: {
        vendor: true,
        validationStatus: true,
        isDuplicate: true,
        validationResults: true,
      },
    });

    // Group by vendor
    const vendorMap = new Map<string, { totalInvoices: number; flaggedInvoices: number; duplicateAttempts: number; tamperingAttempts: number }>();

    for (const inv of invoices) {
      const vendor = inv.vendor || 'Unknown Vendor';
      if (!vendorMap.has(vendor)) {
        vendorMap.set(vendor, { totalInvoices: 0, flaggedInvoices: 0, duplicateAttempts: 0, tamperingAttempts: 0 });
      }
      const stats = vendorMap.get(vendor)!;
      stats.totalInvoices++;

      const isFlagged =
        inv.validationStatus === 'fail' ||
        inv.validationStatus === 'warning' ||
        inv.isDuplicate;
      if (isFlagged) stats.flaggedInvoices++;

      if (inv.isDuplicate) stats.duplicateAttempts++;

      // Check tampering in validationResults
      if (inv.validationResults && typeof inv.validationResults === 'object') {
        const vr = inv.validationResults as Record<string, unknown>;
        const tc = vr.tamperingCheck as Record<string, unknown> | undefined;
        if (tc && tc.isSuspicious === true) {
          stats.tamperingAttempts++;
        }
      }
    }

    // Build result array
    const result = Array.from(vendorMap.entries()).map(([vendor, stats]) => ({
      vendor,
      totalInvoices: stats.totalInvoices,
      flaggedInvoices: stats.flaggedInvoices,
      riskScore: stats.totalInvoices > 0
        ? Math.round((stats.flaggedInvoices / stats.totalInvoices) * 1000) / 10
        : 0,
      duplicateAttempts: stats.duplicateAttempts,
      tamperingAttempts: stats.tamperingAttempts,
    }));

    // Sort by riskScore desc
    result.sort((a, b) => b.riskScore - a.riskScore);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
