// ============================================================================
// Robust PDF Extraction — Vercel Serverless Compatible
// Path 1: pdfjs-dist text extraction
// Path 2: Regex fallback (FlateDecode, ASCIIHex, ASCII85)
// Path 3: Raw JPEG extraction from PDF streams (BEST for scanned PDFs)
// Path 4: pdfjs-dist page object image extraction (fallback, PNG conversion)
// ============================================================================

import { inflateSync, deflateSync } from 'node:zlib';
import { createRequire } from 'node:module';
import path from 'node:path';

const req = createRequire(import.meta.url);

// Pre-configure the pdfjs worker path so the fake worker can find it
// on Vercel serverless, in Docker, in CI — anywhere node_modules exists.
let _workerConfigured = false;
function ensurePdfjsWorker(pdfjsLib: typeof import('pdfjs-dist/legacy/build/pdf.mjs')) {
  if (_workerConfigured) return;
  _workerConfigured = true;
  try {
    const workerPath = req.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
  } catch {
    try {
      const pdfPath = req.resolve('pdfjs-dist/legacy/build/pdf.mjs');
      const workerPath = path.join(path.dirname(pdfPath), 'pdf.worker.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs';
    }
  }
}

export interface PdfExtractResult {
  text: string;
  source: 'text' | 'image';
  images?: Buffer[];
  errors?: string[];
}

/**
 * Main entry point: extract text or images from a PDF buffer.
 */
export async function extractPdfText(buffer: Buffer): Promise<PdfExtractResult> {
  const errors: string[] = [];

  // ── Path 1: pdfjs-dist text extraction ──
  try {
    const text = await extractTextWithPdfjs(buffer);
    const len = text ? text.trim().length : 0;
    if (len >= 10) {
      return { text: text.trim(), source: 'text' };
    }
    errors.push(`Path 1 (pdfjs text): extracted ${len} chars`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Path 1 (pdfjs text): ${msg}`);
  }

  // ── Path 2: Regex fallback ──
  try {
    const text = extractTextRegex(buffer);
    const len = text ? text.trim().length : 0;
    if (len >= 10) {
      return { text: text.trim(), source: 'text' };
    }
    errors.push(`Path 2 (regex): extracted ${len} chars`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Path 2 (regex): ${msg}`);
  }

  // ── Path 3: Raw JPEG extraction from PDF streams (most reliable for scans) ──
  try {
    const images = extractRawJpegs(buffer);
    if (images.length > 0) {
      return { text: '', source: 'image', images };
    }
    errors.push('Path 3 (raw JPEGs): none found');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Path 3 (raw JPEGs): ${msg}`);
  }

  // ── Path 4: pdfjs-dist object store image extraction (PNG conversion fallback) ──
  let page4Details = '';
  try {
    const result = await extractImagesViaPdfjsObjectsDetailed(buffer);
    page4Details = result.details;
    if (result.images.length > 0) {
      return { text: '', source: 'image', images: result.images };
    }
    errors.push(`Path 4 (pdfjs objects): ${page4Details}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Path 4 (pdfjs objects): ${msg}`);
  }

  return { text: '', source: 'text', errors };
}

// ============================================================================
// Path 1: pdfjs-dist text extraction
// ============================================================================
async function extractTextWithPdfjs(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  ensurePdfjsWorker(pdfjsLib);
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let lastX: number | null = null;
    let pageStr = '';

    for (const item of content.items) {
      const ti = item as { str: string; transform: number[] };
      if (!ti.str || !ti.transform) continue;
      const x = ti.transform[4];
      const y = ti.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) pageStr += '\n';
      else if (lastX !== null && x - lastX > 5) pageStr += ' ';
      pageStr += ti.str;
      lastY = y;
      lastX = x + (ti.str.length * 3);
    }
    pageTexts.push(pageStr);
  }
  return pageTexts.join('\n--- Page Break ---\n');
}

// ============================================================================
// Path 3: Extract raw JPEGs directly from PDF byte streams
// Scanned PDFs store page images as DCTDecode (JPEG) streams.
// We find them by scanning for JPEG magic bytes inside stream data.
// This avoids any PNG conversion — we send the JPEG directly to the API.
// ============================================================================
function extractRawJpegs(buffer: Buffer): Buffer[] {
  const images: Buffer[] = [];
  const raw = buffer.toString('latin1');

  // Find all stream...endstream regions
  const streamRegex = /stream\r?\n/gi;
  const endstreamRegex = /\r?\nendstream/gi;
  let sMatch: RegExpExecArray | null;

  while ((sMatch = streamRegex.exec(raw)) !== null) {
    const sIdx = sMatch.index + sMatch[0].length;
    endstreamRegex.lastIndex = sIdx;
    const eMatch = endstreamRegex.exec(raw);
    if (!eMatch) break;

    const streamBuf = buffer.subarray(sIdx, eMatch.index);
    if (streamBuf.length < 100) continue;

    // Check for JPEG magic bytes (FF D8 FF)
    if (streamBuf[0] === 0xFF && streamBuf[1] === 0xD8 && streamBuf[2] === 0xFF) {
      // This is a raw JPEG — find the end marker (FF D9)
      // Look for JPEG end-of-file marker
      let jpegEnd = -1;
      for (let i = streamBuf.length - 2; i >= 1; i--) {
        if (streamBuf[i] === 0xFF && streamBuf[i + 1] === 0xD9) {
          jpegEnd = i + 2;
          break;
        }
      }
      const jpegData = jpegEnd > 0
        ? Buffer.from(streamBuf.subarray(0, jpegEnd))
        : Buffer.from(streamBuf);
      
      // Only accept reasonably-sized images (at least 10KB for scanned pages)
      if (jpegData.length > 10000) {
        images.push(jpegData);
        if (images.length >= 5) break;
        continue;
      }
    }

    // Also check if the stream dictionary mentions DCTDecode
    // Handles both /Filter /DCTDecode and /Filter [/FlateDecode /DCTDecode]
    const dictStart = Math.max(0, sMatch.index - 2000);
    const dictArea = raw.substring(dictStart, sMatch.index);
    const hasDCTDecode = /\/DCTDecode/i.test(dictArea);
    const hasFlateDecode = /\/FlateDecode/i.test(dictArea);
    if (hasDCTDecode) {
      // DCTDecode stream — find JPEG within the (possibly Flate-compressed) data
      try {
        let dataToScan = streamBuf;
        
        // If also FlateDecode, decompress first
        if (hasFlateDecode) {
          dataToScan = inflateSync(streamBuf);
        }
        
        // Find JPEG magic bytes in the (possibly decompressed) data
        // The JPEG might not start at byte 0 — scan for it
        let jpegOffset = -1;
        for (let k = 0; k < Math.min(dataToScan.length - 2, 1024); k++) {
          if (dataToScan[k] === 0xFF && dataToScan[k + 1] === 0xD8 && dataToScan[k + 2] === 0xFF) {
            jpegOffset = k;
            break;
          }
        }
        if (jpegOffset >= 0) {
          // Find JPEG end marker
          let jpegEnd = -1;
          for (let k = dataToScan.length - 2; k > jpegOffset; k--) {
            if (dataToScan[k] === 0xFF && dataToScan[k + 1] === 0xD9) {
              jpegEnd = k + 2;
              break;
            }
          }
          const jpegData = jpegEnd > 0
            ? Buffer.from(dataToScan.subarray(jpegOffset, jpegEnd))
            : Buffer.from(dataToScan.subarray(jpegOffset));
          if (jpegData.length > 10000) {
            images.push(jpegData);
            if (images.length >= 5) break;
          }
        }
      } catch {
        // decompression failed, skip
      }
    }
  }

  // Sort by size (largest first) — the biggest image is likely the full page scan
  images.sort((a, b) => b.length - a.length);
  return images;
}

// ============================================================================
// Path 4: Extract images via pdfjs-dist's internal object store (PNG fallback)
// ============================================================================
async function extractImagesViaPdfjsObjectsDetailed(buffer: Buffer): Promise<{ images: Buffer[]; details: string }> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  ensurePdfjsWorker(pdfjsLib);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const images: Buffer[] = [];
  const details: string[] = [];
  details.push(`${doc.numPages} page(s)`);

  for (let i = 1; i <= Math.min(doc.numPages, 5); i++) {
    const page = await doc.getPage(i);
    const ops = await page.getOperatorList();
    details.push(`page ${i}: ${ops.fnArray.length} ops`);
    const pageImages: Buffer[] = [];
    const seenNames = new Set<string>();
    let imgOpsFound = 0;

    for (let j = 0; j < ops.fnArray.length; j++) {
      const op = ops.fnArray[j];
      const isPaintImg = op === pdfjsLib.OPS.paintImageXObject || op === pdfjsLib.OPS.paintXObject;
      if (!isPaintImg) continue;
      imgOpsFound++;

      const imgName = ops.argsArray[j][0] as string;
      if (seenNames.has(imgName)) continue;
      seenNames.add(imgName);

      try {
        const objs = (page as unknown as { objs: { get: (name: string) => Promise<unknown> } }).objs;
        const imgData = await objs.get(imgName);
        if (!imgData || typeof imgData !== 'object') {
          details.push(`page ${i} img ${imgName}: get() returned ${typeof imgData}`);
          continue;
        }

        const img = imgData as Record<string, unknown>;
        const width = img.width as number | undefined;
        const height = img.height as number | undefined;
        const data = img.data as Uint8Array | Uint8ClampedArray | undefined;
        const kind = img.kind as number | undefined;

        details.push(`page ${i} img ${imgName}: ${width}x${height} kind=${kind} hasData=${!!data} dataLen=${data?.length ?? 0}`);

        if (!width || !height || width < 10 || height < 10) continue;
        if (!data) continue;

        const png = convertPdfjsImageToPng(data, width, height, kind ?? 1);
        if (png && png.length > 500) pageImages.push(png);
        else details.push(`page ${i} img ${imgName}: PNG conversion failed or too small`);
      } catch (e) {
        details.push(`page ${i} img ${imgName}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    details.push(`page ${i}: ${imgOpsFound} img ops, ${pageImages.length} extracted`);
    if (pageImages.length > 0) {
      pageImages.sort((a, b) => b.length - a.length);
      images.push(pageImages[0]);
    }
  }

  return { images, details: details.join('; ') };
}

/**
 * Convert pdfjs-dist decoded image data to PNG buffer.
 */
function convertPdfjsImageToPng(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  kind: number,
): Buffer | null {
  try {
    let pixelData: Buffer;
    let colorSpace: string;
    let bitsPerComponent: number;

    switch (kind) {
      case 1:
        pixelData = Buffer.from(data.buffer, data.byteOffset, width * height * 3);
        colorSpace = 'DEVICERGB';
        bitsPerComponent = 8;
        break;
      case 2: {
        pixelData = Buffer.alloc(width * height * 3);
        for (let p = 0; p < width * height; p++) {
          pixelData[p * 3] = data[p * 4];
          pixelData[p * 3 + 1] = data[p * 4 + 1];
          pixelData[p * 3 + 2] = data[p * 4 + 2];
        }
        colorSpace = 'DEVICERGB';
        bitsPerComponent = 8;
        break;
      }
      case 3: {
        pixelData = Buffer.alloc(width * height);
        for (let p = 0; p < width * height; p++) {
          const byteIdx = Math.floor(p / 8);
          const bitIdx = 7 - (p % 8);
          pixelData[p] = (data[byteIdx] & (1 << bitIdx)) ? 0 : 255;
        }
        colorSpace = 'DEVICEGRAY';
        bitsPerComponent = 8;
        break;
      }
      case 6:
        pixelData = Buffer.from(data.buffer, data.byteOffset, width * height);
        colorSpace = 'DEVICEGRAY';
        bitsPerComponent = 8;
        break;
      case 7: {
        pixelData = Buffer.alloc(width * height);
        for (let p = 0; p < width * height; p++) {
          pixelData[p] = data[p * 2 + 1];
        }
        colorSpace = 'DEVICEGRAY';
        bitsPerComponent = 8;
        break;
      }
      default:
        if (data.length >= width * height * 3) {
          pixelData = Buffer.from(data.buffer, data.byteOffset, width * height * 3);
          colorSpace = 'DEVICERGB';
          bitsPerComponent = 8;
        } else {
          return null;
        }
    }

    return createPngFromRaw(pixelData, width, height, bitsPerComponent, colorSpace);
  } catch {
    return null;
  }
}

// ============================================================================
// Path 2: Regex-based text extraction (fallback)
// ============================================================================
function extractTextRegex(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const textParts: string[] = [];
  const streamRegex = /stream\r?\n/g;
  const endstreamRegex = /\r?\nendstream/g;
  let sResult: RegExpExecArray | null;

  while ((sResult = streamRegex.exec(raw)) !== null) {
    const sIdx = sResult.index + sResult[0].length;
    endstreamRegex.lastIndex = sIdx;
    const eResult = endstreamRegex.exec(raw);
    if (!eResult) break;

    const streamBuf = Buffer.from(raw.substring(sIdx, eResult.index), 'latin1');
    const dictBefore = raw.substring(Math.max(0, sResult.index - 300), sResult.index);
    const isFlate = /\/Filter\s*\/FlateDecode/i.test(dictBefore);
    const isAsciiHex = /\/Filter\s*\/ASCIIHexDecode/i.test(dictBefore);
    const isAscii85 = /\/Filter\s*\/ASCII85Decode/i.test(dictBefore);

    let content: string;
    try {
      if (isFlate) content = inflateSync(streamBuf).toString('latin1');
      else if (isAsciiHex) {
        const hexStr = streamBuf.toString('latin1').replace(/[\s><]/g, '');
        let d = '';
        for (let j = 0; j < hexStr.length - 1; j += 2) d += String.fromCharCode(parseInt(hexStr.substring(j, j + 2), 16));
        content = d;
      } else if (isAscii85) content = decodeAscii85(streamBuf.toString('latin1'));
      else content = streamBuf.toString('latin1');
    } catch { continue; }

    content = content.replace(/<([0-9A-Fa-f]{4,})>/g, (_: string, hex: string) => {
      let d = '';
      for (let j = 0; j < hex.length; j += 2) d += String.fromCharCode(parseInt(hex.substring(j, j + 2), 16));
      return d;
    });

    const btRegex = /BT([\s\S]*?)ET/g;
    let btM: RegExpExecArray | null;
    while ((btM = btRegex.exec(content)) !== null) {
      const block = btM[1];
      for (const m of block.matchAll(/\(([^)]*)\)\s*Tj/g)) textParts.push(m[1]);
      for (const m of block.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
        const ps = m[1].match(/\(([^)]*)\)/g);
        if (ps) for (const p of ps) textParts.push(p.slice(1, -1));
      }
      for (const m of block.matchAll(/\(([^)]*)\)\s*'/g)) textParts.push(m[1]);
    }
  }

  if (textParts.length === 0) {
    const sr = /\(([\x20-\x7E]{4,})\)/g;
    let m: RegExpExecArray | null;
    while ((m = sr.exec(raw)) !== null) textParts.push(m[1]);
  }
  return textParts.join(' ');
}

