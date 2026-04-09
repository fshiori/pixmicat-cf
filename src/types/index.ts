// 資料庫類型定義

export interface Post {
  id: number;
  no: number;
  resto: number; // 0 = OP, >0 = reply
  name: string;
  email: string;
  sub: string;
  com: string;
  password: string;
  time: number;
  md5?: string;
  filename?: string;
  ext?: string;
  w?: number;
  h?: number;
  tn_w?: number;
  tn_h?: number;
  tim?: string;
  filesize?: number;
  category?: string;
  sticky?: number;
  locked?: number;
  status?: number;
  ip?: string;
  uid?: string;
  last_modified?: number;
  root?: number;
  is_sage?: number; // 是否為 sage (不推文)
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
}

export interface Config {
  key: string;
  value: string;
  description?: string;
  updated_at: number;
}

export interface BanEntry {
  id: number;
  type: 'ip' | 'hostname' | 'md5' | 'string';
  pattern: string;
  created_at: number;
  created_by?: string;
  reason?: string;
  expires_at: number;
}

export interface ModerationLog {
  id: number;
  action: string;
  target_no?: number;
  target_type?: string;
  reason?: string;
  moderator?: string;
  created_at: number;
}

// Cloudflare Workers 環境類型
export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  KV: KVNamespace;
  ENVIRONMENT: string;
  TIME_ZONE: string;
  DEFAULT_LANGUAGE: string;
}

// 請求上下文
export interface RequestContext {
  ip: string;
  userAgent: string;
  isSecure: boolean;
  host: string;
}

// 表單資料
export interface PostFormData {
  name?: string;
  email?: string;
  sub?: string;
  com?: string;
  resto?: string;
  upfile?: File;
  password?: string;
  category?: string;
  posttime?: string;
}

// API 回應
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 分頁參數
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

// 搜尋參數
export interface SearchParams {
  query?: string;
  type?: 'all' | 'op' | 'subject' | 'content';
  page?: number;
}

// 圖片資訊
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

// 管理員 Cap
export interface AdminCap {
  enabled: boolean;
  name: string;
  password: string;
  suffix: string;
  allowHtml: boolean;
}
