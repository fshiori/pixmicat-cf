/**
 * FileIO R2 Implementation
 * 使用 Cloudflare R2 實作 FileIO 介面
 */

import type { FileIO } from './fileio-interface';
import type { ImageInfo, Env } from '../types';
import { calculateMD5 } from './md5';

export class FileIOR2 implements FileIO {
  private r2: R2Bucket;

  constructor(r2: R2Bucket) {
    this.r2 = r2;
  }

  version(): string {
    return '0.1.0-r2';
  }

  async init(): Promise<void> {
    // R2 無需初始化
  }

  async saveImage(image: File, filename: string, tim: string): Promise<ImageInfo> {
    const ext = '.' + filename.split('.').pop();
    const key = `${tim}${ext}`;

    await this.r2.put(key, image);

    const md5 = await this.calculateMD5(image);
    const arrayBuffer = await image.arrayBuffer();
    const dimensions = await this.getImageDimensions(arrayBuffer);

    return {
      originalName: filename,
      extension: ext,
      mimeType: image.type,
      size: image.size,
      md5,
      width: dimensions.width,
      height: dimensions.height,
      thumbnailWidth: 0,
      thumbnailHeight: 0,
      storageKey: key,
      thumbnailKey: '',
      tim,
    };
  }

  async saveThumbnail(thumbnail: Blob, tim: string): Promise<void> {
    // No-op: thumbnails are generated dynamically by CDN
    // This method exists for API compatibility but does nothing
    return Promise.resolve();
  }

  async deleteImage(tim: string, ext: string): Promise<void> {
    try {
      await this.r2.delete(`${tim}${ext}`);
      await this.r2.delete(`${tim}s.jpg`); // 縮圖
    } catch (error) {
      // 忽略刪除錯誤，可能檔案不存在
      // 符合 interface 預期：deleteImage 返回 void，不應該拋出錯誤
    }
  }

  getImageUrl(tim: string, ext: string): string {
    // 使用 R2 公開域名
    return `https://r2.pixmicat.dcard.dev/${tim}${ext}`;
  }

  getThumbnailUrl(tim: string, ext?: string, maxWidth?: number, maxHeight?: number): string {
    // 使用 Cloudflare Image Resizing
    const originalUrl = this.getImageUrl(tim, ext || '.jpg');
    const width = maxWidth || 250;
    const height = maxHeight || 250;
    const quality = 75;
    
    // Cloudflare Image Resizing URL 格式
    return `https://r2.pixmicat.dcard.dev/cdn-cgi/image/width=${width},height=${height},quality=${quality},format=auto,fit=cover/${tim}${ext || '.jpg'}`;
  }

  async exists(tim: string, ext: string): Promise<boolean> {
    const obj = await this.r2.head(`${tim}${ext}`);
    return obj !== null;
  }

  async getFileInfo(key: string): Promise<{ size: number; uploaded: Date } | null> {
    const obj = await this.r2.head(key);
    if (!obj) return null;

    return {
      size: obj.size,
      uploaded: obj.uploaded,
    };
  }

  async calculateMD5(file: File | Uint8Array): Promise<string> {
    return calculateMD5(file);
  }

  async validateImage(file: File): Promise<boolean> {
    // 基礎圖片類型（支援顯示）
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/x-windows-bmp'
    ];

    // SWF Flash 檔案（不支援顯示尺寸，只允許上傳）
    const swfTypes = ['application/x-shockwave-flash'];

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (allowedTypes.includes(file.type)) {
      try {
        await this.getImageDimensions(await file.arrayBuffer());
        return true;
      } catch {
        return false;
      }
    }

    // SWF 檢查
    if (swfTypes.includes(file.type) || ext === 'swf') {
      return this.validateSWF(await file.arrayBuffer());
    }

