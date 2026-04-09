/**
 * E2E 測試 - 管理功能
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { AdminSystem } from '../src/lib/admin';
import { AntiSpamSystem } from '../src/lib/anti-spam';
import type { MockEnv } from './types';

describe('E2E - 管理功能', () => {
  let mockEnv: MockEnv;
  let admin: AdminSystem;
  let antiSpam: AntiSpamSystem;

  beforeAll(() => {
    // 創建完整的模擬環境
    mockEnv = {
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            all: vi.fn(() => Promise.resolve({ results: [] })),
            first: vi.fn(() => Promise.resolve(null)),
            run: vi.fn(() => Promise.resolve({
              meta: { last_row_id: 1 }
            })),
          })),
        })),
        batch: vi.fn(() => Promise.resolve([])),
        exec: vi.fn(() => Promise.resolve()),
      },
      STORAGE: {
        get: vi.fn(),
        put: vi.fn(() => Promise.resolve({ key: 'test', etag: '123' })),
        delete: vi.fn(),
        list: vi.fn(() => Promise.resolve({ objects: [] })),
      },
      KV: {
        get: vi.fn((key: string) => {
          // 模擬配置
          const configs: Record<string, string> = {
            'config:admin_password_hash': await mockHashPassword('test123456'),
            'config:ban_check': '1',
            'config:bad_strings': '["viagra","casino","porn"]',
            'config:bad_filemd5': '["abc123","def456"]',
            'config:enable_dnsbl': '1',
            'config:dnsbl_servers': '["sbl-xbl.spamhaus.org","bl.spamcop.net"]',
            'config:dnsbl_whitelist': '["127.0.0.1","192.168.1.100"]',
            'config:ban_patterns': '["192.168.0.0/16","10.*.*.*"]',
            'config:admin_cap': 'admin',
            'config:tripcode_salt': 'pixmicat-tripcode',
          };

          // 模擬 session
          if (key === 'admin_session:valid_token') {
            return Promise.resolve(JSON.stringify({
              username: 'admin',
              loginTime: Date.now(),
            }));
          }

          return Promise.resolve(configs[key] || null);
        }),
        put: vi.fn(() => Promise.resolve()),
        delete: vi.fn(() => Promise.resolve()),
      },
    };

    admin = new AdminSystem(mockEnv as any);
    antiSpam = new AntiSpamSystem(mockEnv as any);
  });

  // 輔助函數：模擬密碼 hash
  async function mockHashPassword(password: string): Promise<string> {
    // 簡化的 hash 模擬
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'pixmicat-admin-salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  describe('管理員登入流程', () => {
    it('應該成功登入正確密碼', async () => {
      // 模擬資料庫返回 hash
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve({
            password_hash: await mockHashPassword('test123456'),
          })),
        })),
      });

      const result = await admin.login('test123456');

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(mockEnv.KV.put).toHaveBeenCalled();
    });

    it('應該拒絕錯誤密碼', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve({
            password_hash: await mockHashPassword('correct_password'),
          })),
        })),
      });

      const result = await admin.login('wrong_password');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('應該處理未設定的密碼', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(null)),
        })),
      });

      const result = await admin.login('any_password');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('Session 驗證', () => {
    it('應該驗證有效的 session', async () => {
      const mockRequest = {
        headers: {
          get: vi.fn((header: string) => {
            if (header === 'Cookie') return 'admin_session=valid_token';
            return null;
          }),
        },
      } as any;

      const result = await admin.isAdminRequest(mockRequest);

      expect(result).toBe(true);
    });

    it('應該拒絕無效的 session', async () => {
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
  });

  describe('IP 封鎖管理', () => {
    it('應該成功封鎖 IP', async () => {
      const mockBanRecord = {
        ip: '192.168.1.100',
        reason: 'Spam',
        expires_at: null,
      };

      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          run: vi.fn(() => Promise.resolve({
            meta: { last_row_id: 1 }
          })),
        })),
      });

      const result = await admin.addBan(mockBanRecord.ip, mockBanRecord.reason, null);

      expect(result).toBe(true);
      expect(mockEnv.DB.prepare).toHaveBeenCalled();
    });

    it('應該成功解除封鎖', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          run: vi.fn(() => Promise.resolve({ meta: {} })),
        })),
      });

      const result = await admin.removeBan(1);

      expect(result).toBe(true);
    });

    it('應該檢測被封鎖的 IP', async () => {
      const mockBanRecord = {
        ip: '192.168.1.100',
        reason: 'Spam',
      };

      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(mockBanRecord)),
        })),
      });

      const mockRequest = {
        headers: {
          get: vi.fn((header: string) => {
            if (header === 'CF-Connecting-IP') return '192.168.1.100';
            return null;
          }),
        },
      } as any;

      const result = await antiSpam.checkIPBan(mockRequest);

      expect(result.isSpam).toBe(true);
      expect(result.reason).toBe('IP被封鎖');
    });
  });

  describe('反垃圾設定管理', () => {
    it('應該檢測限制文字', async () => {
      const result = await antiSpam.checkSpam(
        'Spammer',
        'spam@bot.com',
        'Buy viagra',
        'Great casino bonus'
      );

      expect(result.isSpam).toBe(true);
      expect(result.reason).toBe('內文包含限制文字');
    });

    it('應該檢測封鎖的檔案 MD5', async () => {
      const result = await antiSpam.checkSpam(
        'User',
        'user@example.com',
        'Title',
        'Content',
        'abc123'
      );

      expect(result.isSpam).toBe(true);
      expect(result.reason).toBe('檔案 MD5 在封鎖列表中');
    });

    it('應該檢測 IP 模式封鎖', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(null)),
        })),
      });

      const mockRequest = {
        headers: {
          get: vi.fn((header: string) => {
            if (header === 'CF-Connecting-IP') return '192.168.1.50';
            return null;
          }),
        },
      } as any;

      const result = await antiSpam.checkIPBan(mockRequest);

      expect(result.isSpam).toBe(true);
      expect(result.reason).toBe('IP符合封鎖模式');
    });

    it('應該通過白名單 IP', async () => {
      // 設定白名單
      mockEnv.KV.get = vi.fn((key: string) => {
        if (key === 'config:dnsbl_whitelist') return Promise.resolve('["127.0.0.1"]');
        return Promise.resolve('[]');
      });

      const mockRequest = {
        headers: {
          get: vi.fn((header: string) => {
            if (header === 'CF-Connecting-IP') return '127.0.0.1';
            return null;
          }),
        },
      } as any;

      const result = await antiSpam.checkSpam(
        'User',
        'user@example.com',
        'Title',
        'Content',
        undefined,
        mockRequest
      );

      expect(result.isSpam).toBe(false);
    });
  });

  describe('文章管理', () => {
    it('應該成功刪除文章', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          run: vi.fn(() => Promise.resolve({ meta: {} })),
        })),
      });

      const result = await admin.deletePost(1, 'password123');

      expect(result).toBe(true);
    });

    it('應該拒絕錯誤的刪除密碼', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve({
            password_hash: await mockHashPassword('correct_password'),
          })),
        })),
      });

      const result = await admin.deletePost(1, 'wrong_password');

      expect(result).toBe(false);
    });
  });

  describe('Cap 驗證', () => {
    it('應該識別管理員 Cap', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve({
            value: 'admin',
          })),
        })),
      });

      const result = await admin.verifyCap('admin', 'admin@example.com');

      expect(result.isAdmin).toBe(true);
      expect(result.capName).toBe('管理員');
    });

    it('應該識別一般用戶', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(null)),
        })),
      });

      const result = await admin.verifyCap('normal_user', 'user@example.com');

      expect(result.isAdmin).toBe(false);
    });
  });

  describe('配置管理', () => {
    it('應該成功更新配置', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          run: vi.fn(() => Promise.resolve({ meta: {} })),
        })),
      });

      const result = await admin.updateConfig('title', 'New Title');

      expect(result).toBe(true);
    });

    it('應該讀取配置', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve({
            value: 'Test Value',
          })),
        })),
      });

      const result = await admin.getConfig('test_key');

      expect(result).toBe('Test Value');
    });
  });

  describe('資料庫維護', () => {
    it('應該執行優化', async () => {
      (mockEnv.DB.exec as any).mockResolvedValue(undefined);

      const result = await admin.performMaintenance('optimize');

      expect(result).toBe(true);
    });

    it('應該執行檢查', async () => {
      (mockEnv.DB.exec as any).mockResolvedValue(undefined);

      const result = await admin.performMaintenance('check');

      expect(result).toBe(true);
    });

    it('應該執行修復', async () => {
      (mockEnv.DB.exec as any).mockResolvedValue(undefined);

      const result = await admin.performMaintenance('repair');

      expect(result).toBe(true);
    });
  });

  describe('錯誤處理', () => {
    it('應該處理資料庫錯誤', async () => {
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          run: vi.fn(() => Promise.reject(new Error('Database error'))),
        })),
      });

      await expect(async () => {
        await admin.deletePost(1, 'password');
      }).not.toThrow(); // 錯誤被處理
    });

    it('應該處理 KV 錯誤', async () => {
      mockEnv.KV.get = vi.fn(() => Promise.reject(new Error('KV error')));

      const result = await admin.getSession('test_token');

      expect(result).toBeNull(); // 返回 null 而不是拋出錯誤
    });
  });
});
