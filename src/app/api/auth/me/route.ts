import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, name: true, plan: true, createdAt: true, googleId: true, githubId: true, password: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Don't send the password hash to the client — just indicate whether the user has one
  const hasPassword = user.password !== null;
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      createdAt: user.createdAt,
      hasPassword,
      googleId: !!user.googleId,
      githubId: !!user.githubId,
    },
  });
}
