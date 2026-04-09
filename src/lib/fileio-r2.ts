/**
 * FileIO R2 Implementation
 * 使用 Cloudflare R2 實作 FileIO 介面
 */

import type { FileIO } from './fileio-interface';
import type { ImageInfo, Env } from '../types';

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
    const key = `${tim}s.jpg`;
    await this.r2.put(key, thumbnail);
  }

  async deleteImage(tim: string, ext: string): Promise<void> {
    await this.r2.delete(`${tim}${ext}`);
    await this.r2.delete(`${tim}s.jpg`); // 縮圖
  }

  getImageUrl(tim: string, ext: string): string {
    return `/img/${tim}${ext}`;
  }

  getThumbnailUrl(tim: string): string {
    return `/thumb/${tim}s.jpg`;
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

  async calculateMD5(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('MD5', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async validateImage(file: File): Promise<boolean> {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return false;
    }

    try {
      await this.getImageDimensions(await file.arrayBuffer());
      return true;
    } catch {
      return false;
    }
  }

  async resizeImage(
    image: ArrayBuffer,
    maxWidth: number,
    maxHeight: number,
    quality: number = 0.85
  ): Promise<Blob> {
    // 在 Cloudflare Workers 中，我們使用簡化策略：
    // 如果圖片已經小於指定尺寸，直接返回原始圖片
    // 否則返回原始圖片（由客戶端或 CDN 處理縮放）
    
    const dimensions = await this.getImageDimensions(image);
    
    // 如果圖片已經小於目標尺寸，不需要縮圖
    if (dimensions.width <= maxWidth && dimensions.height <= maxHeight) {
      return new Blob([image], { type: 'image/jpeg' });
    }
    
    // TODO: 實現真正的縮圖生成
    // 選項：
    // 1. 使用 Cloudflare Images API（需要付費）
    // 2. 使用外部服務（如 Cloudinary, imgix）
    // 3. 在客戶端生成縮圖後上傳
    
    // 目前策略：返回原始圖片，由瀏覽器 CSS 處理顯示尺寸
    return new Blob([image], { type: 'image/jpeg' });
  }

  async getImageDimensions(image: ArrayBuffer): Promise<{ width: number; height: number }> {
    // 簡化版：從 JPEG/PNG header 讀取尺寸
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
      const width = view.getUint16(6);
      const height = view.getUint16(8);
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
    let cursor = listed.cursor;
    while (cursor) {
      const page = await this.r2.list({ cursor });
      for (const object of page.objects) {
        total += object.size;
      }
      cursor = page.cursor;
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
    let cursor = listed.cursor;
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
      cursor = page.cursor;
    }

    return deleted;
  }
}
