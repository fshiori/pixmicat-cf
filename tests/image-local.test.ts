import { describe, it, expect, beforeAll } from 'vitest';
import { generateLocalThumbnail, getImageInfo, isSharpAvailable } from '../src/lib/image-local';

describe('image-local: local thumbnail generation', () => {
  let sharpAvailable: boolean;

  beforeAll(async () => {
    sharpAvailable = await isSharpAvailable();
  });

  it('should detect sharp availability', () => {
    // 在本地環境應該有 sharp
    expect(typeof sharpAvailable).toBe('boolean');
  });

  (sharpAvailable ? describe : describe.skip)('with sharp installed', () => {
    it('should generate a thumbnail from image buffer', async () => {
      // 建立一個簡單的 2x2 紅色 PNG
      const pngData = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk start
        0x00, 0x00, 0x00, 0x02, // width: 2
        0x00, 0x00, 0x00, 0x02, // height: 2
        0x08, 0x02, 0x00, 0x00, 0x00, // bit depth: 8, color type: 2 (RGB)
        0x4F, 0x6D, 0x27, 0xB5, // CRC
        0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT chunk start
        0x28, 0x15, 0x63, 0x60, 0x18, 0x05, 0x00, 0x00, // image data (red pixel)
        0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, // CRC
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
        0xAE, 0x42, 0x60, 0x82  // CRC
      ]);

      const buffer = pngData.buffer.slice(pngData.byteOffset, pngData.byteOffset + pngData.byteLength);

      const thumbnail = await generateLocalThumbnail(buffer, {
        width: 100,
        height: 100,
        quality: 80,
        format: 'jpeg'
      });

      expect(thumbnail).toBeInstanceOf(ArrayBuffer);
      expect(thumbnail.byteLength).toBeGreaterThan(0);
    });

    it('should get image info', async () => {
      const pngData = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x64, // width: 100
        0x00, 0x00, 0x00, 0x64, // height: 100
        0x08, 0x02, 0x00, 0x00, 0x00,
        0x4F, 0x6D, 0x27, 0xB5,
        0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54,
        0x28, 0x15, 0x63, 0x60,
        0x18, 0x05, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      const buffer = pngData.buffer.slice(pngData.byteOffset, pngData.byteOffset + pngData.byteLength);
      const info = await getImageInfo(buffer);

      expect(info.width).toBe(100);
      expect(info.height).toBe(100);
      expect(info.format).toBe('png');
    });
  });

  (sharpAvailable ? it.skip : it)('should handle missing sharp gracefully', async () => {
    // 如果沒有安裝 sharp，應該拋出錯誤
    await expect(generateLocalThumbnail(new ArrayBuffer(10))).rejects.toThrow();
  });
});
