import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { geminiVisionCall } from '@/lib/gemini';

// POST /api/test-extraction
// Debug endpoint: send the Czech invoice image to the vision model and
// return the raw AI response + which model was used.
// Temporary — delete after debugging.

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { base64, mime } = body;
  if (!base64 || !mime) {
    return NextResponse.json({ error: 'Need base64 + mime in body' }, { status: 400 });
  }

  const dataUri = `data:${mime};base64,${base64}`;

  const prompt = `You are an invoice parser. Extract ALL visible fields from the document image.

IMPORTANT: The invoice may be in ANY language (English, Czech, German, French, Spanish, etc.). Extract the fields regardless of the document language. Map foreign-language labels to their English equivalents:
- Czech: Dodavatel/Prodávající = vendor, Číslo dokladu = invoice number, Datum vystavení = invoice date, Datum splatnosti = due date, Celkem/Celkem uhradit = total, DPH = VAT, Kč = CZK, Základ = amount (net)
- German: Lieferant = vendor, Rechnungsnummer = invoice number, Gesamtbetrag = total, MwSt = VAT

CRITICAL NUMBER PARSING RULES:
- European format: "33 275,00" = 33275.00 (space=thousands, comma=decimal)
- "7 000,00" = 7000.00 NOT 7.00
- Always convert to standard float

NEVER put confidence labels ("High", "Low") as field values. Only extract actual data.

Output ONLY valid JSON:
{
  "vendor": "company name or null",
  "invoiceNumber": "invoice number string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "amount": 1234.56 or null,
  "vatAmount": 234.56 or null,
  "total": 1468.12 or null,
  "currency": "USD or CZK or EUR etc. or null",
  "lineItems": [{"description": "item", "quantity": 1, "unitPrice": 10.00}],
  "fieldConfidence": {"vendor": 0.95, "invoiceNumber": 0.99, "invoiceDate": 0.90, "dueDate": 0.90, "amount": 0.98, "vatAmount": 0.95, "total": 0.99, "currency": 1.0},
  "confidence": 0.93
}`;

  const startTime = Date.now();

  try {
    const response = await geminiVisionCall([{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUri } },
      ],
    }]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Try to parse the response
    let parsed: Record<string, unknown> | null = null;
    let parseError: string | null = null;
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({
      success: true,
      elapsed: `${elapsed}s`,
      rawResponse: response.slice(0, 2000),
      parsed,
      parseError,
      responseLength: response.length,
    });
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    return NextResponse.json({
      success: false,
      elapsed: `${elapsed}s`,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
