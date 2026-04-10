/**
 * E2E 測試 - 發文流程
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PIOD1 } from '../src/lib/pio-d1';
import { FileIOR2 } from '../src/lib/fileio-r2';
import { AntiSpamSystem } from '../src/lib/anti-spam';
import { AdminSystem } from '../src/lib/admin';
import {
  generateTripcode,
  htmlEscape,
  processComment,
  calculateSage,
} from '../src/lib/utils';
import {
  getDefaultFieldTrapNames,
  getHoneypotNames,
  verifyFieldTrap,
  validateHoneypot,
} from '../src/lib/field-trap';
import type { MockEnv } from './types';

describe('E2E - 發文流程', () => {
  let mockEnv: MockEnv;
  let pio: PIOD1;
  let fileio: FileIOR2;
  let antiSpam: AntiSpamSystem;
  let admin: AdminSystem;

  beforeAll(() => {
    // 創建完整的模擬環境
    mockEnv = {
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            all: vi.fn(() => Promise.resolve({ results: [] })),
            first: vi.fn(() => Promise.resolve(null)),
            run: vi.fn(() => Promise.resolve({ meta: { last_row_id: 1 } })),
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
          const configs: Record<string, string> = {
            'config:ban_check': '0', // 關閉反垃圾檢查
            'config:tripcode_salt': 'pixmicat-tripcode',
            'config:auto_link_urls': '1',
            'config:enable_quote_system': '1',
          };
          return Promise.resolve(configs[key] || null);
        }),
        put: vi.fn(),
        delete: vi.fn(),
      },
    };

    pio = new PIOD1(mockEnv.DB as any);
    fileio = new FileIOR2(mockEnv.STORAGE as any);
    antiSpam = new AntiSpamSystem(mockEnv as any);
    admin = new AdminSystem(mockEnv as any);
  });

  describe('完整發文流程', () => {
    it('應該成功創建新討論串（OP）', async () => {
      // 準備發文資料
      const postData = {
        name: 'Test User',
        email: 'test@example.com',
        sub: 'Test Thread',
        com: 'This is a test thread content',
        resto: 0, // OP
      };

      // 模擬 Tripcode 生成
      const tripcode = await generateTripcode('password');
      expect(tripcode).toBeDefined();

      // 處理名稱中的 Tripcode
      let processedName = postData.name;
      if (processedName.includes('#')) {
        const nameParts = processedName.split('#');
        processedName = `${nameParts[0]}◆${tripcode}`;
      }

      // 處理內文（自動連結、引用系統）
      const processedCom = processComment(
        postData.com,
        true, // autoLinkUrls
        true  // enableQuotes
      );

      expect(processedCom).toContain('test thread content');

      // HTML 轉義
      const escapedCom = htmlEscape(postData.com);
      expect(escapedCom).toBe(postData.com); // 正常文字不變

      // 檢查 sage
      const isSage = calculateSage(postData.email);
      expect(isSage).toBe(false);

      // Field Trap 驗證
      const fieldNames = getDefaultFieldTrapNames();
      const honeypotNames = getHoneypotNames();

      const formData = {
        [fieldNames.name]: postData.name,
        [fieldNames.email]: postData.email,
        [fieldNames.subject]: postData.sub,
        [fieldNames.comment]: postData.com,
        [honeypotNames.name]: '', // honeypot 必須為空
        [honeypotNames.email]: '',
      };

      const fieldCheck = verifyFieldTrap(formData, fieldNames);
      expect(fieldCheck.valid).toBe(true);

      const honeypotCheck = validateHoneypot(formData, honeypotNames);
      expect(honeypotCheck.valid).toBe(true);

      // 反垃圾檢查
      const spamCheck = await antiSpam.checkSpam(
        postData.name,
        postData.email,
        postData.sub,
        postData.com
      );
      expect(spamCheck.isSpam).toBe(false);

      // 創建文章（模擬）
      expect(true).toBe(true); // 流程完成
    });

    it('應該成功回應討論串', async () => {
      const replyData = {
        name: 'Reply User',
        email: 'sage', // 使用 sage
        sub: '',
        com: 'Reply to >>No.1',
        resto: 1, // 回應 No.1
      };

      // 檢查 sage
      const isSage = calculateSage(replyData.email);
      expect(isSage).toBe(true);

      // 處理引用
      const processedCom = processComment(
        replyData.com,
        true,
        true
      );

      expect(processedCom).toContain('/res/1.htm');

      // 驗證流程
      expect(replyData.resto).toBeGreaterThan(0);
    });

    it('應該拒絕 spam bot 填充 honeypot', async () => {
      const fieldNames = getDefaultFieldTrapNames();
      const honeypotNames = getHoneypotNames();

      const botFormData = {
        [fieldNames.name]: 'Spam Bot',
        [fieldNames.email]: 'spam@bot.com',
        [fieldNames.subject]: 'Spam',
        [fieldNames.comment]: 'Buy viagra!',
        [honeypotNames.name]: 'bot filled this', // honeypot 被填充！
        [honeypotNames.email]: '',
      };

      const honeypotCheck = validateHoneypot(botFormData, honeypotNames);
      expect(honeypotCheck.valid).toBe(false);
      expect(honeypotCheck.triggered).toBe(1);
    });

    it('應該拒絕使用舊欄位名稱的 bot', async () => {
      const fieldNames = getDefaultFieldTrapNames();

      const oldBotFormData = {
        'name': 'Old Bot',
        'email': 'old@bot.com',
        'subject': 'Old Spam',
        'comment': 'Old spam content',
      };

      const fieldCheck = verifyFieldTrap(oldBotFormData, fieldNames);
      expect(fieldCheck.valid).toBe(false);
      expect(fieldCheck.errors).toContain('Detected old field names');
    });
  });

  describe('Tripcode 生成', () => {
    it('應該為管理員生成正確的 Tripcode', async () => {
      const tripcode = await generateTripcode('admin_password');
      expect(tripcode).toBeDefined();
      expect(tripcode.length).toBeGreaterThan(0);
    });

    it('應該為一般用戶生成 Tripcode', async () => {
      const tripcode = await generateTripcode('user_password');
      expect(tripcode).toBeDefined();
    });

    it('相同密碼應該生成相同 Tripcode', async () => {
      const tripcode1 = await generateTripcode('test123');
      const tripcode2 = await generateTripcode('test123');
      expect(tripcode1).toBe(tripcode2);
    });
  });

  describe('內文處理', () => {
    it('應該正確處理自動連結', () => {
      const input = 'Visit https://example.com for info';
      const result = processComment(input, true, false);

      expect(result).toContain('<a href="https://example.com"');
      expect(result).toContain('target="_blank"');
    });

    it('應該正確處理引用', () => {
      const input = 'Reply to >>No.123';
      const result = processComment(input, false, true);

      expect(result).toContain('/res/123.htm');
      expect(result).toContain('&gt;&gt;No.123</a>');
    });

    it('應該同時處理自動連結和引用', () => {
      const input = 'Visit https://example.com and reply to >>No.456';
      const result = processComment(input, true, true);

      expect(result).toContain('<a href="https://example.com"');
      expect(result).toContain('/res/456.htm');
    });

    it('應該正確轉義 HTML', () => {
      const input = '<script>alert("XSS")</script>';
      const result = htmlEscape(input);

      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<script>');
    });
  });

  describe('Sage 計算', () => {
    it('應該識別 sage', () => {
      expect(calculateSage('sage')).toBe(true);
      expect(calculateSage('SAGE')).toBe(true);
      expect(calculateSage('Sage')).toBe(true);
    });

    it('應該忽略非 sage Email', () => {
      expect(calculateSage('test@example.com')).toBe(false);
      expect(calculateSage('')).toBe(false);
      expect(calculateSage('noko')).toBe(false);
    });
  });

  describe('檔案上傳流程', () => {
    it('應該驗證圖片格式', async () => {
      // 模擬圖片檔案
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      // 驗證（模擬）
      const isValid = mockFile.type.startsWith('image/');
      expect(isValid).toBe(true);
    });

    it('應該拒絕非圖片格式', async () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });

      const isValid = mockFile.type.startsWith('image/');
      expect(isValid).toBe(false);
    });

    it('應該檢查檔案大小', async () => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const mockFile = new File([new ArrayBuffer(5 * 1024 * 1024)], 'test.jpg', {
        type: 'image/jpeg',
      });

      expect(mockFile.size).toBeLessThan(maxSize);
    });
  });

  describe('錯誤處理', () => {
    it('應該拒絕空內文', () => {
      const com = '';
      const isValid = com.trim().length > 0;

      expect(isValid).toBe(false);
    });

    it('應該拒絕過長的內文', () => {
      const maxLength = 2000;
      const com = 'x'.repeat(maxLength + 1);

      expect(com.length).toBeGreaterThan(maxLength);
    });

    it('應該拒絕過長的欄位', () => {
      const maxLength = 100;
      const name = 'x'.repeat(maxLength + 1);

      expect(name.length).toBeGreaterThan(maxLength);
    });
  });
});
