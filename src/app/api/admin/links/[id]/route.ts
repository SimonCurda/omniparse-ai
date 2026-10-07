import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// DELETE /api/admin/links/[id]?key=CRON_SECRET
//   Removes an admin-created link.
//
// PATCH /api/admin/links/[id]?key=CRON_SECRET
//   Body: partial { name, url, category, icon, sortOrder }
//   Updates an existing link.
//
// SECURITY: Protected by CRON_SECRET env var.

export const dynamic = 'force-dynamic';

function checkAuth(req: NextRequest): boolean {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET;
  return !!expectedKey && key === expectedKey;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  try {
    // deleteMany so a missing row returns count=0 instead of throwing P2025.
    const result = await db.adminLink.deleteMany({ where: { id } });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/links DELETE] Error:', err);
    return NextResponse.json(
      { error: 'Failed to delete link', details: String(err) },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  let body: {
    name?: string;
    url?: string;
    category?: string;
    icon?: string | null;
    sortOrder?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Build a patch object from the supplied fields only — omit unspecified
  // fields so callers can do partial updates.
  const patch: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) {
    patch.name = body.name.trim();
  }
  if (typeof body.url === 'string' && body.url.trim()) {
    const url = body.url.trim();
    const isHttp = /^https?:\/\//i.test(url);
    const isInternal = url.startsWith('/');
    if (!isHttp && !isInternal) {
      return NextResponse.json(
        { error: 'URL must start with http://, https://, or /' },
        { status: 400 },
      );
    }
    patch.url = url;
  }
  if (typeof body.category === 'string' && body.category.trim()) {
    patch.category = body.category.trim();
  }
  if (body.icon !== undefined) {
    patch.icon = body.icon ? String(body.icon).trim() : null;
  }
  if (typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
    patch.sortOrder = body.sortOrder;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const link = await db.adminLink.update({
      where: { id },
      data: patch,
    });
    return NextResponse.json({ link });
  } catch (err) {
    console.error('[admin/links PATCH] Error:', err);
    return NextResponse.json(
      { error: 'Failed to update link', details: String(err) },
      { status: 500 },
    );
  }
}
