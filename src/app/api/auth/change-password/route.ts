import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, verifyPassword, hashPassword } from '@/lib/auth';
import { changePasswordSchema } from '@/lib/validation';

export async function POST(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, password: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 });
  }

  // OAuth-only users (password == null) have no password to change.
  // They sign in via Google / GitHub and manage credentials through the
  // provider, not us.
  if (user.password === null) {
    return NextResponse.json(
      { error: 'Password change is not available for OAuth accounts.' },
      { status: 400 }
    );
  }

  const isValid = await verifyPassword(currentPassword, user.password);
  if (!isValid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  const hashed = await hashPassword(newPassword);

  await db.user.update({
    where: { id: auth.userId },
    data: { password: hashed },
  });

  return NextResponse.json({ message: 'Password updated successfully' });
}
