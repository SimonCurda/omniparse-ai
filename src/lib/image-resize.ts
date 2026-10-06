import { Jimp } from 'jimp';

const MAX_LONG_EDGE = 1568;
const TARGET_MAX_BYTES = 1024 * 1024;
const HARD_MAX_BYTES = 2 * 1024 * 1024;

export async function resizeForVisionAI(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    if (buffer.length <= TARGET_MAX_BYTES) return { buffer, mimeType };
    const image = await Jimp.read(buffer);
    const originalWidth = image.width;
    const originalHeight = image.height;
    if (originalWidth > MAX_LONG_EDGE || originalHeight > MAX_LONG_EDGE) {
      if (originalWidth >= originalHeight) image.resize({ w: MAX_LONG_EDGE });
      else image.resize({ h: MAX_LONG_EDGE });
    }
    const qualities = [85, 70, 50];
    for (const quality of qualities) {
      const result = await image.clone().quality(quality).getBufferAsync(Jimp.MIME_JPEG);
      if (result.length <= HARD_MAX_BYTES) {
        console.warn(`[image-resize] ${originalWidth}x${originalHeight} → JPEG q${quality}, ${buffer.length} → ${result.length} bytes`);
        return { buffer: result, mimeType: 'image/jpeg' };
      }
    }
    const aggressive = await image.clone().resize({ w: 800 }).quality(50).getBufferAsync(Jimp.MIME_JPEG);
    return { buffer: aggressive, mimeType: 'image/jpeg' };
  } catch (err) {
    console.warn('[image-resize] Error:', err instanceof Error ? err.message : String(err));
    return { buffer, mimeType };
  }
}
