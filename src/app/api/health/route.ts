import { NextResponse } from 'next/server';

export async function GET() {
  const checks: Record<string, string | boolean | string[]> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };

  // Critical env var checks (don't expose values, just presence)
  const groqKey = process.env.GROQ_API_KEY;
  checks.groq_configured = !!groqKey;

  const dbUrl = process.env.DATABASE_URL;
  checks.database_configured = !!dbUrl;
  checks.database_is_postgres = dbUrl?.startsWith('postgres') ?? false;

  const jwtSecret = process.env.JWT_SECRET;
  checks.jwt_custom_secret = !!jwtSecret;

  // If any critical var is missing, report degraded
  const critical = [groqKey, dbUrl];
  const allCritical = critical.every(Boolean);
  if (!allCritical) {
    checks.status = 'degraded';
    checks.issues = [];
    if (!groqKey) checks.issues.push('GROQ_API_KEY not set — invoice processing will fail');
    if (!dbUrl) checks.issues.push('DATABASE_URL not set — all data operations will fail');
  }

  return NextResponse.json(checks, { status: allCritical ? 200 : 503 });
}
