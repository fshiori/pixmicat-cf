/**
 * AdminSystem 單元測試
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminSystem } from '../src/lib/admin';
import type { MockEnv } from './types';

describe('AdminSystem', () => {
  let mockEnv: MockEnv;
  let admin: AdminSystem;

  beforeEach(() => {
    // 創建模擬環境
    mockEnv = {
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            all: vi.fn(() => Promise.resolve({ results: [] })),
            first: vi.fn(() => Promise.resolve(null)),
            run: vi.fn(() => Promise.resolve({ meta: {} })),
          })),
        })),
        batch: vi.fn(() => Promise.resolve([])),
        exec: vi.fn(() => Promise.resolve()),
      },
      STORAGE: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
      },
      KV: {
        get: vi.fn((key: string) => {
          // 模擬 session token
          if (key === 'admin_session:test_token') {
            return Promise.resolve(JSON.stringify({
              username: 'admin',
              loginTime: Date.now(),
            }));
          }
          return Promise.resolve(null);
        }),
        put: vi.fn(),
        delete: vi.fn(),
      },
    };

    admin = new AdminSystem(mockEnv as any);
  });

  describe('verifyPassword', () => {
    it('應該驗證正確的密碼', async () => {
      const testPassword = 'test123456';
      const hash = await admin.hashPassword(testPassword);

      const result = await admin.verifyPassword(testPassword, hash);
      expect(result).toBe(true);
    });

    it('應該拒絕錯誤的密碼', async () => {
      const correctPassword = 'correct_password';
      const hash = await admin.hashPassword(correctPassword);

      const result = await admin.verifyPassword('wrong_password', hash);
      expect(result).toBe(false);
    });

    it('應該拒絕空密碼', async () => {
      const result = await admin.verifyPassword('', 'any_hash');
      expect(result).toBe(false);
    });

    it('應該拒絕空 hash', async () => {
      const result = await admin.verifyPassword('password', '');
      expect(result).toBe(false);
    });
  });

  describe('hashPassword', () => {
    it('應該生成一致的 hash', async () => {
      const password = 'test_password';
      const hash1 = await admin.hashPassword(password);
      const hash2 = await admin.hashPassword(password);

      expect(hash1).toBe(hash2);
    });

    it('應該為不同密碼生成不同 hash', async () => {
      const hash1 = await admin.hashPassword('password1');
      const hash2 = await admin.hashPassword('password2');

      expect(hash1).not.toBe(hash2);
    });

    it('應該生成固定長度的 hash', async () => {
      const hash = await admin.hashPassword('test_password');
      expect(hash).toHaveLength(64); // SHA-256 hex 是 64 字符
    });
  });

  describe('isAdminRequest', () => {
    it('應該驗證有效的 session token', async () => {
      const mockRequest = {
        headers: {
          get: vi.fn((header: string) => {
            if (header === 'Cookie') return 'admin_session=test_token';
            return null;
          }),
        },
      } as any;

      const result = await admin.isAdminRequest(mockRequest);
      expect(result).toBe(true);
    });

    it('應該拒絕無效的 session token', async () => {
      mockEnv.KV.get = vi.fn(() => Promise.resolve(null));

      const mockRequest = {
        headers: {
          get: vi.fn((header: string) => {
            if (header === 'Cookie') return 'admin_session=invalid_token';
            return null;
          }),
        },
      } as any;

      const result = await admin.isAdminRequest(mockRequest);
      expect(result).toBe(false);
    });

    it('應該拒絕沒有 cookie 的請求', async () => {
      const mockRequest = {
        headers: {
          get: vi.fn(() => null),
        },
      } as any;

      const result = await admin.isAdminRequest(mockRequest);
      expect(result).toBe(false);
    });

    it('應該從 Authorization header 驗證', async () => {
      mockEnv.KV.get = vi.fn((key: string) => {
        if (key === 'admin_session:auth_token') {
          return Promise.resolve(JSON.stringify({
            username: 'admin',
            loginTime: Date.now(),
          }));
        }
        return Promise.resolve(null);
      });

      const mockRequest = {
        headers: {
          get: vi.fn((header: string) => {
            if (header === 'Authorization') return 'Bearer auth_token';
            return null;
          }),
        },
      } as any;

      const result = await admin.isAdminRequest(mockRequest);
      expect(result).toBe(true);
    });
  });

  describe('login', () => {
    it('應該成功登入正確憑證', async () => {
      const password = 'test123456';
      const hash = await admin.hashPassword(password);

      // 模擬從資料庫取得 hash
      mockEnv.DB.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve({
            password_hash: hash,
          })),
        })),
      }));

      const result = await admin.login(password);
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });

    it('應該拒絕錯誤的密碼', async () => {
      const correctPassword = 'correct_password';
      const hash = await admin.hashPassword(correctPassword);

      mockEnv.DB.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve({
            password_hash: hash,
          })),
        })),
      }));

      const result = await admin.login('wrong_password');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('應該處理資料庫查詢失敗', async () => {
      mockEnv.DB.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(null)),
        })),
      }));

      const result = await admin.login('any_password');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('verifyCap', () => {
    it('應該識別管理員 Cap', async () => {
      // 設定預設管理員 Cap
      mockEnv.DB.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve({
            value: 'admin',
          })),
        })),
      }));

      const result = await admin.verifyCap('admin', 'admin@example.com');
      expect(result.isAdmin).toBe(true);
      expect(result.capName).toBe('管理員');
    });

    it('應該識別一般用戶', async () => {
      mockEnv.DB.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(null)),
        })),
      }));

      const result = await admin.verifyCap('normal_user', 'user@example.com');
      expect(result.isAdmin).toBe(false);
      expect(result.capName).toBeUndefined();
    });
  });

  describe('getCapConfig', () => {
    it('應該返回 Cap 配置', async () => {
      const result = await admin.getCapConfig();

      expect(result).toHaveProperty('suffix');
      expect(result).toHaveProperty('allowHtml');
      expect(typeof result.allowHtml).toBe('boolean');
    });

    it('應該返回預設配置', async () => {
      const config = await admin.getCapConfig();

      expect(config.suffix).toBeDefined();
      expect(config.allowHtml).toBeDefined();
    });
  });

  describe('createSession', () => {
    it('應該創建 session', async () => {
      const token = await admin.createSession('admin');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(mockEnv.KV.put).toHaveBeenCalled();
    });

    it('應該設置過期時間', async () => {
      const token = await admin.createSession('admin', 3600);

      expect(mockEnv.KV.put).toHaveBeenCalledWith(
        expect.stringContaining('admin_session:'),
        expect.any(String),
        { expirationTtl: 3600 }
      );
    });
  });

  describe('deleteSession', () => {
    it('應該刪除 session', async () => {
      await admin.deleteSession('test_token');

      expect(mockEnv.KV.delete).toHaveBeenCalledWith('admin_session:test_token');
    });
  });

  describe('getSession', () => {
    it('應該返回有效的 session', async () => {
      const session = await admin.getSession('test_token');

      expect(session).toBeDefined();
      expect(session?.username).toBe('admin');
    });

    it('應該返回 null 無效的 session', async () => {
      mockEnv.KV.get = vi.fn(() => Promise.resolve(null));

      const session = await admin.getSession('invalid_token');

      expect(session).toBeNull();
    });
  });
});
