import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

/**
 * GET /api/admin/providers
 * Returns all AI provider toggle configs.
 * Also returns the env-var-based status (key configured or not).
 */
export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.user.findUnique({ where: { id: auth.userId }, select: { email: true } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Fetch all provider configs from DB
  const configs = await db.aiProviderConfig.findMany();
  const configMap = new Map(configs.map((c) => [c.provider, c.enabled]));

  // Build response with both DB toggle state and env-var key presence
  const providers = [
    {
      provider: 'mistral',
      label: 'Mistral AI',
      role: 'Primary AI — Vision + Text',
      location: 'Paris, France (EU)',
      dbEnabled: configMap.get('mistral') ?? true,
      apiKeySet: !!(process.env.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY_2 || process.env.MISTRAL_API_KEY_3),
      envVar: 'MISTRAL_API_KEY',
      notes: 'EU-based — no SCC required. Training opt-out available via separate toggle.',
      color: 'emerald',
    },
    {
      provider: 'groq',
      label: 'Groq Inc.',
      role: 'Secondary AI — Vision + Text',
      location: 'United States',
      dbEnabled: configMap.get('groq') ?? true,
      apiKeySet: !!process.env.GROQ_API_KEY,
      envVar: 'GROQ_API_KEY',
      notes: 'SCCs confirmed. Optional — can be disabled for EU-only mode.',
      color: 'emerald',
    },
    {
      provider: 'openrouter',
      label: 'OpenRouter',
      role: 'Fallback AI',
      location: 'United States',
      dbEnabled: configMap.get('openrouter') ?? false,
      apiKeySet: !!(process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY_2),
      envVar: 'OPENROUTER_API_KEY',
      notes: 'Free-tier models permit training. Enable only after DPA/SCC review.',
      color: 'amber',
    },
    {
      provider: 'google_gemini',
      label: 'Google Gemini',
      role: 'Fallback AI',
      location: 'United States',
      dbEnabled: configMap.get('google_gemini') ?? false,
      apiKeySet: !!(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY_3),
      envVar: 'GEMINI_API_KEY',
      notes: 'AI Studio free-tier. Cloud DPA does NOT apply. Enable after reviewing AI Studio terms.',
      color: 'amber',
    },
    {
      provider: 'mistral_training_optout',
      label: 'Mistral Training Opt-Out',
      role: 'Sends usage_options={"enable_training": false} on every Mistral call',
      location: '—',
      dbEnabled: configMap.get('mistral_training_optout') ?? false,
      apiKeySet: true,
      envVar: 'MISTRAL_DISABLE_TRAINING',
      notes: 'When enabled, every Mistral API request includes the training opt-out parameter. Effective on paid Mistral tier.',
      color: 'blue',
    },
  ];

  // A provider is "effectively enabled" if: DB toggle is on AND API key is set
  // (except for mistral_training_optout which doesn't need an API key)
  const result = providers.map((p) => ({
    ...p,
    effectivelyEnabled: p.provider === 'mistral_training_optout' ? p.dbEnabled : (p.dbEnabled && p.apiKeySet),
    canToggle: p.apiKeySet || p.provider === 'mistral_training_optout',
  }));

  return NextResponse.json({ providers: result });
}

/**
 * PUT /api/admin/providers
 * Toggle a provider on/off.
 * Body: { provider: "openrouter", enabled: true }
 */
export async function PUT(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.user.findUnique({ where: { id: auth.userId }, select: { email: true } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const body = await req.json();
  const { provider, enabled } = body;

  if (!provider || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'provider (string) and enabled (boolean) are required' }, { status: 400 });
  }

  const validProviders = ['mistral', 'groq', 'openrouter', 'google_gemini', 'mistral_training_optout'];
  if (!validProviders.includes(provider)) {
    return NextResponse.json({ error: `Invalid provider. Valid: ${validProviders.join(', ')}` }, { status: 400 });
  }

  // Upsert the config
  const config = await db.aiProviderConfig.upsert({
    where: { provider },
    update: { enabled, updatedBy: user.email || 'admin' },
    create: { provider, enabled, updatedBy: user.email || 'admin' },
  });

  console.warn(`[admin/providers] ${user.email} set ${provider} = ${enabled}`);

  return NextResponse.json({
    provider: config.provider,
    enabled: config.enabled,
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
  });
}
