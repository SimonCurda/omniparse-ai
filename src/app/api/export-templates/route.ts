import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasFeature, PLAN_LIMITS } from '@/lib/auth';

// GET /api/export-templates
export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (!user || !hasFeature(user.plan, 'custom_export_templates')) {
      return NextResponse.json({ error: 'Custom export templates require Plus plan or higher.' }, { status: 403 });
    }

    const templates = await db.exportTemplate.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(templates);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/export-templates
export async function POST(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (!user || !hasFeature(user.plan, 'custom_export_templates')) {
      return NextResponse.json({ error: 'Custom export templates require Plus plan or higher.' }, { status: 403 });
    }

    const body = await req.json();
    const { name, columns, format } = body;

    if (!name || !Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json({ error: 'Name and columns are required.' }, { status: 400 });
    }

    const validFormats = ['csv', 'json', 'excel'];
    const fmt = validFormats.includes(format) ? format : 'csv';

    const template = await db.exportTemplate.create({
      data: { userId: auth.userId, name, columns: JSON.parse(JSON.stringify(columns)), format: fmt },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/export-templates?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { plan: true } });
    if (!user || !hasFeature(user.plan, 'custom_export_templates')) {
      return NextResponse.json({ error: 'Custom export templates require Plus plan or higher.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Template id is required.' }, { status: 400 });

    const template = await db.exportTemplate.findFirst({ where: { id, userId: auth.userId } });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    await db.exportTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
