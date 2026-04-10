/**
 * Cloudflare Image Resizing Implementation
 * 使用 Cloudflare Workers Image Resizing API
 */

import type { FileIO } from './fileio-interface';
import type { ImageInfo, Env } from '../types';

export class FileIOImageResizing implements FileIO {
  private r2: R2Bucket;
  private baseUrl: string;

  constructor(r2: R2Bucket, baseUrl: string = 'https://pixmicat.example.com') {
    this.r2 = r2;
    this.baseUrl = baseUrl;
  }

  version(): string {
    return '0.2.0-cf-resizing';
  }

  async init(): Promise<void> {
    // 無需初始化
  }

  async saveImage(image: File | Uint8Array, filename: string, tim: string): Promise<ImageInfo> {
    const ext = '.' + filename.split('.').pop();
    const key = `${tim}${ext}`;

    let file: File;
    let md5: string;

    if (image instanceof Uint8Array) {
      // Uint8Array: 轉換為 File
      const buffer = (image.buffer as ArrayBuffer).slice(image.byteOffset, image.byteOffset + image.byteLength);
      file = new File([buffer], filename, { type: 'image/jpeg' });
      md5 = await this.calculateMD5(image);
    } else {
      // File: 直接使用
      file = image;
      md5 = await this.calculateMD5(image);
    }

    await this.r2.put(key, file);

    const arrayBuffer = await file.arrayBuffer();
    const dimensions = await this.getImageDimensions(arrayBuffer);

    return {
      originalName: filename,
      extension: ext,
      mimeType: file.type,
      size: file.size,
      md5,
      width: dimensions.width,
      height: dimensions.height,
      thumbnailWidth: 0,
      thumbnailHeight: 0,
      storageKey: key,
      thumbnailKey: '', // Cloudflare Image Resizing 不需要儲存縮圖
      tim,
    };
  }

  async saveThumbnail(thumbnail: Blob, tim: string): Promise<void> {
    // Cloudflare Image Resizing 不需要預先儲存縮圖
    // 縮圖會動態生成
  }

  /**
   * 取得縮圖 URL
   * @param tim 時間戳
   * @param ext 原始圖片的副檔名
   * @param maxWidth 最大寬度
   * @param maxHeight 最大高度
   * @param quality 品質 (1-100)
   * @returns 縮圖 URL
   */
  getThumbnailUrl(
    tim: string,
    ext?: string,
    maxWidth?: number,
    maxHeight?: number,
    quality?: number
  ): string {
    // Cloudflare Image Resizing URL 格式
    // /cdn-cgi/image/width=250,height=250,quality=75,format=auto/img/tim.ext
    const width = maxWidth || 250;
    const height = maxHeight || 250;
    const qual = quality || 75;
    const extension = ext || '.jpg';
    return `${this.baseUrl}/cdn-cgi/image/width=${width},height=${height},quality=${qual},format=auto/img/${tim}${extension}`;
  }

  /**
   * 從 R2 取得圖片
   */
  async getImage(key: string): Promise<Blob | null> {
    const object = await this.r2.get(key);
    if (!object) return null;

    const data = await object.arrayBuffer();
    return new Blob([data], { type: object.httpMetadata?.contentType || 'image/jpeg' });
  }

  /**
   * 刪除圖片
   */
  async deleteImage(tim: string, ext?: string): Promise<void> {
    const key = ext ? `img/${tim}${ext}` : `img/${tim}`;
    await this.r2.delete(key);
  }

  /**
   * 計算 MD5 雜湊
   */
  async calculateMD5(data: Uint8Array | File): Promise<string> {
    let bytes: Uint8Array;
    if (data instanceof File) {
      const buffer = await data.arrayBuffer();
      bytes = new Uint8Array(buffer);
    } else {
      bytes = data;
    }

    const hashBuffer = await crypto.subtle.digest('MD5', bytes.buffer as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 從圖片讀取尺寸
   */
  async getImageDimensions(buffer: ArrayBuffer): Promise<{ width: number; height: number }> {
    const bytes = new Uint8Array(buffer);

    // JPEG
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
      let i = 2;
      while (i < bytes.length) {
        if (bytes[i] !== 0xFF) break;
        const marker = bytes[i + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          const height = (bytes[i + 5] << 8) | bytes[i + 6];
          const width = (bytes[i + 7] << 8) | bytes[i + 8];
          return { width, height };
        }
        i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
      }
    }

    // PNG
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      return { width, height };
    }

    // GIF
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      const width = (bytes[7] << 8) | bytes[6];
      const height = (bytes[9] << 8) | bytes[8];
      return { width, height };
    }

    // WebP
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      const width = (bytes[27] << 24) | (bytes[26] << 16) | (bytes[25] << 8) | bytes[24];
      const height = (bytes[31] << 24) | (bytes[30] << 16) | (bytes[29] << 8) | bytes[28];
      return { width, height };
    }

    return { width: 0, height: 0 };
  }

  /**
   * 驗證圖片格式
   */
  async validateImage(image: File): Promise<boolean> {
    const buffer = await image.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 12));

    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;

    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;

    // GIF: 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;

    // WebP: 52 49 46 46 ... 57 45 42 50
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return true;
    }

    return false;
  }

  /**
   * 不需要實作 - Cloudflare 會自動處理
   */
  async resizeImage(buffer: ArrayBuffer, maxWidth: number, maxHeight: number, quality?: number): Promise<Blob> {
    throw new Error('Use Cloudflare Image Resizing URL instead');
  }

  /**
   * 取得圖片 URL
   */
  getImageUrl(tim: string, ext?: string): string {
    const extension = ext || '.jpg';
    return `${this.baseUrl}/img/${tim}${extension}`;
  }

  /**
   * 檢查圖片是否存在
   */
  async exists(tim: string, ext?: string): Promise<boolean> {
    const key = ext ? `img/${tim}${ext}` : `img/${tim}`;
    const object = await this.r2.head(key);
    return object !== null;
  }

  /**
   * 取得檔案資訊
   */
  async getFileInfo(key: string): Promise<{ size: number; uploaded: Date } | null> {
    const object = await this.r2.head(key);
    if (!object) return null;
    return {
      size: object.size || 0,
      uploaded: object.uploaded || new Date(),
    };
  }

  /**
   * 取得總大小
   */
  async getTotalSize(): Promise<number> {
    let total = 0;
    let cursor: string | undefined = undefined;

    do {
      const listed = await this.r2.list({ cursor, limit: 1000 });
      for (const object of listed.objects) {
        total += object.size || 0;
      }
      cursor = (listed as any).cursor;
    } while (cursor);

    return total;
  }

  /**
   * 清理未使用的檔案
   */
  async cleanup(usedFiles: Set<string>): Promise<string[]> {
    const deleted: string[] = [];
    const listed = await this.r2.list();

    for (const object of listed.objects) {
      const key = object.key;
      if (key && !usedFiles.has(key)) {
        await this.r2.delete(key);
        deleted.push(key);
      }
    }

    return deleted;
  }
}
