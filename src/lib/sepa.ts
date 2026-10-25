// ─── SEPA XML generator (ISO 20022 pain.001.001.09) ───────────────────────────
//
// Generates a SEPA Credit Transfer Initiation (Customer-to-Bank) XML file
// in the pain.001.001.09 schema. The output can be imported into any EU
// bank's internet banking — the bank converts it into a batch of SEPA
// credit transfers.
//
// SCHEMA + SPEC
// ==============
// - ISO 20022 message: head.001.001.03 / pain.001.001.09
// - SWIFT UMR pattern: /STRUCT/SCHEMA/PAIN.001.001.09
// - EPC SEPA Credit Transfer Rulebook v4.1 (in force as of Nov 2024)
// - Czech National Bank's XML payment format for ABO is different — this
//   file generates pain.001.001.09, which is what Fio/KB/Raiffeisen/
//   Ceska Sporitelna/Revolut Business/Monese all accept for SEPA.
//
// USAGE
// ======
// import { generateSepaXml } from '@/lib/sepa';
// const xml = generateSepaXml({
//   messageId: 'MSG-2024-001',
//   paymentId: 'PMT-BATCH-001',
//   executionDate: new Date(),
//   initiatingParty: {
//     name: 'Acme s.r.o.',
//     iban: 'CZ6508000000192000145399',
//     bic: 'GIBACZPX',
//   },
//   payments: [
//     { endToEndId: 'INV-001', creditorName: 'Vendor A', creditorIban: 'DE89370400440532013000', creditorBic: 'COBADEFFXXX', amount: 1000.00, currency: 'EUR', remittanceInfo: 'Invoice INV-001' },
//   ],
// });
//
// NOTES
// ======
// - SEPA requires SINGLE CURRENCY per batch. The generator groups payments
//   by currency and emits one PmtInf block per currency. (We only emit EUR
//   by default; non-EUR payments are rejected with a clear error.)
// - End-to-end ID must be unique within the batch + max 35 chars (ASCII).
// - Creditor name max 70 chars.
// - Remittance info max 140 chars.
// - The MsgId + CreDtTm combination must be unique over 90 days (otherwise
//   the bank may reject as a duplicate). Caller must generate unique IDs.

export interface SepaPayment {
  /** Unique ID for this payment within the batch (max 35 ASCII chars). */
  endToEndId: string;
  /** Creditor (payee) name — max 70 chars. */
  creditorName: string;
  /** Creditor IBAN — must be valid format, will be checked. */
  creditorIban: string;
  /** Creditor BIC/SWIFT code — required for non-EEA IBANs, optional for EEA. */
  creditorBic?: string;
  /** Payment amount in the specified currency. */
  amount: number;
  /** Currency — ISO 4217 code (only EUR is supported for SEPA). */
  currency: string;
  /** Unstructured remittance info (max 140 chars) — usually the invoice number. */
  remittanceInfo?: string;
}

interface SepaInitiatingParty {
  name: string;
  iban: string;
  bic?: string;
  /** Account holder name (defaults to `name` if not provided) — required by some banks. */
  accountHolderName?: string;
}

interface GenerateSepaOptions {
  messageId: string;
  paymentId: string;
  executionDate: Date;
  initiatingParty: SepaInitiatingParty;
  payments: SepaPayment[];
}

// Basic IBAN format check — not a full checksum verification (would need
// a separate library), but covers the most common validation issues.
function isValidIbanFormat(iban: string): boolean {
  const cleaned = iban.replace(/\s+/g, '').toUpperCase();
  if (cleaned.length < 15 || cleaned.length > 34) return false;
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(cleaned)) return false;
  return true;
}

