import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, verifyPassword } from '@/lib/auth';

export async function DELETE(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.password) {
    return NextResponse.json(
      { error: 'Current password is required to delete your account' },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, password: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 });
  }

  const isValid = await verifyPassword(body.password, user.password);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  try {
    await db.$transaction([
      db.chatSession.deleteMany({ where: { userId: auth.userId } }),
      db.invoice.deleteMany({ where: { userId: auth.userId } }),
      db.user.delete({ where: { id: auth.userId } }),
    ]);

    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Failed to delete account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account. Please try again.' },
      { status: 500 }
    );
  }
}
