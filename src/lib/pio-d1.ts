/**
 * PIO D1 Implementation
 * 使用 Cloudflare D1 實作 PIO 介面
 */

import type { PIO } from './pio-interface';
import type { Post, Thread, PaginationParams, Env } from '../types';

export class PIOD1 implements PIO {
  private db: D1Database;
  private lastPostNo: number = 0;
  private initialized: boolean = false;

  constructor(db: D1Database) {
    this.db = db;
  }

  version(): string {
    return '0.1.0-d1';
  }

  async connect(): Promise<void> {
    // D1 連線由 Cloudflare 自動管理，無需手動連線
  }

  async init(isAddInitData: boolean = true): Promise<void> {
    // D1 使用 migrations 初始化，這裡可以選擇性地加入預設資料
    if (isAddInitData) {
      // 可以在這裡加入初始化文章
    }
  }

  async prepare(reload: boolean = false, transaction: boolean = false): Promise<void> {
    if (reload || !this.initialized) {
      this.initialized = true;
    }
  }

  async commit(): Promise<void> {
    // D1 自動提交
  }

  async maintenance(action: string, doit: boolean = false): Promise<boolean> {
    const actions = ['optimize', 'vacuum', 'analyze'];
    if (!actions.includes(action)) {
      return false;
    }

    if (!doit) {
      return true;
    }

    try {
      if (action === 'vacuum') {
        await this.db.run('VACUUM');
      } else if (action === 'analyze') {
        await this.db.run('ANALYZE');
      }
      return true;
    } catch (error) {
      console.error('Maintenance error:', error);
      return false;
    }
  }

  async importData(data: string): Promise<boolean> {
    // TODO: 實作資料匯入
    return false;
  }

  async exportData(): Promise<string> {
    // TODO: 實作資料匯出
    return '';
  }

  async postCount(resno?: number): Promise<number> {
    const stmt = resno
      ? this.db.prepare('SELECT COUNT(*) as count FROM posts WHERE resto = ?')
      : this.db.prepare('SELECT COUNT(*) as count FROM posts');

    const result = resno
      ? await stmt.bind(resno).first<{ count: number }>()
      : await stmt.first<{ count: number }>();

    return result?.count || 0;
  }

  async threadCount(): Promise<number> {
    const result = await this.db
      .prepare('SELECT COUNT(DISTINCT CASE WHEN resto = 0 THEN no ELSE resto END) as count FROM posts')
      .first<{ count: number }>();

    return result?.count || 0;
  }

  async getLastPostNo(state: 'beforeCommit' | 'afterCommit'): Promise<number> {
    if (state === 'beforeCommit') {
      return this.lastPostNo;
    }

    const result = await this.db
      .prepare('SELECT MAX(no) as max_no FROM posts')
      .first<{ max_no: number }>();

    this.lastPostNo = result?.max_no || 0;
    return this.lastPostNo;
  }

  async fetchPostList(resno: number = 0, start: number = 0, amount: number = 0): Promise<number[]> {
    let query = 'SELECT no FROM posts';
    const params: any[] = [];

    if (resno > 0) {
      query += ' WHERE resto = ?';
      params.push(resno);
    } else {
      query += ' WHERE resto = 0';
    }

    query += ' ORDER BY ';
    if (resno > 0) {
      query += 'time ASC';
    } else {
      query += 'sticky DESC, time DESC';
    }

    if (amount > 0) {
      query += ' LIMIT ? OFFSET ?';
      params.push(amount, start);
    }

    const stmt = this.db.prepare(query);
    const bound = stmt.bind(...params);
    const results = await bound.all<{ no: number }>();

    return results.results.map(r => r.no);
  }

  async fetchThreadList(start: number = 0, amount: number = 0, isDESC: boolean = false): Promise<number[]> {
    const threadNos = await this.db
      .prepare(`
        SELECT DISTINCT CASE WHEN resto = 0 THEN no ELSE resto END as thread_no
        FROM posts
        ORDER BY thread_no ${isDESC ? 'DESC' : 'ASC'}
        ${amount > 0 ? 'LIMIT ? OFFSET ?' : ''}
      `)
      .bind(...(amount > 0 ? [amount, start] : []))
      .all<{ thread_no: number }>();

    return threadNos.results.map(r => r.thread_no);
  }

  async fetchPosts(postList: number | number[], fields: string = '*'): Promise<Post[]> {
    const nos = Array.isArray(postList) ? postList : [postList];
    if (nos.length === 0) return [];

    const placeholders = nos.map(() => '?').join(',');
    const query = `SELECT ${fields} FROM posts WHERE no IN (${placeholders}) ORDER BY time ASC`;

    const stmt = this.db.prepare(query);
    const bound = stmt.bind(...nos);

    const results = await bound.all<Post>();
    return results.results;
  }

