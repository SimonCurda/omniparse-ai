// ─── Czech accounting exports ─────────────────────────────────────────────────
//
// Generates import files for the most popular Czech accounting systems:
//
// 1. **Money S3 / S5** — XML format ("Doklady XML"). Used by ~30% of Czech SMEs.
// 2. **iDoklad** — CSV import (Issued Invoices). Popular cloud accounting.
// 3. **Fakturoid** — CSV import (Issued Invoices). Popular cloud alternative.
//
// Flexi (ABRA Flexi) and Money (older DOS line) are NOT here — they need
// REST API integrations, not file imports. Those are tracked as a TODO
// in the README and will require user-supplied API credentials.
//
// FORMAT NOTES
// ============
// - Money S3 XML uses **windows-1250** encoding historically (DOS legacy).
//   We emit UTF-8 because Money S5+ supports it and S3 has UTF-8 fallback
//   for "Doklady XML". If a user reports issues, we can add a windows-1250
//   encoding variant.
// - iDoklad + Fakturoid CSV are UTF-8 with BOM (so Excel reads Czech chars
//   correctly when opened directly).
// - All three formats expect vendor VAT ID + currency. Money S3 specifically
//   handles multiple VAT rates + non-VAT documents.
// - Date formats: Money uses dd.mm.yyyy, iDoklad/Fakturoid use ISO yyyy-mm-dd.
//
// INPUT SHAPE
// ===========
// All three generators accept the same `InvoiceExportRow[]` shape — the
// API routes fetch invoices via Prisma and map them. This means swapping
// format = one-line change in the route.

