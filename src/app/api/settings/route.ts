import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { DEFAULT_SETTINGS, type UserSettings } from '@/lib/invoice-engine';

// GET /api/settings — Load user settings
export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { settings: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const settings = (user.settings as unknown as UserSettings) || DEFAULT_SETTINGS;
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

// PUT /api/settings — Update user settings
export async function PUT(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate and merge with defaults
    const current = await db.user.findUnique({
      where: { id: auth.userId },
      select: { settings: true },
    });

    const currentSettings: UserSettings = (current?.settings as unknown as UserSettings) || DEFAULT_SETTINGS;
    const updatedSettings: UserSettings = {
      validationRules: {
        ...DEFAULT_SETTINGS.validationRules,
        ...currentSettings.validationRules,
        ...(body.validationRules || {}),
      },
      varianceThresholds: {
        ...DEFAULT_SETTINGS.varianceThresholds,
        ...currentSettings.varianceThresholds,
        ...(body.varianceThresholds || {}),
      },
      customFields: Array.isArray(body.customFields)
        ? body.customFields
        : currentSettings.customFields || [],
    };

    await db.user.update({
      where: { id: auth.userId },
      data: { settings: JSON.parse(JSON.stringify(updatedSettings)) },
    });

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