  async addPost(post: Partial<Post>): Promise<number> {
    // 取得最新編號
    const lastNo = await this.getLastPostNo('afterCommit');
    const newNo = lastNo + 1;
    this.lastPostNo = newNo;

    const now = Math.floor(Date.now() / 1000);

    const result = await this.db
      .prepare(`
        INSERT INTO posts (
          no, resto, name, email, sub, com, password,
          time, md5, filename, ext, w, h, tn_w, tn_h,
          tim, filesize, category, sticky, locked,
          status, ip, uid, last_modified, root, is_sage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        newNo,
        post.resto || 0,
        post.name || '無名氏',
        post.email || '',
        post.sub || '',
        post.com || '',
        post.password || '',
        post.time || now,
        post.md5 || '',
        post.filename || '',
        post.ext || '',
        post.w || 0,
        post.h || 0,
        post.tn_w || 0,
        post.tn_h || 0,
        post.tim || '',
        post.filesize || 0,
        post.category || '',
        post.sticky || 0,
        post.locked || 0,
        post.status || 0,
        post.ip || '',
        post.uid || '',
        post.last_modified || now,
        post.root || (post.resto === 0 ? newNo : post.resto),
        post.is_sage || 0
      )
      .run();

    if (!result.success) {
      throw new Error('Failed to insert post');
    }

    return newNo;
  }

  async updatePost(no: number, updates: Partial<Post>): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'no' && key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return false;

    values.push(no);
    const query = `UPDATE posts SET ${fields.join(', ')}, last_modified = ? WHERE no = ?`;
    values.push(Math.floor(Date.now() / 1000));

    const result = await this.db.prepare(query).bind(...values).run();
    return result.success && (result.meta?.changes ?? 0) > 0;
  }

  async delOldAttachments(totalSize: number, storageMax: number, warnOnly: boolean = true): Promise<string[]> {
    if (totalSize < storageMax) return [];

    // 找出最舊的有附件的文章
    const posts = await this.db
      .prepare(`
        SELECT tim, ext FROM posts
        WHERE tim != '' AND ext != ''
        ORDER BY time ASC
      `)
      .all<{ tim: string; ext: string }>();

    const filesToDelete: string[] = [];
    let accumulatedSize = 0;

    for (const post of posts.results) {
      const fileKey = `${post.tim}${post.ext}`;
      const thumbKey = `${post.tim}s.jpg`;
      filesToDelete.push(fileKey, thumbKey);

      // 假設我們有檔案大小資訊
      accumulatedSize += 500000; // 估計值

      if (!warnOnly && accumulatedSize >= (totalSize - storageMax)) {
        break;
      }
    }

    if (!warnOnly && filesToDelete.length > 0) {
      const nos = posts.results.slice(0, filesToDelete.length / 2).map(p => parseInt(p.tim));
      await this.removeAttachments(nos, false);
    }

    return filesToDelete;
  }

  async removePosts(posts: number[]): Promise<string[]> {
    if (posts.length === 0) return [];

    // 先取得附件列表
    const attachments = await this.removeAttachments(posts, true);

    // 刪除文章
    const placeholders = posts.map(() => '?').join(',');
    await this.db
      .prepare(`DELETE FROM posts WHERE no IN (${placeholders})`)
      .bind(...posts)
      .run();

    return attachments;
  }

  async removeAttachments(posts: number[], recursion: boolean = false): Promise<string[]> {
    if (posts.length === 0) return [];

    const placeholders = posts.map(() => '?').join(',');
    let query = `SELECT tim, ext FROM posts WHERE no IN (${placeholders}) AND tim != ''`;

    if (recursion) {
      // 也包含回應的附件
      query = `
        SELECT tim, ext FROM posts
        WHERE no IN (${placeholders})
          OR resto IN (${placeholders})
          OR root IN (SELECT CASE WHEN resto = 0 THEN no ELSE resto END FROM posts WHERE no IN (${placeholders}))
      `;
    }

    const result = recursion
      ? await this.db.prepare(query).bind(...posts, ...posts, ...posts).all<{ tim: string; ext: string }>()
      : await this.db.prepare(query).bind(...posts).all<{ tim: string; ext: string }>();

    const files: string[] = [];
    for (const row of result.results) {
      if (row.tim && row.ext) {
        files.push(`${row.tim}${row.ext}`);
        files.push(`${row.tim}s.jpg`); // 縮圖
      }
    }

    if (!recursion) {
      // 清除附件欄位
      await this.db
        .prepare(`UPDATE posts SET tim = '', ext = '', filename = '', md5 = '', w = 0, h = 0, tn_w = 0, tn_h = 0, filesize = 0 WHERE no IN (${placeholders})`)
        .bind(...posts)
        .run();
    }

    return files;
  }

  async getThread(threadNo: number, maxReplies: number = 0, page: number = 1, perPage: number = 0): Promise<Thread | null> {
    // 先取得 OP
    const opPosts = await this.fetchPosts(threadNo);
    if (opPosts.length === 0) {
      return null;
    }

    // 取得所有回應
    const replyNos = await this.fetchPostList(threadNo);
    const allReplies = await this.fetchPosts(replyNos);

    // 處理分頁邏輯
    let replies = allReplies;
    let totalReplyPages = 1;
    let currentReplyPage = 1;

    if (perPage > 0) {
      // RE_PAGE_DEF 模式：啟用分頁
      totalReplyPages = Math.ceil(allReplies.length / perPage) || 1;
      currentReplyPage = Math.min(page, totalReplyPages);

      const startIndex = (currentReplyPage - 1) * perPage;
      const endIndex = startIndex + perPage;
      replies = allReplies.slice(startIndex, endIndex);
    } else if (maxReplies > 0 && allReplies.length > maxReplies) {
      // RE_DEF 模式：只顯示最後幾個回應
      replies = allReplies.slice(-maxReplies);
    }

    const posts = [...opPosts, ...replies];
    const op = opPosts[0];

    // 計算 last_reply_time 時，跳過 sage 回應（不推文）
    const nonSageReplies = allReplies.filter(r => !r.is_sage);
    const lastReplyTime = nonSageReplies.length > 0 
      ? nonSageReplies[nonSageReplies.length - 1].time 
      : op.time;

    return {
      no: threadNo,
      resto: op.resto,
      posts,
      reply_count: allReplies.length, // 總回應數（不受 maxReplies/perPage 影響）
      image_count: posts.filter(p => p.tim && p.ext).length,
      last_reply_time: lastReplyTime,
      sticky: op.sticky || 0,
      locked: op.locked || 0,
      // 分頁資訊
      pagination: perPage > 0 ? {
        current_page: currentReplyPage,
        total_pages: totalReplyPages,
        per_page: perPage,
        total_items: allReplies.length,
      } : undefined,
    };
  }

  async searchPosts(query: string, type: 'all' | 'subject' | 'content' = 'all', pagination?: PaginationParams): Promise<Post[]> {
    let sql = 'SELECT * FROM posts WHERE 1=1';
    const params: any[] = [];
    const searchTerm = `%${query}%`;

    if (type === 'subject') {
      sql += ' AND sub LIKE ?';
      params.push(searchTerm);
    } else if (type === 'content') {
      sql += ' AND com LIKE ?';
      params.push(searchTerm);
    } else {
      sql += ' AND (sub LIKE ? OR com LIKE ?)';
      params.push(searchTerm, searchTerm);
    }

    sql += ' ORDER BY time DESC';

    if (pagination?.limit) {
      sql += ' LIMIT ?';
      params.push(pagination.limit);

      if (pagination.offset) {
        sql += ' OFFSET ?';
        params.push(pagination.offset);
      }
    }

    const stmt = this.db.prepare(sql);
    const bound = stmt.bind(...params);

    const result = await bound.all<Post>();
    return result.results;
  }

  async getPostsByCategory(category: string, pagination?: PaginationParams): Promise<Post[]> {
    let sql = 'SELECT * FROM posts WHERE category = ?';
    const params: any[] = [category];

    sql += ' ORDER BY time DESC';

    if (pagination?.limit) {
      sql += ' LIMIT ?';
      params.push(pagination.limit);

      if (pagination.offset) {
        sql += ' OFFSET ?';
        params.push(pagination.offset);
      }
    }

    const stmt = this.db.prepare(sql);
    const bound = stmt.bind(...params);
    const result = await bound.all<Post>();
    return result.results;
  }

  /**
   * 根據 MD5 查詢文章（用於檔案重複檢查）
   */
  async getPostByMD5(md5: string): Promise<Post | null> {
    const stmt = this.db.prepare('SELECT * FROM posts WHERE md5 = ? AND md5 != ""');
    const result = await stmt.bind(md5).first<Post>();
    return result || null;
  }
}
