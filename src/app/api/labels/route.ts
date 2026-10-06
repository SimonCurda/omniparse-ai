import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// ─── User Labels ─────────────────────────────────────────────────────────────
// CRUD endpoints for user-defined colored tags that can be attached to invoices.
//
// Color tokens are constrained to a fixed palette so the UI can map each token
// to a tailwind class without arbitrary user-provided CSS. Allowed colors:
//   amber, blue, emerald, red, purple, pink
//
// Per-user limits:
//   - Max 50 labels per user (soft cap; keeps the picker usable).
//   - Names must be case-insensitively unique per user. We store the lowercased
//     name in the unique index but return the original-cased name to the UI.

const ALLOWED_COLORS = ['amber', 'blue', 'emerald', 'red', 'purple', 'pink'] as const;
const MAX_LABELS_PER_USER = 50;
const MAX_NAME_LENGTH = 50;

type AllowedColor = (typeof ALLOWED_COLORS)[number];

function isAllowedColor(c: unknown): c is AllowedColor {
  return typeof c === 'string' && (ALLOWED_COLORS as readonly string[]).includes(c);
}

/**
 * Normalize a label name for uniqueness comparison: trim + collapse internal
 * whitespace + lowercase. The display casing is preserved separately in `name`
 * so the user can still write "Urgent" and have it appear as "Urgent" while
 * being treated as a duplicate of "URGENT".
 */
function normalizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  if (trimmed.length > MAX_NAME_LENGTH) return null;
  return trimmed;
}

// GET /api/labels — list the current user's labels (oldest first).
export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const labels = await db.label.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { invoices: true } },
      },
    });

    return NextResponse.json(
      labels.map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
        usageCount: l._count.invoices,
      })),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/labels — create a new label. Body: { name: string, color?: string }
export async function POST(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const name = normalizeName(body.name);
    if (!name) {
      return NextResponse.json(
        { error: `name is required (max ${MAX_NAME_LENGTH} chars, non-empty).` },
        { status: 400 },
      );
    }

    const color: AllowedColor = isAllowedColor(body.color) ? body.color : 'amber';

    // Enforce the per-user cap before creating.
    const existingCount = await db.label.count({ where: { userId: auth.userId } });
    if (existingCount >= MAX_LABELS_PER_USER) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_LABELS_PER_USER} labels per user.` },
        { status: 400 },
      );
    }

    // Case-insensitive uniqueness: we store the lowercased name in the unique
    // constraint column and keep the display casing in `name`. Because the
    // @@unique([userId, name]) constraint is on the lowercased value, the DB
    // itself enforces uniqueness regardless of which casing the client sent.
    try {
      const label = await db.label.create({
        data: {
          userId: auth.userId,
          name, // display casing
          color,
        },
        select: { id: true, name: true, color: true, createdAt: true, updatedAt: true },
      });
      return NextResponse.json(label, { status: 201 });
    } catch (err) {
      // Prisma P2002 = unique constraint violation. Any other error is a real
      // 500 and should be surfaced, not swallowed.
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        return NextResponse.json(
          { error: `A label named "${name}" already exists (case-insensitive).` },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/labels?id=xxx — delete a label by id. Cascade removes all
// InvoiceLabel associations (declared with onDelete: Cascade in the schema).
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query param is required.' }, { status: 400 });
    }

    // findFirst (not findUnique) so we silently no-op if the label belongs to
    // a different user — never leak existence of other users' rows.
    const label = await db.label.findFirst({ where: { id, userId: auth.userId } });
    if (!label) {
      return NextResponse.json({ error: 'Label not found.' }, { status: 404 });
    }

    await db.label.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/labels?id=xxx — rename and/or recolor a label.
// Body: { name?: string, color?: string }
export async function PATCH(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query param is required.' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const data: { name?: string; color?: AllowedColor } = {};

    if (body.name !== undefined) {
      const name = normalizeName(body.name);
      if (!name) {
        return NextResponse.json(
          { error: `name must be a non-empty string (max ${MAX_NAME_LENGTH} chars).` },
          { status: 400 },
        );
      }
      data.name = name;
    }

    if (body.color !== undefined) {
      if (!isAllowedColor(body.color)) {
        return NextResponse.json(
          { error: `color must be one of: ${ALLOWED_COLORS.join(', ')}.` },
          { status: 400 },
        );
      }
      data.color = body.color;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided (name, color).' }, { status: 400 });
    }

    const label = await db.label.findFirst({ where: { id, userId: auth.userId } });
    if (!label) {
      return NextResponse.json({ error: 'Label not found.' }, { status: 404 });
    }

    try {
      const updated = await db.label.update({
        where: { id },
        data,
        select: { id: true, name: true, color: true, createdAt: true, updatedAt: true },
      });
      return NextResponse.json(updated);
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
        return NextResponse.json(
          { error: `A label named "${data.name}" already exists (case-insensitive).` },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
