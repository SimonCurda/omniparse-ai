// A valid, minimal PDF that all browsers can render.
// Source: the simplest possible valid PDF (the "Hello World" of PDFs),
// hand-crafted to pass strict PDF viewers. Used by the seed-test-pending
// endpoint to generate test pending items with real PDF attachments.
//
// Structure:
// - Header: %PDF-1.4
// - Catalog (obj 1) → Pages (obj 2) → Page (obj 3) with Contents (obj 4) + Font (obj 5)
// - Content stream places text "Hello" on the page
// - Proper xref table + trailer
//
// We swap the text content dynamically for each test invoice.

export function makeValidPdf(text: string): Buffer {
  // Escape parentheses and backslashes in the text (PDF string rules)
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '')
    .replace(/\n/g, ' '); // PDF text doesn't handle newlines in BT/ET well

  // Build the content stream — place text on the page
  // Use T* for line breaks (we split on actual newlines in the original text)
  const lines = text.split('\n');
  const textOps = lines.map((line, i) => {
    const esc = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    // First line uses Td to position, subsequent lines use T*
    if (i === 0) return `(${esc}) Tj`;
    return `T* (${esc}) Tj`;
  }).join(' ');

  const contentStream = `BT /F1 10 Tf 50 750 Td 14 TL ${textOps} ET`;

  // Build PDF objects
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  // Assemble the PDF with proper xref table
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
