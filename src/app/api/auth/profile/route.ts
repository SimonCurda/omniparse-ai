import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

const profileUpdateSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  email: z.string().email('Please enter a valid email address').optional(),
});

export async function PUT(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = profileUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Validation failed';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { name, email } = parsed.data;

  const updateData: Record<string, string> = { name: name.trim() };
  if (email !== undefined) {
    updateData.email = email;
  }

  const updated = await db.user.update({
    where: { id: auth.userId },
    data: updateData,
    select: { id: true, email: true, name: true, plan: true, createdAt: true },
  });

  return NextResponse.json({ user: updated });
}
