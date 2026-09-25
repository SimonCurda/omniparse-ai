import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/accounts?key=CRON_SECRET
//
// Returns account statistics for abuse detection. Shows all users with:
// - Invoice count (total + this month)
// - Chat session count
// - Email inbox count
// - Pending review count
// - Account age (days)
// - Abuse risk score (0-100, auto-calculated)
// - Account status (active/frozen/deleted)
//
// Sorted by abuse risk score descending (most suspicious first).
//
// Abuse risk score is calculated from:
// - High invoice volume relative to plan limits (>80% = +20 points)
// - High chat usage (>50 messages/day on Free = +20 points)
// - Many email inboxes (max is 5, having 5 = +10 points)
// - Very new account with high activity (<7 days old + >10 invoices = +25 points)
// - Account created but never verified email (if verification was enabled)
// - Multiple failed API calls (from audit logs, if available)
//
// SECURITY: Protected by CRON_SECRET env var. Never expose without it.

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET;

  if (!expectedKey) {
    return NextResponse.json(
      { error: 'CRON_SECRET env var is not set.' },
      { status: 500 },
    );
  }
  if (key !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all users with their stats
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        createdAt: true,
        active: true,
        hidden: true,
        starred: true,
        _count: {
          select: {
            invoices: true,
            chatSessions: true,
            emailInboxes: true,
            pendingReviews: true,
            auditLogs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate abuse risk score for each user
    const accountsWithRisk = await Promise.all(
      users.map(async (user) => {
        const ageDays = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        let riskScore = 0;
        const riskFactors: string[] = [];

        // Plan limits
        const planLimits: Record<string, number> = {
          free: 15, pro: 500, plus: 2000, business: 10000, enterprise: Infinity,
        };
        const limit = planLimits[user.plan] ?? 15;

        // High invoice volume relative to plan
        if (user._count.invoices > 0) {
          const usagePercent = (user._count.invoices / limit) * 100;
          if (usagePercent > 80) {
            riskScore += 20;
            riskFactors.push(`High invoice usage (${Math.round(usagePercent)}% of plan limit)`);
          }
        }

        // New account with high activity
        if (ageDays < 7 && user._count.invoices > 10) {
          riskScore += 25;
          riskFactors.push(`New account (${ageDays}d old) with ${user._count.invoices} invoices`);
        }

        // Many email inboxes
        if (user._count.emailInboxes >= 5) {
          riskScore += 10;
          riskFactors.push(`Maximum email inboxes (${user._count.emailInboxes})`);
        }

        // High pending review count (could indicate spam scanning)
        if (user._count.pendingReviews > 50) {
          riskScore += 15;
          riskFactors.push(`${user._count.pendingReviews} pending reviews (high volume)`);
        }

        // High chat usage for Free tier
        if (user.plan === 'free' && user._count.chatSessions > 5) {
          riskScore += 15;
          riskFactors.push(`High chat usage on Free tier (${user._count.chatSessions} sessions)`);
        }

        // Extremely new account (<1 day) with any invoices
        if (ageDays < 1 && user._count.invoices > 3) {
          riskScore += 20;
          riskFactors.push(`Very new account (<1 day) with ${user._count.invoices} invoices`);
        }

        // Cap at 100
        riskScore = Math.min(100, riskScore);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          createdAt: user.createdAt.toISOString(),
          ageDays,
          active: user.active,
          hidden: user.hidden,
          starred: user.starred,
          stats: {
            invoices: user._count.invoices,
            chatSessions: user._count.chatSessions,
            emailInboxes: user._count.emailInboxes,
            pendingReviews: user._count.pendingReviews,
            auditLogs: user._count.auditLogs,
          },
          abuseRisk: {
            score: riskScore,
            level: riskScore >= 50 ? 'high' : riskScore >= 25 ? 'medium' : 'low',
            factors: riskFactors,
          },
        };
      }),
    );

    // Sort by risk score descending (most suspicious first)
    accountsWithRisk.sort((a, b) => b.abuseRisk.score - a.abuseRisk.score);

    // Summary stats
    const summary = {
      totalAccounts: accountsWithRisk.length,
      highRisk: accountsWithRisk.filter((a) => a.abuseRisk.level === 'high').length,
      mediumRisk: accountsWithRisk.filter((a) => a.abuseRisk.level === 'medium').length,
      lowRisk: accountsWithRisk.filter((a) => a.abuseRisk.level === 'low').length,
      totalInvoices: accountsWithRisk.reduce((sum, a) => sum + a.stats.invoices, 0),
      totalChatSessions: accountsWithRisk.reduce((sum, a) => sum + a.stats.chatSessions, 0),
      totalEmailInboxes: accountsWithRisk.reduce((sum, a) => sum + a.stats.emailInboxes, 0),
      frozenAccounts: accountsWithRisk.filter((a) => !a.active).length,
    };

    // Fetch deletion logs (accounts that were deleted via admin dashboard)
    const deletionLogs = await db.adminDeletionLog.findMany({
      orderBy: { deletedAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      summary,
      accounts: accountsWithRisk,
      deletionLogs: deletionLogs.map((log) => ({
        id: log.id,
        deletedUserId: log.deletedUserId,
        email: log.deletedUserEmail,
        name: log.deletedUserName,
        plan: log.deletedUserPlan,
        stats: {
          invoices: log.invoiceCount,
          chatSessions: log.chatSessionCount,
          emailInboxes: log.emailInboxCount,
          pendingReviews: log.pendingReviewCount,
        },
        reason: log.reason,
        deletedBy: log.deletedBy,
        deletedAt: log.deletedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[admin/accounts] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch account statistics' },
      { status: 500 },
    );
  }
}
