/**
 * AntiSpamSystem 單元測試
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AntiSpamSystem } from '../src/lib/anti-spam';
import type { MockEnv } from './types';

describe('AntiSpamSystem', () => {
  let mockEnv: MockEnv;
  let antiSpam: AntiSpamSystem;

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
          // 模擬配置值
          const configs: Record<string, string> = {
            'config:ban_check': '1',
            'config:bad_strings': '["viagra","casino"]',
            'config:bad_filemd5': '["abc123","def456"]',
            'config:enable_dnsbl': '0',
            'config:dnsbl_servers': '["sbl-xbl.spamhaus.org"]',
            'config:dnsbl_whitelist': '[]',
            'config:ban_patterns': '[]',
            'config:trust_proxy_headers': '1',
          };
          return Promise.resolve(configs[key] || null);
        }),
        put: vi.fn(),
        delete: vi.fn(),
      },
    };

    antiSpam = new AntiSpamSystem(mockEnv as any);
  });

  describe('getConfig', () => {
    it('應該返回正確的配置', async () => {
      const config = await antiSpam.getConfig();

      expect(config.banCheck).toBe(true);
      expect(config.badStrings).toEqual(['viagra', 'casino']);
      expect(config.badFileMD5s).toEqual(['abc123', 'def456']);
      expect(config.enableDNSBL).toBe(false);
      expect(config.dnsblWhitelist).toEqual([]);
      expect(config.banPatterns).toEqual([]);
    });

    it('應該使用預設值如果配置不存在', async () => {
      mockEnv.KV.get = vi.fn(() => Promise.resolve(null));
      mockEnv.DB.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(null)),
        })),
      }));

      const antiSpam2 = new AntiSpamSystem(mockEnv as any);
      const config = await antiSpam2.getConfig();

      expect(config.banCheck).toBe(false); // 預設值
      expect(config.badStrings).toEqual([]);
      expect(config.dnsblServers).toContain('sbl-xbl.spamhaus.org');
    });
  });

  describe('checkSpam', () => {
    it('應該通過如果 ban_check 關閉', async () => {
      mockEnv.KV.get = vi.fn((key: string) => {
        if (key === 'config:ban_check') return Promise.resolve('0');
        return Promise.resolve(null);
      });

      const antiSpam2 = new AntiSpamSystem(mockEnv as any);
      const result = await antiSpam2.checkSpam('test', 'test@example.com', 'title', 'content');

      expect(result.isSpam).toBe(false);
    });

    it('應該檢測限制文字', async () => {
      const result = await antiSpam.checkSpam(
        'Test User',
        'test@example.com',
        'Buy viagra now',
        'Great casino bonus'
      );

      expect(result.isSpam).toBe(true);
      expect(result.reason).toBe('內文包含限制文字');
      expect(result.details).toContain('viagra');
    });

    it('應該檢測檔案 MD5', async () => {
      const result = await antiSpam.checkSpam(
        'Test User',
        'test@example.com',
        'Normal title',
        'Normal content',
        'abc123'
      );

      expect(result.isSpam).toBe(true);
      expect(result.reason).toBe('檔案 MD5 在封鎖列表中');
    });

    it('應該通過正常內容', async () => {
      const result = await antiSpam.checkSpam(
        'Test User',
        'test@example.com',
        'Normal title',
        'Normal content here'
      );

      expect(result.isSpam).toBe(false);
    });
  });

  describe('checkBadStrings', () => {
    it('應該檢測所有欄位中的限制文字', () => {
      const config = {
        badStrings: ['spam', 'adult'],
      };

      const result1 = antiSpam.checkBadStrings(
        'spam user',
        'test@example.com',
        'title',
        'content',
        config.badStrings
      );
      expect(result1.isSpam).toBe(true);

      const result2 = antiSpam.checkBadStrings(
        'user',
        'adult@example.com',
        'title',
        'content',
        config.badStrings
      );
      expect(result2.isSpam).toBe(true);
    });

    it('應該不區分大小寫', () => {
      const config = {
        badStrings: ['viagra'],
      };

      const result = antiSpam.checkBadStrings(
        'User',
        'test@example.com',
        'VIAGRA',
        'content',
        config.badStrings
      );
      expect(result.isSpam).toBe(true);
    });

    it('應該通過正常內容', () => {
      const config = {
        badStrings: ['spam', 'adult'],
      };

      const result = antiSpam.checkBadStrings(
        'Normal User',
        'test@example.com',
        'Title',
        'Normal content',
        config.badStrings
      );
      expect(result.isSpam).toBe(false);
    });
  });

  describe('checkBadFileMD5', () => {
    it('應該檢測封鎖的 MD5', () => {
      const badMD5s = ['abc123', 'def456'];

      const result = antiSpam.checkBadFileMD5('abc123', badMD5s);
      expect(result.isSpam).toBe(true);
      expect(result.details).toBe('MD5: abc123');
    });

    it('應該通過正常 MD5', () => {
      const badMD5s = ['abc123', 'def456'];

      const result = antiSpam.checkBadFileMD5('xyz789', badMD5s);
      expect(result.isSpam).toBe(false);
    });
  });

  describe('checkBanPatterns', () => {
    it('應該檢測 CIDR 模式', () => {
      const patterns = ['192.168.0.0/16', '10.0.0.0/8'];

      const result1 = antiSpam.checkBanPatterns('192.168.1.100', patterns);
      expect(result1.isSpam).toBe(true);
      expect(result1.details).toContain('192.168.0.0/16');

      const result2 = antiSpam.checkBanPatterns('10.5.10.5', patterns);
      expect(result2.isSpam).toBe(true);

      const result3 = antiSpam.checkBanPatterns('8.8.8.8', patterns);
      expect(result3.isSpam).toBe(false);
    });

    it('應該檢測萬用字元模式', () => {
      const patterns = ['192.168.*.*', '10.*.*.*'];

      const result1 = antiSpam.checkBanPatterns('192.168.100.50', patterns);
      expect(result1.isSpam).toBe(true);

      const result2 = antiSpam.checkBanPatterns('10.0.0.1', patterns);
      expect(result2.isSpam).toBe(true);

      const result3 = antiSpam.checkBanPatterns('172.16.0.1', patterns);
      expect(result3.isSpam).toBe(false);
    });

    it('應該檢測正規表達式模式', () => {
      const patterns = ['/^192\\..*\\..*\\./'];

      const result1 = antiSpam.checkBanPatterns('192.168.1.1', patterns);
      expect(result1.isSpam).toBe(true);

      const result2 = antiSpam.checkBanPatterns('10.0.0.1', patterns);
      expect(result2.isSpam).toBe(false);
    });

    it('應該處理精確匹配', () => {
      const patterns = ['8.8.8.8', '1.1.1.1'];

      const result1 = antiSpam.checkBanPatterns('8.8.8.8', patterns);
      expect(result1.isSpam).toBe(true);

      const result2 = antiSpam.checkBanPatterns('8.8.8.9', patterns);
      expect(result2.isSpam).toBe(false);
    });

    it('應該忽略無效的模式', () => {
      const patterns = ['invalid-pattern', '/[invalid(regex/'];

      // 不應該拋出錯誤
      const result = antiSpam.checkBanPatterns('192.168.1.1', patterns);
      expect(result.isSpam).toBe(false);
    });
  });

  describe('getClientIP', () => {
    it('應該從 CF-Connecting-IP 取得 IP', () => {
      const mockRequest = {
        headers: {
          get: vi.fn((header: string) => {
            if (header === 'CF-Connecting-IP') return '192.168.1.100';
            return null;
          }),
        },
      } as any;

      const ip = antiSpam.getClientIP(mockRequest);
      expect(ip).toBe('192.168.1.100');
    });

    it('應該從 X-Forwarded-For 取得 IP', () => {
      const mockRequest = {
        headers: {
          get: vi.fn((header: string) => {
            if (header === 'X-Forwarded-For') return '10.0.0.1, 192.168.1.1';
            return null;
          }),
        },
      } as any;

      const ip = antiSpam.getClientIP(mockRequest);
      expect(ip).toBe('10.0.0.1'); // 應該取第一個 IP
    });

    it('應該回傳預設值如果沒有 Header', () => {
      const mockRequest = {
        headers: {
          get: vi.fn(() => null),
        },
      } as any;

      const ip = antiSpam.getClientIP(mockRequest);
      expect(ip).toBe('127.0.0.1');
    });
  });

  describe('checkIPBan', () => {
    it('應該檢測資料庫中的 IP 封鎖', async () => {
      const mockBanRecord = {
        ip: '192.168.1.100',
        reason: 'Spam',
      };

      mockEnv.DB.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(mockBanRecord)),
        })),
      }));

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
      expect(result.details).toBe('Spam');
    });

    it('應該通過未封鎖的 IP', async () => {
      mockEnv.DB.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(null)),
        })),
      }));

      const mockRequest = {
        headers: {
          get: vi.fn((header: string) => {
            if (header === 'CF-Connecting-IP') return '8.8.8.8';
            return null;
          }),
        },
      } as any;

      const result = await antiSpam.checkIPBan(mockRequest);
      expect(result.isSpam).toBe(false);
    });

    it('應該檢測模式封鎖', async () => {
      // 設定 ban_patterns
      mockEnv.KV.get = vi.fn((key: string) => {
        if (key === 'config:ban_patterns') return Promise.resolve('["192.168.0.0/16"]');
        if (key === 'config:ban_check') return Promise.resolve('1');
        return Promise.resolve(null);
      });

      mockEnv.DB.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(null)),
        })),
      }));

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
      expect(result.details).toContain('192.168.0.0/16');
    });
  });
});
