export async function sendAlertEmail(subject: string, body: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!apiKey || !adminEmail) {
    console.warn('[email] RESEND_API_KEY or ADMIN_EMAIL not set — skipping');
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'OmniParse Alerts <alerts@omniparse-ai.vercel.app>',
        to: adminEmail,
        subject: `[OmniParse] ${subject}`,
        text: body,
      }),
    });
    if (!res.ok) console.warn('[email] Resend error:', res.status);
  } catch (err) {
    console.warn('[email] Failed:', err instanceof Error ? err.message : String(err));
  }
}
