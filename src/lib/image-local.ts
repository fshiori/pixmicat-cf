/**
 * 本地開發環境的圖片處理工具
 * 使用 sharp 庫進行圖片縮圖生成
 * 只在本地開發環境使用（生產環境使用 Cloudflare Image Resizing）
 */

import { ResizeOptions } from 'sharp';

interface SharpModule {
  default: {
    (input: Buffer | string, options?: any): any;
    format: Record<string, any>;
  };
}

let sharpInstance: any = null;

/**
 * 動態載入 sharp（只在需要時）
 */
async function loadSharp(): Promise<any> {
  if (sharpInstance) {
    return sharpInstance;
  }

  try {
    // 動態 import，避免在 Workers 環境載入
    const sharpModule = await import('sharp') as SharpModule;
    sharpInstance = sharpModule.default;
    return sharpInstance;
  } catch (error) {
    console.warn('sharp not available, thumbnail generation will fail:', error);
    throw new Error('sharp library is required for local thumbnail generation. Install it with: npm install sharp');
  }
}

/**
 * 生成本地縮圖
 * @param imageBuffer 原始圖片的 Buffer
 * @param options 縮圖選項
 * @returns 縮圖的 Buffer
 */
export async function generateLocalThumbnail(
  imageBuffer: ArrayBuffer,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  } = {}
): Promise<ArrayBuffer> {
  const sharp = await loadSharp();

  const {
    width = 250,
    height = 250,
    quality = 75,
    format = 'jpeg'
  } = options;

  // 轉換 ArrayBuffer 到 Buffer
  const buffer = Buffer.from(imageBuffer);

  // 使用 sharp 處理圖片
  const processor = sharp(buffer)
    .resize(width, height, {
      fit: 'cover',
      position: 'center'
    });

  // 根據格式輸出
  let outputProcessor: any;
  switch (format) {
    case 'jpeg':
      outputProcessor = processor.jpeg({ quality });
      break;
    case 'png':
      outputProcessor = processor.png({ quality });
      break;
    case 'webp':
      outputProcessor = processor.webp({ quality });
      break;
    default:
      outputProcessor = processor.jpeg({ quality });
  }

  const result = await outputProcessor.toBuffer();

  // 轉換回 ArrayBuffer
  return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
}

/**
 * 取得圖片資訊
 * @param imageBuffer 圖片 Buffer
 * @returns 圖片寬高、格式等資訊
 */
export async function getImageInfo(imageBuffer: ArrayBuffer): Promise<{
  width: number;
  height: number;
  format: string;
}> {
  const sharp = await loadSharp();

  const buffer = Buffer.from(imageBuffer);
  const metadata = await sharp(buffer).metadata();

  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown'
  };
}

/**
 * 檢查 sharp 是否可用
 */
export async function isSharpAvailable(): Promise<boolean> {
  try {
    await loadSharp();
    return true;
  } catch {
    return false;
  }
}