    return false;
  }

  // 驗證 SWF 檔案格式
  private validateSWF(buffer: ArrayBuffer): boolean {
    if (buffer.byteLength < 3) return false;

    const view = new DataView(buffer);
    // SWF 檔頭檢查：FWS（未壓縮）或 CWS（壓縮）或 ZWS（LZMA 壓縮）
    const signature = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2)
    );

    return ['FWS', 'CWS', 'ZWS'].includes(signature);
  }

  async resizeImage(
    image: ArrayBuffer,
    maxWidth: number,
    maxHeight: number,
    quality: number = 0.75
  ): Promise<Blob> {
    throw new Error(
      'Use getThumbnailUrl() for Cloudflare Image Resizing CDN instead of resizeImage(). ' +
      'The CDN handles thumbnail generation dynamically.'
    );
  }

  async generateThumbnail(
    image: Uint8Array,
    maxWidth: number,
    maxHeight: number,
    quality: number = 0.75
  ): Promise<Blob> {
    throw new Error(
      'Use getThumbnailUrl() for Cloudflare Image Resizing CDN instead of generateThumbnail(). ' +
      'The CDN handles thumbnail generation dynamically.'
    );
  }

  async getImageDimensions(image: ArrayBuffer): Promise<{ width: number; height: number }> {
    const view = new DataView(image);

    // JPEG
    if (view.getUint16(0) === 0xFFD8) {
      let offset = 2;
      while (offset < view.byteLength) {
        const marker = view.getUint16(offset);
        offset += 2;
        if (marker === 0xFFC0 || marker === 0xFFC2) {
          const height = view.getUint16(offset + 3);
          const width = view.getUint16(offset + 5);
          return { width, height };
        }
        offset += view.getUint16(offset);
      }
    }

    // PNG
    if (view.getUint32(0) === 0x89504E47) {
      const width = view.getUint32(16);
      const height = view.getUint32(20);
      return { width, height };
    }

    // GIF
    if (view.getUint16(0) === 0x4749) {
      const width = view.getUint16(6, true); // little-endian
      const height = view.getUint16(8, true); // little-endian
      return { width, height };
    }

    // BMP
    if (view.getUint16(0, false) === 0x424D) { // 'BM' in big-endian
      // BMP 檔頭結構
      // offset 18-21: width
      // offset 22-25: height
      const width = view.getUint32(18, true); // little-endian
      const height = view.getUint32(22, true); // little-endian
      return { width, height };
    }

    throw new Error('Unsupported image format');
  }

  async getTotalSize(): Promise<number> {
    // R2 不直接提供總大小 API
    // 可以列出所有物件並累加，但這在大量檔案時不實際
    // 建議在資料庫中維護總大小

    let total = 0;
    const listed = await this.r2.list();
    for (const object of listed.objects) {
      total += object.size;
    }

    // 處理分頁
    let cursor = (listed as any).cursor;
    while (cursor) {
      const page = await this.r2.list({ cursor });
      for (const object of page.objects) {
        total += object.size;
      }
      cursor = (page as any).cursor;
    }

    return total;
  }

  async cleanup(usedFiles: Set<string>): Promise<string[]> {
    const listed = await this.r2.list();
    const deleted: string[] = [];

    for (const object of listed.objects) {
      const key = object.key;
      // 檢查是否在使用中
      const tim = key.includes('s.jpg') ? key.replace('s.jpg', '') : key.replace(/\.[^.]+$/, '');
      if (!usedFiles.has(tim)) {
        await this.r2.delete(key);
        deleted.push(key);
      }
    }

    // 處理分頁
    let cursor = (listed as any).cursor;
    while (cursor) {
      const page = await this.r2.list({ cursor });
      for (const object of page.objects) {
        const key = object.key;
        const tim = key.includes('s.jpg') ? key.replace('s.jpg', '') : key.replace(/\.[^.]+$/, '');
        if (!usedFiles.has(tim)) {
          await this.r2.delete(key);
          deleted.push(key);
        }
      }
      cursor = (page as any).cursor;
    }

    return deleted;
  }
}