function decodeAscii85(input: string): string {
  const cleaned = input.replace(/<~|~>/g, '').replace(/\s/g, '');
  let result = '';
  let idx = 0;
  while (idx < cleaned.length) {
    const chunk = cleaned.substring(idx, idx + 5).padEnd(5, 'u');
    idx += 5;
    let value = 0;
    for (let j = 0; j < 5; j++) value = value * 85 + (chunk.charCodeAt(j) - 33);
    result += String.fromCharCode((value >> 24) & 0xff) + String.fromCharCode((value >> 16) & 0xff) +
             String.fromCharCode((value >> 8) & 0xff) + String.fromCharCode(value & 0xff);
  }
  return result;
}

// ============================================================================
// PNG creation utilities (fallback only)
// ============================================================================
function createPngFromRaw(rawData: Buffer, width: number, height: number, bitsPerComponent: number, colorSpace: string): Buffer | null {
  try {
    const isGray = colorSpace === 'DEVICEGRAY' || colorSpace === 'GREY' || colorSpace === 'G';
    const channels = isGray ? 1 : 3;
    const bytesPerPixel = (bitsPerComponent / 8) * channels;
    const expectedLen = width * height * bytesPerPixel;
    if (rawData.length < expectedLen * 0.5) return null;
    const colorType = isGray ? 0 : 2;
    const rowBytes = width * bytesPerPixel;
    const filteredData = Buffer.alloc(height * (1 + rowBytes));
    for (let y = 0; y < height; y++) {
      const srcOff = y * rowBytes;
      const dstOff = y * (1 + rowBytes);
      filteredData[dstOff] = 0;
      rawData.copy(filteredData, dstOff + 1, srcOff, srcOff + rowBytes);
    }
    const chunks: Buffer[] = [];
    chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
    ihdr[8] = bitsPerComponent; ihdr[9] = colorType;
    chunks.push(makePngChunk('IHDR', ihdr));
    chunks.push(makePngChunk('IDAT', deflateSync(filteredData)));
    chunks.push(makePngChunk('IEND', Buffer.alloc(0)));
    return Buffer.concat(chunks);
  } catch { return null; }
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) { crc ^= buf[i]; for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0); }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
