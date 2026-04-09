/**
 * PIO (Post I/O) Interface for Cloudflare Workers
 * 對應原 PHP 版本的 IPIO 介面
 */

import type { Post, Thread, BanEntry, PaginationParams } from '../types';

export interface PIO {
  /**
   * 取得 PIO 版本
   */
  version(): string;

  /**
   * 初始化連線
   */
  connect(): Promise<void>;

  /**
   * 初始化資料庫
   */
  init(isAddInitData?: boolean): Promise<void>;

  /**
   * 準備資料庫連線
   */
  prepare(reload?: boolean, transaction?: boolean): Promise<void>;

  /**
   * 提交變更
   */
  commit(): Promise<void>;

  /**
   * 維護操作
   */
  maintenance(action: string, doit?: boolean): Promise<boolean>;

  /**
   * 匯入資料
   */
  importData(data: string): Promise<boolean>;

  /**
   * 匯出資料
   */
  exportData(): Promise<string>;

  /**
   * 取得文章數量
   */
  postCount(resno?: number): Promise<number>;

  /**
   * 取得討論串數量
   */
  threadCount(): Promise<number>;

  /**
   * 取得最後文章編號
   */
  getLastPostNo(state: 'beforeCommit' | 'afterCommit'): Promise<number>;

  /**
   * 取得文章列表
   */
  fetchPostList(resno?: number, start?: number, amount?: number): Promise<number[]>;

  /**
   * 取得討論串列表
   */
  fetchThreadList(start?: number, amount?: number, isDESC?: boolean): Promise<number[]>;

  /**
   * 取得文章內容
   */
  fetchPosts(postList: number | number[], fields?: string): Promise<Post[]>;

  /**
   * 新增文章
   */
  addPost(post: Partial<Post>): Promise<number>;

  /**
   * 更新文章
   */
  updatePost(no: number, updates: Partial<Post>): Promise<boolean>;

  /**
   * 刪除舊附件
   */
  delOldAttachments(totalSize: number, storageMax: number, warnOnly?: boolean): Promise<string[]>;

  /**
   * 刪除文章
   */
  removePosts(posts: number[]): Promise<string[]>;

  /**
   * 刪除附件
   */
  removeAttachments(posts: number[], recursion?: boolean): Promise<string[]>;

  /**
   * 取得討論串完整內容
   */
  getThread(threadNo: number, maxReplies?: number, page?: number, perPage?: number): Promise<Thread | null>;

  /**
   * 搜尋文章
   */
  searchPosts(query: string, type?: 'all' | 'subject' | 'content', pagination?: PaginationParams): Promise<Post[]>;

  /**
   * 根據 MD5 查詢文章（用於檔案重複檢查）
   */
  getPostByMD5(md5: string): Promise<Post | null>;
}
