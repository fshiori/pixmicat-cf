/**
 * FileIO Interface for Cloudflare Workers
 * 處理檔案儲存和讀取 (主要用於圖片和縮圖)
 */

import type { ImageInfo } from '../types';

export interface FileIO {
  /**
   * 取得 FileIO 版本
   */
  version(): string;

  /**
   * 初始化
   */
  init(): Promise<void>;

  /**
   * 儲存圖片
   */
  saveImage(
    image: File,
    filename: string,
    tim: string
  ): Promise<ImageInfo>;

  /**
   * 儲存縮圖
   */
  saveThumbnail(
    thumbnail: Blob,
    tim: string
  ): Promise<void>;

  /**
   * 刪除圖片和縮圖
   */
  deleteImage(tim: string, ext: string): Promise<void>;

  /**
   * 取得圖片 URL
   */
  getImageUrl(tim: string, ext: string): string;

  /**
   * 取得縮圖 URL
   */
  getThumbnailUrl(tim: string): string;

  /**
   * 檢查檔案是否存在
   */
  exists(tim: string, ext: string): Promise<boolean>;

  /**
   * 取得檔案資訊
   */
  getFileInfo(key: string): Promise<{ size: number; uploaded: Date } | null>;

  /**
   * 計算 MD5
   */
  calculateMD5(file: File): Promise<string>;

  /**
   * 驗證圖片格式
   */
  validateImage(file: File): Promise<boolean>;

  /**
   * 調整圖片大小
   */
  resizeImage(
    image: ArrayBuffer,
    maxWidth: number,
    maxHeight: number,
    quality?: number
  ): Promise<Blob>;

  /**
   * 取得圖片尺寸
   */
  getImageDimensions(image: ArrayBuffer): Promise<{ width: number; height: number }>;

  /**
   * 計算儲存空間使用量
   */
  getTotalSize(): Promise<number>;

  /**
   * 清理未使用的檔案
   */
  cleanup(usedFiles: Set<string>): Promise<string[]>;
}
