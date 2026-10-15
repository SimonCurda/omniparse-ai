import { db } from '@/lib/db';

// ─── Webhook Integration ─────────────────────────────────────────────────
// Sends outgoing POST requests to user-configured webhook URLs when
// invoices are parsed, approved, or exported. Used with Zapier, Make.com,
// or any service that accepts incoming webhooks.
//
// The webhook URL is stored in the user's settings JSON column
// (user.settings.webhookUrl). No DB migration needed.
//
// Events fired:
//   - invoice.parsed    (after successful AI extraction)
//   - invoice.approved  (after manual approve/reject)
//   - invoice.exported  (after export)
//
// Payload format:
//   {
//     event: "invoice.parsed",
//     timestamp: "2026-10-15T12:00:00.000Z",
//     data: {
//       invoiceId: "ck...",
//       vendor: "Acme Corp",
//       total: 1210.00,
//       currency: "EUR",
//       status: "done",
//       approvalStatus: "auto_approved",
//       lifecycleStatus: "approved",
//       confidence: 0.95,
//       filename: "invoice.pdf"
//     }
//   }

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface WebhookSettings {
  webhookUrl?: string | null;
  webhookEvents?: string[] | null; // which events to fire on
}

const DEFAULT_EVENTS = ['invoice.parsed', 'invoice.approved', 'invoice.exported'];

/**
 * Get the user's webhook configuration from their settings JSON.
 */
async function getWebhookConfig(userId: string): Promise<{ url: string | null; events: string[] }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  });
  if (!user) return { url: null, events: DEFAULT_EVENTS };

  const settings = (user.settings as WebhookSettings | null) ?? {};
  return {
    url: settings.webhookUrl || null,
    events: settings.webhookEvents || DEFAULT_EVENTS,
  };
}

/**
 * Fire a webhook event if the user has configured a webhook URL and
 * subscribed to the event. Non-blocking — errors are logged but don't
 * affect the main operation.
 */
export async function fireWebhook(
  userId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const config = await getWebhookConfig(userId);
    if (!config.url) return;
    if (!config.events.includes(event)) return;

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    // Fire and forget — don't block the main operation
    fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    }).catch((err) => {
      console.warn(`[webhook] Failed to deliver ${event} to ${config.url}:`, err.message);
    });
  } catch (err) {
    console.warn(`[webhook] Error firing ${event}:`, err);
  }
}
