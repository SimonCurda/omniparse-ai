import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature } from '@/lib/auth';

// GET /api/price-alerts — Detect vendor price changes month-over-month (Business+)
export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (!user || !hasFeature(user.plan, 'price_change_alerts')) {
      return NextResponse.json({ error: 'Price change alerts require Business plan or higher.' }, { status: 403 });
    }

    // Get all invoices with vendor and line items
    const invoices = await db.invoice.findMany({
      where: { userId: auth.userId, vendor: { not: null } },
      select: { vendor: true, total: true, amount: true, lineItems: true, invDate: true, currency: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const alerts: Array<{
      vendor: string;
      currency: string;
      type: 'total_increase' | 'item_price_increase';
      description: string;
      oldVal: number;
      newVal: number;
      changePercent: number;
      invDate: string;
      prevDate: string;
    }> = [];

    // Group by vendor + currency — never mix currencies when comparing averages.
    // A vendor's EUR invoices and CZK invoices are tracked separately so a
    // price change in one currency doesn't pollute the other.
    const byVendorCurrency = new Map<string, typeof invoices>();
    for (const inv of invoices) {
      const v = inv.vendor!;
      const cur = (inv.currency || 'USD').toUpperCase();
      const key = `${v}|||${cur}`;
      if (!byVendorCurrency.has(key)) byVendorCurrency.set(key, []);
      byVendorCurrency.get(key)!.push(inv);
    }

    // Compare month-over-month per vendor + currency
    for (const [key, vendorInvs] of byVendorCurrency) {
      const [vendor, currency] = key.split('|||');
      if (vendorInvs.length < 2) continue;

      // Group by month
      const byMonth = new Map<string, typeof vendorInvs>();
      for (const inv of vendorInvs) {
        const dateStr = inv.invDate || inv.createdAt.toISOString().slice(0, 10);
        const month = dateStr.slice(0, 7); // YYYY-MM
        if (!byMonth.has(month)) byMonth.set(month, []);
        byMonth.get(month)!.push(inv);
      }

      const months = Array.from(byMonth.keys()).sort();
      if (months.length < 2) continue;

      // Compare last two months
      const currentMonth = months[months.length - 1];
      const prevMonth = months[months.length - 2];

      const currentInvs = byMonth.get(currentMonth)!;
      const prevInvs = byMonth.get(prevMonth)!;

      const currentAvgTotal = currentInvs.reduce((s, i) => s + (i.total ?? 0), 0) / currentInvs.length;
      const prevAvgTotal = prevInvs.reduce((s, i) => s + (i.total ?? 0), 0) / prevInvs.length;

      if (prevAvgTotal > 0) {
        const changePercent = ((currentAvgTotal - prevAvgTotal) / prevAvgTotal) * 100;
        if (Math.abs(changePercent) >= 10) {
          alerts.push({
            vendor,
            currency,
            type: 'total_increase',
            description: changePercent > 0
              ? `${vendor} average invoice total increased ${changePercent.toFixed(1)}% (${currency})`
              : `${vendor} average invoice total decreased ${Math.abs(changePercent).toFixed(1)}% (${currency})`,
            oldVal: Math.round(prevAvgTotal * 100) / 100,
            newVal: Math.round(currentAvgTotal * 100) / 100,
            changePercent: Math.round(changePercent * 10) / 10,
            invDate: currentMonth,
            prevDate: prevMonth,
          });
        }
      }

      // Line item price comparison (within the same currency)
      const currentItemPrices = new Map<string, number[]>();
      const prevItemPrices = new Map<string, number[]>();

      for (const inv of currentInvs) {
        const items = inv.lineItems as Array<{ description?: string; unitPrice?: number }> | null;
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.description && item.unitPrice) {
              const k = item.description.toLowerCase().trim();
              if (!currentItemPrices.has(k)) currentItemPrices.set(k, []);
              currentItemPrices.get(k)!.push(item.unitPrice);
            }
          }
        }
      }

      for (const inv of prevInvs) {
        const items = inv.lineItems as Array<{ description?: string; unitPrice?: number }> | null;
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.description && item.unitPrice) {
              const k = item.description.toLowerCase().trim();
              if (!prevItemPrices.has(k)) prevItemPrices.set(k, []);
              prevItemPrices.get(k)!.push(item.unitPrice);
            }
          }
        }
      }

      for (const [itemKey, currentPrices] of currentItemPrices) {
        const prevPrices = prevItemPrices.get(itemKey);
        if (!prevPrices || prevPrices.length === 0) continue;

        const currentAvg = currentPrices.reduce((a, b) => a + b, 0) / currentPrices.length;
        const prevAvg = prevPrices.reduce((a, b) => a + b, 0) / prevPrices.length;

        if (prevAvg > 0) {
          const changePercent = ((currentAvg - prevAvg) / prevAvg) * 100;
          if (changePercent >= 10) {
            const itemDesc = currentPrices.length > 0
              ? (currentInvs[0].lineItems as Array<{ description?: string }> | null)
                  ?.find((i) => i.description?.toLowerCase().trim() === itemKey)?.description || itemKey
              : itemKey;
            alerts.push({
              vendor,
              currency,
              type: 'item_price_increase',
              description: `${vendor} raised price on '${itemDesc}' from ${currency} ${prevAvg.toFixed(2)} to ${currency} ${currentAvg.toFixed(2)} (${changePercent.toFixed(1)}% increase)`,
              oldVal: Math.round(prevAvg * 100) / 100,
              newVal: Math.round(currentAvg * 100) / 100,
              changePercent: Math.round(changePercent * 10) / 10,
              invDate: currentMonth,
              prevDate: prevMonth,
            });
          }
        }
      }
    }

    // Sort by change percent descending
    alerts.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

    return NextResponse.json({ alerts, totalVendors: byVendorCurrency.size, analyzedMonths: new Set(invoices.map((i) => (i.invDate || i.createdAt.toISOString()).slice(0, 7))).size });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
