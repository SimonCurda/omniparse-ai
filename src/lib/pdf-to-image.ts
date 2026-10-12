import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);

let _pdfjsLib: typeof import('pdfjs-dist/legacy/build/pdf.mjs') | null = null;

type CanvasLike = {
  getContext: (type: string) => unknown;
  toBuffer: (type: string) => Promise<Buffer>;
};

async function getPdfjs() {
  if (!_pdfjsLib) {
    _pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    try {
      const workerPath = req.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
      _pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
    } catch {}
  }
  return _pdfjsLib;
}

export async function renderPdfFirstPageToPng(buffer: Buffer, maxDimension = 1568): Promise<Buffer | null> {
  try {
    const pdfjsLib = await getPdfjs();
    const canvasModuleName = '@napi-rs/canvas';
    const canvasModule = await import(/* webpackIgnore: true */ canvasModuleName as string);
    const { createCanvas } = canvasModule as { createCanvas: (w: number, h: number) => CanvasLike };

    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
    if (doc.numPages === 0) return null;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const longestEdge = Math.max(viewport.width, viewport.height);
    const scale = longestEdge > maxDimension ? maxDimension / longestEdge : 2;
    const scaledViewport = page.getViewport({ scale });
    const canvas: CanvasLike = createCanvas(scaledViewport.width, scaledViewport.height);
    const context = canvas.getContext('2d');
    await page.render({ canvasContext: context as CanvasRenderingContext2D, viewport: scaledViewport }).promise;
    return await canvas.toBuffer('image/png');
  } catch (err) {
    console.warn('[pdf-to-image] Error:', err instanceof Error ? err.message : String(err));
    return null;
  }
}
