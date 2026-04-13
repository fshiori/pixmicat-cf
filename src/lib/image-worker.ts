/**
 * Cloudflare Workers 圖片處理模組
 * 用於解析圖片尺寸資訊
 *
 * 縮圖功能使用 Cloudflare Image Resizing CDN 動態生成，
 * 不需要在 Worker 端預先產生縮圖 buffer。
 */

/**
 * 獲取圖片尺寸資訊
 * 支援 JPEG、PNG、GIF、WebP 格式
 * @param imageBuffer 圖片資料
 * @returns 寬度和高度
 */
export async function getImageDimensions(imageBuffer: ArrayBuffer): Promise<{ width: number; height: number }> {
  const buffer = new Uint8Array(imageBuffer);
  
  // JPEG: FF D8
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    return parseJpegDimensions(buffer);
  }
  
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return parsePngDimensions(buffer);
  }
  
  // GIF: 47 49 46 38 (GIF8)
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return parseGifDimensions(buffer);
  }
  
  // WebP: 52 49 46 46 ... 57 45 42 50 (RIFF...WEBP)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return parseWebpDimensions(buffer);
  }
  
  // 無法識別格式，返回預設值
  console.warn('Unknown image format, returning default dimensions');
  return { width: 0, height: 0 };
}

/**
 * 解析 JPEG 圖片尺寸
 */
function parseJpegDimensions(buffer: Uint8Array): { width: number; height: number } {
  let i = 2;
  while (i < buffer.length) {
    // 尋找 SOF (Start Of Frame) 標記
    if (buffer[i] === 0xFF && buffer[i + 1] >= 0xC0 && buffer[i + 1] <= 0xCF && buffer[i + 1] !== 0xC4 && buffer[i + 1] !== 0xC8 && buffer[i + 1] !== 0xCC) {
      const height = (buffer[i + 5] << 8) | buffer[i + 6];
      const width = (buffer[i + 7] << 8) | buffer[i + 8];
      return { width, height };
    }
    i += 2 + ((buffer[i + 2] << 8) | buffer[i + 3]);
  }
  return { width: 0, height: 0 };
}

/**
 * 解析 PNG 圖片尺寸
 */
function parsePngDimensions(buffer: Uint8Array): { width: number; height: number } {
  const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19];
  const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
  return { width, height };
}

/**
 * 解析 GIF 圖片尺寸
 */
function parseGifDimensions(buffer: Uint8Array): { width: number; height: number } {
  const width = (buffer[7] << 8) | buffer[6];
  const height = (buffer[9] << 8) | buffer[8];
  return { width, height };
}

/**
 * 解析 WebP 圖片尺寸
 */
function parseWebpDimensions(buffer: Uint8Array): { width: number; height: number } {
  // WebP VP8/VP8L/VP8X 格式較複雜，這裡簡化處理
  // 尋找 VP8 chunk
  const webpStart = new TextDecoder().decode(buffer.slice(0, 12));
  if (webpStart.includes('WEBP')) {
    // VP8
    if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38) {
      const width = (buffer[26] << 8) | buffer[27];
      const height = (buffer[28] << 8) | buffer[29];
      return { width, height };
    }
    // VP8L
    if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x4C) {
      const bits = (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
      const width = (bits & 0x3FFF) + 1;
      const height = ((bits >> 14) & 0x3FFF) + 1;
      return { width, height };
    }
  }
  return { width: 0, height: 0 };
}
