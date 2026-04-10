/**
 * 管理員功能模組
 * 處理管理員 Cap 驗證、權限檢查等
 */

import type { Env } from '../types';

export interface AdminCap {
  enabled: boolean;
  name: string;
  password: string;
  suffix: string;
  allowHtml: boolean;
}

export class AdminSystem {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * 從資料庫或環境變數取得管理員設定
   */
  async getCapConfig(): Promise<AdminCap> {
    // 嘗試從資料庫讀取
    try {
      const capEnabled = await this.env.DB.prepare('SELECT value FROM configs WHERE key = ?')
        .bind('cap_enable')
        .first<{ value: string }>();
      const capName = await this.env.DB.prepare('SELECT value FROM configs WHERE key = ?')
        .bind('cap_name')
        .first<{ value: string }>();
      const capPassword = await this.env.DB.prepare('SELECT value FROM configs WHERE key = ?')
        .bind('cap_password')
        .first<{ value: string }>();
      const capSuffix = await this.env.DB.prepare('SELECT value FROM configs WHERE key = ?')
        .bind('cap_suffix')
        .first<{ value: string }>();
      const capAllowHtml = await this.env.DB.prepare('SELECT value FROM configs WHERE key = ?')
        .bind('cap_allow_html')
        .first<{ value: string }>();

      if (capEnabled && capName && capPassword && capSuffix && capAllowHtml) {
        return {
          enabled: capEnabled.value === '1',
          name: capName.value,
          password: capPassword.value,
          suffix: capSuffix.value,
          allowHtml: capAllowHtml.value === '1',
        };
      }
    } catch (error) {
      console.error('Failed to load cap config from database:', error);
    }

    // 從環境變數讀取（後備）
    const enabled = this.env.ADMIN_CAP_ENABLED === 'true';
    const name = this.env.ADMIN_CAP_NAME || 'futaba';
    const password = this.env.ADMIN_CAP_PASSWORD || '';
    const suffix = this.env.ADMIN_CAP_SUFFIX || ' ★';
    const allowHtml = this.env.ADMIN_CAP_ALLOW_HTML === 'true';

    return {
      enabled,
      name,
      password,
      suffix,
      allowHtml,
    };
  }

  /**
   * 驗證管理員 Cap
   * @param name 名稱
   * @param email Email 欄位（可能包含 #capcode）
   * @returns 是否為管理員及 Cap 名稱
   */
  async verifyCap(name: string, email: string): Promise<{ isAdmin: boolean; capName?: string }> {
    const config = await this.getCapConfig();

    if (!config.enabled) {
      return { isAdmin: false };
    }

    // 檢查名稱是否匹配
    if (name !== config.name) {
      return { isAdmin: false };
    }

    // 檢查 Email 是否包含 #password
    const match = email.match(/#(.+)$/);
    if (!match) {
      return { isAdmin: false };
    }

    const password = match[1];
    if (password !== config.password) {
      return { isAdmin: false };
    }

    return {
      isAdmin: true,
      capName: config.name,
    };
  }

  /**
   * 驗證管理員登入密碼
   */
  async verifyAdminPassword(password: string): Promise<boolean> {
    const adminPassword = this.env.ADMIN_PASSWORD || '';
    if (!adminPassword) {
      return false;
    }

    // 計算輸入密碼的 hash
    const hash = await this.hashPassword(password);
    const storedHash = await this.getStoredAdminHash();

    return hash === storedHash;
  }

  /**
   * 驗證密碼（別名）
   */
  async verifyPassword(password: string): Promise<boolean> {
    return this.verifyAdminPassword(password);
  }

  /**
   * 管理員登入
   */
  async login(password: string): Promise<{ token: string; username: string } | null> {
    const isValid = await this.verifyPassword(password);
    if (!isValid) {
      return null;
    }

    const token = await this.generateSessionToken();
    await this.createSession(token);
    
    return {
      token,
      username: 'admin',
    };
  }

  /**
   * 雜湊密碼
   */
  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'pixmicat-admin-salt');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * 取得儲存的管理員密碼 hash
   */
  private async getStoredAdminHash(): Promise<string> {
    // 從環境變數或 KV 讀取
    const envHash = this.env.ADMIN_PASSWORD_HASH;
    if (envHash) {
      return envHash;
    }

    // 從 KV 讀取
    const kvHash = await this.env.KV.get('admin:password_hash');
    if (kvHash) {
      return kvHash;
    }

    // 如果都沒有，使用環境變數的密碼生成 hash
    const adminPassword = this.env.ADMIN_PASSWORD || '';
    if (adminPassword) {
      const hash = await this.hashPassword(adminPassword);
      // 快取到 KV
      await this.env.KV.put('admin:password_hash', hash, { expirationTtl: 86400 });
      return hash;
    }

    return '';
  }

  /**
   * 產生管理員 Session Token
   */
  async generateSessionToken(): Promise<string> {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * 驗證 Session Token
   */
  async verifySessionToken(token: string): Promise<boolean> {
    const stored = await this.env.KV.get(`admin:session:${token}`);
    return stored !== null;
  }

  /**
   * 建立管理員 Session
   */
  async createSession(token: string, expiresIn: number = 3600): Promise<{ username: string; token: string }> {
    const sessionData = JSON.stringify({ username: 'admin', createdAt: Date.now() });
    await this.env.KV.put(`admin:session:${token}`, sessionData, {
      expirationTtl: expiresIn,
    });
    
    return {
      username: 'admin',
      token,
    };
  }

  /**
   * 刪除管理員 Session
   */
  async deleteSession(token: string): Promise<void> {
    await this.env.KV.delete(`admin_session:${token}`);
  }

  /**
   * 取得管理員 Session
   */
  async getSession(token: string): Promise<{ username: string } | null> {
    const stored = await this.env.KV.get(`admin:session:${token}`);
    if (!stored) {
      return null;
    }
    
    try {
      const session = JSON.parse(stored);
      return session;
    } catch {
      return null;
    }
  }

  /**
   * 檢查是否為管理員請求
   */
  async isAdminRequest(request: Request): Promise<boolean> {
    // 嘗試從 Cookie 獲取
    const cookie = request.headers.get('Cookie') || '';
    const cookieMatch = cookie.match(/admin_session=([^;]+)/);
    if (cookieMatch) {
      const token = cookieMatch[1];
      return await this.verifySessionToken(token);
    }

    // 嘗試從 Authorization header 獲取
    const auth = request.headers.get('Authorization');
    if (auth) {
      // Format: Bearer <token>
      const bearerMatch = auth.match(/^Bearer\s+(.+)$/);
      if (bearerMatch) {
        const token = bearerMatch[1];
        return await this.verifySessionToken(token);
      }
    }

    return false;
  }
}
