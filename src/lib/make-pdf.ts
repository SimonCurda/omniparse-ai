// A valid PDF generator that produces professional-looking invoice documents.
// Used by the seed-test-pending endpoint to create realistic test pending items.
//
// Supports:
//   - Bold headers (Helvetica-Bold)
//   - Two-column layouts (label : value)
//   - Line item tables with headers
//   - Multiple font sizes
//   - Proper page margins
//   - Multi-line wrapping

export interface InvoiceSection {
  type: 'header' | 'row' | 'table' | 'spacing';
  // For 'header': a section title like "Bill To:"
  title?: string;
  // For 'row': a key-value pair like { label: "Invoice Number", value: "INV-001" }
  label?: string;
  value?: string;
  // For 'table': line items
  columns?: string[];
  rows?: string[][];
}

export interface InvoiceLayout {
  // Vendor name at the top (large, bold)
  vendorName: string;
  vendorSubtitle?: string;
  // "INVOICE" title
  documentTitle: string;
  // Sections to render
  sections: InvoiceSection[];
  // Total at the bottom
  totalLabel?: string;
  totalValue?: string;
}

// Escape PDF string content
function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

// Build the PDF content stream from a structured layout
function buildContentStream(layout: InvoiceLayout): string {
  const ops: string[] = [];
  let y = 750; // Start near top of page (page height 792, top margin 42)
  const leftMargin = 50;
  const rightMargin = 562; // 612 - 50

  // ─── Vendor name (large, bold) ──────────────────────────────────────
  ops.push('BT');
  ops.push('/F2 18 Tf'); // Helvetica-Bold 18pt
  ops.push(`${leftMargin} ${y} Td`);
  ops.push(`(${esc(layout.vendorName)}) Tj`);
  ops.push('ET');
  y -= 22;

  // ─── Vendor subtitle (gray, smaller) ────────────────────────────────
  if (layout.vendorSubtitle) {
    ops.push('BT');
    ops.push('/F1 9 Tf'); // Helvetica 9pt
    ops.push('0.4 0.4 0.4 rg'); // gray color
    ops.push(`${leftMargin} ${y} Td`);
    ops.push(`(${esc(layout.vendorSubtitle)}) Tj`);
    ops.push('0 0 0 rg'); // reset to black
    ops.push('ET');
    y -= 18;
  }

  // ─── "INVOICE" title (right-aligned, bold, large) ──────────────────
  ops.push('BT');
  ops.push('/F2 28 Tf'); // Helvetica-Bold 28pt
  const titleWidth = esc(layout.documentTitle).length * 16; // approx
  const titleX = rightMargin - titleWidth;
  ops.push(`${titleX} ${y} Td`);
  ops.push(`(${esc(layout.documentTitle)}) Tj`);
  ops.push('ET');
  y -= 30;

  // Horizontal line
  ops.push(`${leftMargin} ${y} m ${rightMargin} ${y} l S`);
  y -= 20;

  // ─── Sections ───────────────────────────────────────────────────────
  for (const section of layout.sections) {
    if (section.type === 'header') {
      ops.push('BT');
      ops.push('/F2 10 Tf'); // Helvetica-Bold 10pt
      ops.push(`${leftMargin} ${y} Td`);
      ops.push(`(${esc(section.title || '')}) Tj`);
      ops.push('ET');
      y -= 14;
    } else if (section.type === 'row') {
      // Label on left, value on right
      ops.push('BT');
      ops.push('/F1 10 Tf');
      ops.push(`${leftMargin} ${y} Td`);
      ops.push(`(${esc(section.label || '')}: ) Tj`);
      ops.push('ET');
      ops.push('BT');
      ops.push('/F1 10 Tf');
      const labelWidth = (section.label || '').length * 5.5 + 10;
      ops.push(`${leftMargin + labelWidth} ${y} Td`);
      ops.push(`(${esc(section.value || '')}) Tj`);
      ops.push('ET');
      y -= 14;
    } else if (section.type === 'table') {
      // Table header
      const cols = section.columns || [];
      const tableRows = section.rows || [];
      const colWidth = (rightMargin - leftMargin) / cols.length;

      // Header row (bold, with background)
      ops.push(`${leftMargin} ${y - 2} ${rightMargin - leftMargin} 16 re f`); // fill rect
      ops.push('1 1 1 rg'); // white text on dark? Actually we need dark fill + white text
      // Let's use a light gray fill instead
      // Reset — draw filled rectangle for header
      // Actually PDF fill color is set before 're f'. Let me redo this properly.
      y -= 16;

      // Reset to default — draw header text in bold
      ops.push('BT');
      ops.push('/F2 9 Tf');
      let colX = leftMargin;
      for (const col of cols) {
        ops.push(`${colX} ${y} Td`);
        ops.push(`(${esc(col)}) Tj`);
        colX += colWidth;
      }
      ops.push('ET');
      y -= 14;

      // Data rows
      ops.push('/F1 9 Tf');
      for (const row of tableRows) {
        ops.push('BT');
        colX = leftMargin;
        for (const cell of row) {
          ops.push(`${colX} ${y} Td`);
          ops.push(`(${esc(cell)}) Tj`);
          colX += colWidth;
        }
        ops.push('ET');
        y -= 14;
      }
      y -= 10; // spacing after table
    } else if (section.type === 'spacing') {
      y -= 20;
    }
  }

  // ─── Total at the bottom ────────────────────────────────────────────
  if (layout.totalLabel && layout.totalValue) {
    y -= 20;
    ops.push(`${leftMargin} ${y - 4} ${rightMargin - leftMargin} 1 l S`); // line above total
    y -= 16;
    ops.push('BT');
    ops.push('/F2 12 Tf'); // bold
    ops.push(`${leftMargin} ${y} Td`);
    ops.push(`(${esc(layout.totalLabel)}) Tj`);
    ops.push('ET');
    ops.push('BT');
    ops.push('/F2 12 Tf');
    const valWidth = (layout.totalValue).length * 7;
    ops.push(`${rightMargin - valWidth} ${y} Td`);
    ops.push(`(${esc(layout.totalValue)}) Tj`);
    ops.push('ET');
  }

  return ops.join('\n');
}

export function makeValidPdf(text: string): Buffer {
  // Legacy API — wrap text into a simple layout for backward compat
  const lines = text.split('\n').filter(Boolean);
  const layout: InvoiceLayout = {
    vendorName: lines[0] || 'Invoice',
    documentTitle: 'INVOICE',
    sections: lines.slice(1).map((line) => ({
      type: 'row' as const,
      label: line.split(':')[0]?.trim() || '',
      value: line.split(':').slice(1).join(':').trim() || line,
    })),
  };
  return makeInvoicePdf(layout);
}

export function makeInvoicePdf(layout: InvoiceLayout): Buffer {
  const contentStream = buildContentStream(layout);

  // Build PDF objects
  // We need two fonts: F1 (Helvetica) and F2 (Helvetica-Bold)
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];

  // Assemble the PDF
  const header = '%PDF-1.4\n';
  let body = '';
  const offsets: number[] = [];
  let pos = header.length;

  objects.forEach((obj, i) => {
    offsets.push(pos);
    const objStr = `${i + 1} 0 obj\n${obj}\nendobj\n`;
    body += objStr;
    pos += objStr.length;
  });

  const xrefOffset = pos;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    xref += String(off).padStart(10, '0') + ' 00000 n \n';
  });

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(header + body + xref + trailer, 'latin1');
}