// XML escape — critical to prevent breaking the XML when remittance info
// or vendor names contain & < > " '
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Truncate to max length + ASCII-only (SEPA doesn't allow non-ASCII chars
// in structured fields like EndToEndId)
function truncateAscii(s: string, max: number): string {
  return s.replace(/[^\x20-\x7E]/g, '').slice(0, max);
}

// Truncate to max length but allow Latin-1 supplement (European accented chars)
function truncateLatin1(s: string, max: number): string {
  // SEPA technically allows ISO20022 charset (Latin + some other chars).
  // Most banks accept UTF-8 these days. We allow all chars + truncate.
  return s.slice(0, max);
}

/**
 * Generate SEPA Credit Transfer XML (pain.001.001.09).
 *
 * Throws on invalid input (IBAN format, currency mismatch, etc.).
 * Returns the XML as a string.
 */
export function generateSepaXml(opts: GenerateSepaOptions): string {
  const { messageId, paymentId, executionDate, initiatingParty, payments } = opts;

  // Validate inputs
  if (!messageId || messageId.length > 35) {
    throw new Error('messageId must be 1-35 chars');
  }
  if (!paymentId || paymentId.length > 35) {
    throw new Error('paymentId must be 1-35 chars');
  }
  if (!initiatingParty?.iban || !isValidIbanFormat(initiatingParty.iban)) {
    throw new Error('Invalid initiating party IBAN');
  }
  if (!initiatingParty?.name) {
    throw new Error('Initiating party name is required');
  }
  if (!payments || payments.length === 0) {
    throw new Error('No payments provided');
  }

  // Validate each payment + group by currency
  const byCurrency = new Map<string, SepaPayment[]>();
  for (const p of payments) {
    if (!p.endToEndId) throw new Error('Each payment requires an endToEndId');
    if (!p.creditorName) throw new Error(`Payment ${p.endToEndId}: creditorName required`);
    if (!p.creditorIban || !isValidIbanFormat(p.creditorIban)) {
      throw new Error(`Payment ${p.endToEndId}: invalid creditor IBAN`);
    }
    if (typeof p.amount !== 'number' || p.amount <= 0) {
      throw new Error(`Payment ${p.endToEndId}: amount must be a positive number`);
    }
    if (p.currency !== 'EUR') {
      throw new Error(`Payment ${p.endToEndId}: SEPA requires EUR currency (got ${p.currency}). For non-EUR payments, use a different export format.`);
    }
    if (!byCurrency.has(p.currency)) byCurrency.set(p.currency, []);
    byCurrency.get(p.currency)!.push(p);
  }

  // Compute total per currency
  const totalPerCurrency = new Map<string, number>();
  for (const [cur, ps] of byCurrency) {
    totalPerCurrency.set(cur, ps.reduce((s, p) => s + p.amount, 0));
  }

  // SEPA control sum: total of all payments across all currencies
  const grandTotal = Array.from(totalPerCurrency.values()).reduce((s, t) => s + t, 0);

  // Format execution date as YYYY-MM-DDThh:mm:ss[Z]
  const creDtTm = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const reqdExctnDt = executionDate.toISOString().slice(0, 10);

  // Build XML — start with header + CstmrCdtTrfInitn root
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
  );
  lines.push('  <CstmrCdtTrfInitn>');
  lines.push('    <GrpHdr>');
  lines.push(`      <MsgId>${xmlEscape(truncateAscii(messageId, 35))}</MsgId>`);
  lines.push(`      <CreDtTm>${creDtTm}</CreDtTm>`);
  lines.push(`      <NbOfTxs>${payments.length}</NbOfTxs>`);
  // CtrlSum = total amount across the whole batch (single currency)
  const ctrlSumCurrency = byCurrency.size === 1 ? Array.from(byCurrency.keys())[0] : 'EUR';
  const ctrlSumAmount = grandTotal.toFixed(2);
  lines.push(`      <CtrlSum>${ctrlSumAmount}</CtrlSum>`);
  lines.push(`      <InitgPty>`);
  lines.push(`        <Nm>${xmlEscape(truncateLatin1(initiatingParty.name, 70))}</Nm>`);
  lines.push(`      </InitgPty>`);
  lines.push(`    </GrpHdr>`);

  // One PmtInf block per currency (SEPA requires single currency per batch)
  for (const [currency, ps] of byCurrency) {
    const total = totalPerCurrency.get(currency)!.toFixed(2);
    lines.push('    <PmtInf>');
    lines.push(`      <PmtInfId>${xmlEscape(truncateAscii(paymentId + '-' + currency, 35))}</PmtInfId>`);
    lines.push(`      <PmtMtd>TRF</PmtMtd>`);
    lines.push(`      <NbOfTxs>${ps.length}</NbOfTxs>`);
    lines.push(`      <CtrlSum>${total}</CtrlSum>`);
    lines.push(`      <PmtTpInf>`);
    lines.push(`        <SvcLvl><Cd>SEPA</Cd></SvcLvl>`);
    lines.push(`      </PmtTpInf>`);
    lines.push(`      <ReqdExctnDt>${reqdExctnDt}</ReqdExctnDt>`);
    lines.push(`      <Dbtr>`);
    lines.push(`        <Nm>${xmlEscape(truncateLatin1(initiatingParty.accountHolderName || initiatingParty.name, 70))}</Nm>`);
    lines.push(`      </Dbtr>`);
    lines.push(`      <DbtrAcct>`);
    lines.push(`        <Id><IBAN>${initiatingParty.iban.replace(/\s+/g, '').toUpperCase()}</IBAN></Id>`);
    lines.push(`      </DbtrAcct>`);
    if (initiatingParty.bic) {
      lines.push(`      <DbtrAgt>`);
      lines.push(`        <FinInstnId><BIC>${initiatingParty.bic.toUpperCase()}</BIC></FinInstnId>`);
      lines.push(`      </DbtrAgt>`);
    }
    lines.push(`      <ChrgBr>SLEV</ChrgBr>`);  // Service Level — Shared (SHAR) is for non-SEPA, SLEV for SEPA

    // CdtTrfTxInf per payment
    for (const p of ps) {
      lines.push('      <CdtTrfTxInf>');
      lines.push('        <PmtId>');
      lines.push(`          <EndToEndId>${xmlEscape(truncateAscii(p.endToEndId, 35))}</EndToEndId>`);
      lines.push('        </PmtId>');
      lines.push('        <Amt>');
      lines.push(`          <InstdAmt Ccy="${currency}">${p.amount.toFixed(2)}</InstdAmt>`);
      lines.push('        </Amt>');
      if (p.creditorBic) {
        lines.push('        <CdtrAgt>');
        lines.push(`          <FinInstnId><BIC>${p.creditorBic.toUpperCase()}</BIC></FinInstnId>`);
        lines.push('        </CdtrAgt>');
      }
      lines.push('        <Cdtr>');
      lines.push(`          <Nm>${xmlEscape(truncateLatin1(p.creditorName, 70))}</Nm>`);
      lines.push('        </Cdtr>');
      lines.push('        <CdtrAcct>');
      lines.push(`          <Id><IBAN>${p.creditorIban.replace(/\s+/g, '').toUpperCase()}</IBAN></Id>`);
      lines.push('        </CdtrAcct>');
      if (p.remittanceInfo) {
        lines.push('        <RmtInf>');
        lines.push(`          <Ustrd>${xmlEscape(truncateLatin1(p.remittanceInfo, 140))}</Ustrd>`);
        lines.push('        </RmtInf>');
      }
      lines.push('      </CdtTrfTxInf>');
    }
    lines.push('    </PmtInf>');
  }
  lines.push('  </CstmrCdtTrfInitn>');
  lines.push('</Document>');

  return lines.join('\n');
}
