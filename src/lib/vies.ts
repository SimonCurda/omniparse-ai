// ─── VIES — EU VAT ID validation ─────────────────────────────────────────────
//
// Validates European Union VAT identification numbers against the EU
// Commission's VIES (VAT Information Exchange System) REST API.
//
// ENDPOINT
// =========
//   POST https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat
//   Content-Type: application/json
//   Body: { "countryCode": "DE", "vatNumber": "123456789" }
//   Response: { "actionSucceed": true, "isValid": true, "name": "...",
//               "address": "...", "requestIdentifier": "..." }
//
// WHY THIS EXISTS
// ================
// When a EU B2B customer gives OmniParse a VAT ID, OmniParse must verify
// the VAT ID is valid BEFORE treating the sale as a reverse-charge supply
// (where the customer accounts for VAT). This is required by:
//   - EU VAT Directive 2006/112/EC Art. 220 (supplier must verify customer
//     status for intra-community supply)
//   - Czech VAT Act § 92 (reverse charge on B2B intra-EU supplies)
//
// VIES API gotchas
// =================
// - VIES is **notorious** for being flaky (peak hours, weekend maintenance).
//   We wrap with a 12s timeout + graceful degradation: if VIES is down,
//   return { valid: null, error: "VIES unavailable" } so the UI can show
//   "couldn't verify — try again later" instead of falsely invalidating.
// - Each VIES response includes a `requestIdentifier` — proof that we
//   checked. We return it so the user can keep it for their OSS/VAT
//   audit trail.
// - VIES supports a per-member-state pattern for VAT IDs (e.g. Czech
//   "CZ12345678", German "DE123456789"). We do the formatting: caller
//   passes "CZ12345678" or "12345678" + "CZ" — we split + sanitize.
// - Member states requirevat IDs to be uppercase, no spaces, no
//   separators. We sanitize before submitting.

const VIES_REST_ENDPOINT = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat';
const VIES_TIMEOUT_MS = 12_000;

export interface ViesValidationResult {
  /** Was the call successful? false = VIES error / timeout. */
  actionSucceed: boolean;
  /** True if VAT ID is valid + registered. False if invalid. null if couldn't check. */
  isValid: boolean | null;
  /** Registered company name (when valid). */
  name?: string;
  /** Registered company address (when valid). */
  address?: string;
  /** VIES request ID — keep for your audit trail (10 years per EU law). */
  requestIdentifier?: string;
  /** Sanitized VAT ID with country code (e.g. "CZ12345678"). */
  vatId?: string;
  /** Error message if actionSucceed is false. */
  error?: string;
  /** When we checked (UTC ISO). */
  checkedAt: string;
}

/**
 * Validate an EU VAT ID via VIES.
 *
 * @param rawVatId  Full VAT ID with country code (e.g. "CZ12345678"),
 *                  or just the number ("12345678") if country is passed separately.
 * @param countryCode  Optional ISO-2 country code ("CZ", "DE", "FR", ...).
 *                     If not passed, parsed from the first 2 chars of rawVatId.
 */
export async function validateVatId(
  rawVatId: string,
  countryCode?: string,
): Promise<ViesValidationResult> {
  // Sanitize input — uppercase, strip spaces/dashes/dots
  const sanitized = rawVatId.toUpperCase().replace(/[\s\-.]/g, '');

  // Extract country code + vat number
  let cc = countryCode?.toUpperCase();
  let number = sanitized;
  if (!cc) {
    if (sanitized.length >= 3 && /^[A-Z]{2}/.test(sanitized)) {
      cc = sanitized.slice(0, 2);
      number = sanitized.slice(2);
    } else {
      return {
        actionSucceed: false,
        isValid: null,
        error: 'Country code is required (either as the first 2 chars of vatId, or via the countryCode param).',
        checkedAt: new Date().toISOString(),
      };
    }
  } else {
    // If country code was passed separately, strip it from the sanitized
    // vat ID if it was duplicated there
    if (sanitized.startsWith(cc)) number = sanitized.slice(cc.length);
  }

  // Validate country code is a EU member state
  const EU_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','EL','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
  if (!EU_COUNTRIES.includes(cc)) {
    return {
      actionSucceed: false,
      isValid: null,
      error: `${cc} is not an EU member state. VIES only validates EU VAT IDs.`,
      checkedAt: new Date().toISOString(),
    };
  }

  // VIES requires the VAT number without the country prefix
  if (!number || number.length < 5) {
    return {
      actionSucceed: false,
      isValid: null,
      error: 'VAT number is too short (must be at least 5 chars after the country code).',
      checkedAt: new Date().toISOString(),
    };
  }

  // Call VIES REST API
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VIES_TIMEOUT_MS);

  try {
    const res = await fetch(VIES_REST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: cc, vatNumber: number }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // VIES returns 400 with an error body for invalid VAT format / country
      let errorMsg = `VIES returned HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        if (errBody?.message) errorMsg += `: ${errBody.message}`;
        else if (errBody?.fault) errorMsg += `: ${errBody.fault}`;
      } catch {
        // Response wasn't JSON — keep generic error
      }
      return {
        actionSucceed: false,
        isValid: null,
        error: errorMsg,
        checkedAt: new Date().toISOString(),
      };
    }

    const data = await res.json();
    return {
      actionSucceed: data.actionSucceed === true,
      isValid: data.isValid === true,
      name: typeof data.name === 'string' ? data.name : undefined,
      address: typeof data.address === 'string' ? data.address : undefined,
      requestIdentifier: typeof data.requestIdentifier === 'string' ? data.requestIdentifier : undefined,
      vatId: `${cc}${number}`,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      actionSucceed: false,
      isValid: null,
      error: isTimeout
        ? 'VIES did not respond within 12 seconds. The service may be temporarily unavailable — try again later.'
        : (err instanceof Error ? err.message : 'VIES request failed.'),
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
