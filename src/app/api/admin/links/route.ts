import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/links?key=CRON_SECRET
//   Returns all admin-created links, ordered by category then sortOrder.
//
// POST /api/admin/links?key=CRON_SECRET
//   Body: { name: string, url: string, category: string, icon?: string }
//   Creates a new admin link. Returns the created row.
//
// SECURITY: Protected by CRON_SECRET env var — same as the rest of the
// admin API surface.

export const dynamic = 'force-dynamic';

function checkAuth(req: NextRequest): boolean {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET;
  return !!expectedKey && key === expectedKey;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const links = await db.adminLink.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json({ links });
  } catch (err) {
    console.error('[admin/links GET] Error:', err);
    return NextResponse.json(
      { error: 'Failed to load links', details: String(err) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { name?: string; url?: string; category?: string; icon?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = (body.name || '').trim();
  const url = (body.url || '').trim();
  const category = (body.category || 'General').trim() || 'General';
  const icon = body.icon ? body.icon.trim() : null;

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  // Basic URL validation — accept http(s) URLs and absolute paths (for internal links).
  const isHttp = /^https?:\/\//i.test(url);
  const isInternal = url.startsWith('/');
  if (!isHttp && !isInternal) {
    return NextResponse.json(
      { error: 'URL must start with http://, https://, or /' },
      { status: 400 },
    );
  }

  try {
    // Append to the end of this category's sortOrder so new links appear last.
    const existing = await db.adminLink.findMany({
      where: { category },
      select: { sortOrder: true },
    });
    const nextSortOrder = existing.length
      ? Math.max(...existing.map((l) => l.sortOrder)) + 1
      : 0;

    const link = await db.adminLink.create({
      data: {
        name,
        url,
        category,
        icon,
        sortOrder: nextSortOrder,
      },
    });
    return NextResponse.json({ link }, { status: 201 });
  } catch (err) {
    console.error('[admin/links POST] Error:', err);
    return NextResponse.json(
      { error: 'Failed to create link', details: String(err) },
      { status: 500 },
    );
  }
}
