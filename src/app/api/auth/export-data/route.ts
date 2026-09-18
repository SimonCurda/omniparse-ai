import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [user, invoices, chatSessions] = await Promise.all([
    db.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.invoice.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
      // Exclude fileData from export — it's the base64-encoded original file and
      // can be megabytes per invoice. The user already has the original file;
      // GDPR data portability covers the extracted/derived data, not the file binary.
      select: {
        id: true,
        userId: true,
        entityId: true,
        filename: true,
        vendor: true,
        invNumber: true,
        invDate: true,
        dueDate: true,
        amount: true,
        vatAmount: true,
        total: true,
        currency: true,
        status: true,
        isDuplicate: true,
        confidence: true,
        fieldConfidence: true,
        rawExtraction: true,
        lineItems: true,
        errorMessage: true,
        validationResults: true,
        validationStatus: true,
        normalizedVendor: true,
        normalizedInvDate: true,
        normalizedDueDate: true,
        normalizedAmount: true,
        normalizedTotal: true,
        normalizedCurrency: true,
        pdfMetadata: true,
        processingTime: true,
        customFields: true,
        fileType: true,
        fileDataExpiresAt: true,
        approvalStatus: true,
        approvalRuleId: true,
        approvedBy: true,
        approvedAt: true,
        approvalNote: true,
        lifecycleStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.chatSession.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            artifact: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    user,
    invoices,
    chatSessions,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="omniparse-data-export.json"',
    },
  });
}