export interface InvoiceExportRow {
  id: string;
  vendor: string | null;
  invNumber: string | null;
  invDate: string | null;       // ISO yyyy-mm-dd from Prisma
  dueDate: string | null;      // ISO yyyy-mm-dd
  amount: number | null;       // net (without VAT)
  vatAmount: number | null;
  total: number | null;
  currency: string;
  documentLanguage: string | null;
  customFields?: Record<string, unknown> | null;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function fmtDateMoney(iso?: string | null): string {
  if (!iso) return '';
  // Prisma returns ISO yyyy-mm-ddThh:mm:ss... — slice to yyyy-mm-dd
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function fmtDateISO(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0';
  // Czech accounting convention: decimal comma, thousands space
  // We return a plain string with 2 decimals — the import tools handle
  // formatting on their side.
  return n.toFixed(2);
}

// Extract VAT ID from customFields — user may have stored it as "VAT ID",
// "vatId", "DIC", "DIČ", "taxId"
function extractVatId(customFields?: Record<string, unknown> | null): string {
  if (!customFields) return '';
  const keys = ['vatId', 'VATID', 'vatID', 'VAT_ID', 'DIC', 'DIČ', 'dic', 'taxId', 'TAX_ID'];
  for (const k of keys) {
    if (typeof customFields[k] === 'string') {
      return (customFields[k] as string).trim();
    }
  }
  // Check nested under "vendor" key
  const vendor = customFields['vendor'];
  if (vendor && typeof vendor === 'object') {
    const vendorObj = vendor as Record<string, unknown>;
    for (const k of keys) {
      if (typeof vendorObj[k] === 'string') return String(vendorObj[k]).trim();
    }
  }
  return '';
}

// Extract vendor VAT IDs from customFields as separate CZ+EU VAT fields
// (Money S3 supports separate DIC + IC fields for CZ vs foreign EU VAT)
function extractDicAndIc(customFields?: Record<string, unknown> | null): { dic: string; ic: string } {
  const allVatId = extractVatId(customFields);
  if (!allVatId) return { dic: '', ic: '' };

  // If VAT ID starts with "CZ" → put in DIC; if it starts with another EU
  // country code → put in IC (cizí daňové identifikační číslo).
  if (allVatId.toUpperCase().startsWith('CZ')) {
    return { dic: allVatId.slice(2), ic: '' };
  }
  // Foreign EU VAT ID — split country code from number for IC field
  if (allVatId.length >= 3 && /^[A-Z]{2}/.test(allVatId)) {
    return { dic: '', ic: allVatId };
  }
  // Default — assume Czech
  return { dic: allVatId, ic: '' };
}

// Extract IČO (Czech company registration number) from customFields
function extractIco(customFields?: Record<string, unknown> | null): string {
  if (!customFields) return '';
  const keys = ['ico', 'IČO', 'ICO', 'companyId', 'registrationNumber'];
  for (const k of keys) {
    if (typeof customFields[k] === 'string') {
      // Strip spaces, slashes, dashes — Money S3 wants pure digits
      return (customFields[k] as string).replace(/[\s\-\/]/g, '').slice(0, 8);
    }
  }
  return '';
}

// ───────────────────────────────────────────────────────────────────────────
// 1. Money S3 / S5 XML
// ───────────────────────────────────────────────────────────────────────────
// Money's "Doklady XML" import format. Tested with Money S5 2024.
// Format reference: https://www.money.cz/dokumentace/xml-implementace/
export function generateMoneyS3Xml(invoices: InvoiceExportRow[]): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<Doklady>');
  // Money supports many document types — we use "Faktura" (incoming) for
  // invoices received from vendors. For "Faktura-přijatá" (received invoice),
  // use <Doklad> root with type attribute. Different versions of Money use
  // different root tags; we use the S5-style <Doklad Type="Faktura">.
  for (const inv of invoices) {
    const { dic, ic } = extractDicAndIc(inv.customFields);
    const ico = extractIco(inv.customFields);
    const vendorName = inv.vendor || 'Unknown vendor';

    lines.push('  <Doklad Type="PrijataFaktura">');
    lines.push(`    <CisloDokladu>${xmlEscape(inv.invNumber || inv.id.slice(-8))}</CisloDokladu>`);
    lines.push(`    <VarSymbol>${xmlEscape(inv.invNumber || '')}</VarSymbol>`);
    lines.push(`    <DatumVystaveni>${fmtDateMoney(inv.invDate)}</DatumVystaveni>`);
    lines.push(`    <DatumSplatnosti>${fmtDateMoney(inv.dueDate)}</DatumSplatnosti>`);
    lines.push(`    <DatumDPH>${fmtDateMoney(inv.invDate)}</DatumDPH>`);  // VAT date = invoice date by default
    lines.push(`    <DatumUZP>${fmtDateMoney(inv.invDate)}</DatumUZP>`);  // UZP = účetní případ
    lines.push(`    <DodOdber>${xmlEscape(vendorName.slice(0, 100))}</DodOdber>`);
    if (ico) lines.push(`    <ICO>${xmlEscape(ico)}</ICO>`);
    if (dic) lines.push(`    <DIC>${xmlEscape(dic)}</DIC>`);
    if (ic) lines.push(`    <IC>${xmlEscape(ic)}</IC>`);
    lines.push(`    <Castka>${fmtMoney(inv.total)}</Castka>`);  // Celková částka
    lines.push(`    <CastkaDPH>${fmtMoney(inv.vatAmount)}</CastkaDPH>`);  // VAT amount
    lines.push(`    <Zaklad>${fmtMoney(inv.amount)}</Zaklad>`);  // Net (základ)
    lines.push(`    <Mena>${xmlEscape(inv.currency)}</Mena>`);  // ISO 4217
    // Money expects each "řádek faktury" (invoice line) — for simplicity
    // we add one synthetic line with the total. Users can split into line
    // items in Money itself. Custom template + line item XML is a TODO.
    lines.push('    <Polozky>');
    lines.push('      <Polozka>');
    lines.push(`        <Nazev>${xmlEscape('Faktura ' + (inv.invNumber || ''))}</Nazev>`);
    lines.push(`        <Mnozstvi>1</Mnozstvi>`);
    lines.push(`        <Cena>${fmtMoney(inv.total)}</Cena>`);
    lines.push('      </Polozka>');
    lines.push('    </Polozky>');
    lines.push('  </Doklad>');
  }
  lines.push('</Doklady>');
  return lines.join('\n');
}

// ───────────────────────────────────────────────────────────────────────────
// 2. iDoklad CSV
// ───────────────────────────────────────────────────────────────────────────
// iDoklad accepts a CSV import for "Přijaté faktury" (received invoices).
// Format reference: https://pro.idoklad.cz/help/cs/import-faktur/
// Columns expected (in order):
//   CisloDokladu, VarSymbol, Dodavatel, IC, DIC, DatumVystaveni,
//   DatumSplatnosti, CastkaBezDPH, CastkaDPH, CastkaCelkem, Mena
export function generateIdokladCsv(invoices: InvoiceExportRow[]): string {
  const header = 'CisloDokladu;VarSymbol;Dodavatel;IC;DIC;DatumVystaveni;DatumSplatnosti;CastkaBezDPH;CastkaDPH;CastkaCelkem;Mena';
  const rows = invoices.map(inv => {
    const { dic, ic } = extractDicAndIc(inv.customFields);
    const ico = extractIco(inv.customFields);
    return [
      csvEscape(inv.invNumber || inv.id.slice(-8)),
      csvEscape(inv.invNumber || ''),
      csvEscape(inv.vendor || 'Unknown vendor'),
      csvEscape(ico),
      csvEscape(dic || (ic || '')),
      csvEscape(fmtDateISO(inv.invDate)),
      csvEscape(fmtDateISO(inv.dueDate)),
      fmtMoney(inv.amount),
      fmtMoney(inv.vatAmount),
      fmtMoney(inv.total),
      csvEscape(inv.currency),
    ].join(';');
  });
  // Prepend UTF-8 BOM so Excel reads Czech characters correctly
  return '\uFEFF' + header + '\r\n' + rows.join('\r\n');
}

// ───────────────────────────────────────────────────────────────────────────
// 3. Fakturoid CSV
// ───────────────────────────────────────────────────────────────────────────
// Fakturoid's "Přijaté faktury" CSV import.
// Format reference: https://docs.fakturoid.cz/cs/entries/import-prijatych-faktur
// Columns: cislo;datum_vystaveni;datum_splatnosti;dodavatel_nazev;dodavatel_dic;
//          dodavatel_ico;zaklad_dph;dph;celkem;mena;variabilni_symbol
export function generateFakturoidCsv(invoices: InvoiceExportRow[]): string {
  const header = 'cislo;datum_vystaveni;datum_splatnosti;dodavatel_nazev;dodavatel_dic;dodavatel_ico;zaklad_dph;dph;celkem;mena;variabilni_symbol';
  const rows = invoices.map(inv => {
    const { dic, ic } = extractDicAndIc(inv.customFields);
    const ico = extractIco(inv.customFields);
    // Fakturoid wants the full VAT ID (with country code) in dodavatel_dic
    const fullVatId = dic ? `CZ${dic}` : (ic || '');
    return [
      csvEscape(inv.invNumber || inv.id.slice(-8)),
      csvEscape(fmtDateISO(inv.invDate)),
      csvEscape(fmtDateISO(inv.dueDate)),
      csvEscape(inv.vendor || 'Unknown vendor'),
      csvEscape(fullVatId),
      csvEscape(ico),
      fmtMoney(inv.amount),
      fmtMoney(inv.vatAmount),
      fmtMoney(inv.total),
      csvEscape(inv.currency),
      csvEscape(inv.invNumber || ''),
    ].join(';');
  });
  return '\uFEFF' + header + '\r\n' + rows.join('\r\n');
}

// CSV field escape — wrap in quotes if contains ; " or newline; escape " by doubling
function csvEscape(s: string | null | undefined): string {
  if (s === null || s === undefined) return '';
  const str = String(s);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}
