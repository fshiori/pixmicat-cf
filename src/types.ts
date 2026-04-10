/**
 * Type Definitions for Pixmicat Cloudflare Workers
 */

export interface Post {
  no: number;
  resto: number;
  time: number;
  name: string;
  email: string;
  sub: string;
  com: string;
  password?: string;
  tim?: string;
  ext?: string;
  filename?: string;
  filesize?: number;
  w?: number;
  h?: number;
  thumbnail_w?: number;
  thumbnail_h?: number;
  tn_w?: number;
  tn_h?: number;
  md5?: string;
  category?: string;
  sticky?: number;
  locked?: number;
  is_sage?: number;
  status?: number;
  ip?: string;
  uid?: string;
  host?: string;
  last_modified?: number;
  root?: number;
  reply_count?: number;
  thumbnail?: string;
}

export interface ThreadPagination {
  current_page: number;
  total_pages: number;
  per_page: number;
  total_items: number;
}

export interface Thread {
  no: number;
  resto: number;
  posts: Post[];
  reply_count: number;
  image_count: number;
  last_reply_time: number;
  sticky: number;
  locked: number;
  pagination?: ThreadPagination;
}

export interface BanEntry {
  id: number;
  ip: string;
  reason: string;
  created_at: number;
  expires_at: number | null;
  created_by: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface ImageInfo {
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  md5: string;
  width: number;
  height: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  storageKey: string;
  thumbnailKey: string;
  tim: string;
}

export interface FileIO {
  version(): string;
  init(): Promise<void>;
  saveImage(image: File | Uint8Array, filename: string, tim: string): Promise<ImageInfo>;
  saveThumbnail(thumbnail: Blob, tim: string): Promise<void>;
  deleteImage(tim: string, ext?: string): Promise<void>;
  getImageUrl(tim: string, ext?: string): string;
  getThumbnailUrl(tim: string, ext?: string, maxWidth?: number, maxHeight?: number, quality?: number): string;
  exists(tim: string, ext?: string): Promise<boolean>;
  getFileInfo(key: string): Promise<{ size: number; uploaded: Date } | null>;
  calculateMD5(file: File | Uint8Array): Promise<string>;
  validateImage(file: File): Promise<boolean>;
  resizeImage(image: ArrayBuffer, maxWidth: number, maxHeight: number, quality?: number): Promise<Blob>;
  getImageDimensions(image: ArrayBuffer): Promise<{ width: number; height: number }>;
  getTotalSize(): Promise<number>;
  cleanup(usedFiles: Set<string>): Promise<string[]>;
}

export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  KV: KVNamespace;
  DEFAULT_LANGUAGE?: string;
  TIME_ZONE?: string;
  ENVIRONMENT?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  // Admin CAPTCHA settings
  ADMIN_CAP_ENABLED?: string;
  ADMIN_CAP_NAME?: string;
  ADMIN_CAP_PASSWORD?: string;
  ADMIN_CAP_SUFFIX?: string;
  ADMIN_CAP_ALLOW_HTML?: string;
  // Admin password
  ADMIN_PASSWORD?: string;
  ADMIN_PASSWORD_HASH?: string;
}
