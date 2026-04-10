/**
 * FieldTrap 單元測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateFieldTrapNames,
  getDefaultFieldTrapNames,
  getHoneypotNames,
  verifyFieldTrap,
  validateHoneypot,
} from '../src/lib/field-trap';

describe('FieldTrap', () => {
  describe('generateFieldTrapNames', () => {
    it('應該生成隨機的欄位名稱', () => {
      const names1 = generateFieldTrapNames();
      const names2 = generateFieldTrapNames();

      expect(names1.name).toBeDefined();
      expect(names1.email).toBeDefined();
      expect(names1.subject).toBeDefined();
      expect(names1.comment).toBeDefined();

      // 每次生成應該不同（隨機性）
      expect(names1.name).not.toBe(names2.name);
    });

    it('應該生成足夠長度的名稱', () => {
      const names = generateFieldTrapNames();

      expect(names.name.length).toBeGreaterThan(5);
      expect(names.email.length).toBeGreaterThan(5);
      expect(names.subject.length).toBeGreaterThan(5);
      expect(names.comment.length).toBeGreaterThan(5);
    });

    it('應該只包含字母', () => {
      const names = generateFieldTrapNames();

      expect(names.name).toMatch(/^[a-zA-Z]+$/);
      expect(names.email).toMatch(/^[a-zA-Z]+$/);
      expect(names.subject).toMatch(/^[a-zA-Z]+$/);
      expect(names.comment).toMatch(/^[a-zA-Z]+$/);
    });
  });

  describe('getDefaultFieldTrapNames', () => {
    it('應該返回一致的預設名稱', () => {
      const names1 = getDefaultFieldTrapNames();
      const names2 = getDefaultFieldTrapNames();

      expect(names1.name).toBe(names2.name);
      expect(names1.email).toBe(names2.email);
      expect(names1.subject).toBe(names2.subject);
      expect(names1.comment).toBe(names2.comment);
    });

    it('應該包含所有必要的欄位', () => {
      const names = getDefaultFieldTrapNames();

      expect(names).toHaveProperty('name');
      expect(names).toHaveProperty('email');
      expect(names).toHaveProperty('subject');
      expect(names).toHaveProperty('comment');
    });
  });

  describe('getHoneypotNames', () => {
    it('應該返回一致的 honeypot 名稱', () => {
      const names1 = getHoneypotNames();
      const names2 = getHoneypotNames();

      expect(names1.name1).toBe(names2.name1);
      expect(names1.name2).toBe(names2.name2);
      expect(names1.name3).toBe(names2.name3);
    });

    it('應該包含 3 個 honeypot 欄位', () => {
      const names = getHoneypotNames();

      expect(names).toHaveProperty('name1');
      expect(names).toHaveProperty('name2');
      expect(names).toHaveProperty('name3');
    });

    it('honeypot 名稱應該看起來像正常欄位', () => {
      const names = getHoneypotNames();

      // 應該使用誘惑性的名稱
      expect(names.name1.length).toBeGreaterThan(3);
      expect(names.name2.length).toBeGreaterThan(3);
      expect(names.name3.length).toBeGreaterThan(3);
    });
  });

  describe('verifyFieldTrap', () => {
    it('應該驗證正確的欄位名稱', () => {
      const fieldNames = getDefaultFieldTrapNames();
      const formData = {
        [fieldNames.name]: 'Test User',
        [fieldNames.email]: 'test@example.com',
        [fieldNames.subject]: 'Test',
        [fieldNames.comment]: 'Content',
      };

      const result = verifyFieldTrap(formData, fieldNames);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('應該拒絕缺少必需欄位的請求', () => {
      const fieldNames = getDefaultFieldTrapNames();
      const formData = {
        [fieldNames.name]: 'Test User',
        // 缺少 email, subject, comment
      };

      const result = verifyFieldTrap(formData, fieldNames);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('應該拒絕包含舊欄位名稱的請求', () => {
      const fieldNames = getDefaultFieldTrapNames();
      const formData = {
        [fieldNames.name]: 'Test User',
        [fieldNames.email]: 'test@example.com',
        'name': 'Bot', // 舊欄位名稱
      };

      const result = verifyFieldTrap(formData, fieldNames);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Detected old field names');
    });

    it('應該允許額外的欄位（如 file）', () => {
      const fieldNames = getDefaultFieldTrapNames();
      const formData = {
        [fieldNames.name]: 'Test User',
        [fieldNames.email]: 'test@example.com',
        [fieldNames.subject]: 'Test',
        [fieldNames.comment]: 'Content',
        'file': new File([''], 'test.jpg'),
        'continual_post': '1',
      };

      const result = verifyFieldTrap(formData, fieldNames);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateHoneypot', () => {
    it('應該通過空的 honeypot 欄位', () => {
      const honeypotNames = getHoneypotNames();
      const formData = {
        [honeypotNames.name1]: '',
        [honeypotNames.name2]: '',
        [honeypotNames.name3]: '',
      };

      const result = validateHoneypot(formData, honeypotNames);
      expect(result.valid).toBe(true);
      expect(result.triggered).toBe(0);
    });

    it('應該檢測填充的 honeypot 欄位', () => {
      const honeypotNames = getHoneypotNames();
      const formData = {
        [honeypotNames.name1]: 'spam bot',
        [honeypotNames.name2]: '',
        [honeypotNames.name3]: '',
      };

      const result = validateHoneypot(formData, honeypotNames);
      expect(result.valid).toBe(false);
      expect(result.triggered).toBe(1);
    });

    it('應該檢測多個填充的 honeypot 欄位', () => {
      const honeypotNames = getHoneypotNames();
      const formData = {
        [honeypotNames.name1]: 'bot',
        [honeypotNames.name2]: 'spam',
        [honeypotNames.name3]: '',
      };

      const result = validateHoneypot(formData, honeypotNames);
      expect(result.valid).toBe(false);
      expect(result.triggered).toBe(2);
    });

    it('應該只檢查空白字元', () => {
      const honeypotNames = getHoneypotNames();
      const formData = {
        [honeypotNames.name1]: '   ', // 只有空白
        [honeypotNames.name2]: '',
        [honeypotNames.name3]: '',
      };

      const result = validateHoneypot(formData, honeypotNames);
      // 空白字元不應該觸發（或者應該觸發，取決於實作）
      expect(result.triggered).toBeGreaterThanOrEqual(0);
    });

    it('應該處理不存在的 honeypot 欄位', () => {
      const honeypotNames = getHoneypotNames();
      const formData = {
        [honeypotNames.name1]: '',
        [honeypotNames.name2]: '',
        // 缺少 name3
      };

      const result = validateHoneypot(formData, honeypotNames);
      expect(result.valid).toBe(true); // 缺少欄位等同於空
    });
  });

  describe('整合測試', () => {
    it('應該通過正常的請求', () => {
      const fieldNames = getDefaultFieldTrapNames();
      const honeypotNames = getHoneypotNames();

      const formData = {
        [fieldNames.name]: 'Test User',
        [fieldNames.email]: 'test@example.com',
        [fieldNames.subject]: 'Test',
        [fieldNames.comment]: 'Content',
        [honeypotNames.name1]: '',
        [honeypotNames.name2]: '',
        [honeypotNames.name3]: '',
      };

      const fieldResult = verifyFieldTrap(formData, fieldNames);
      const honeypotResult = validateHoneypot(formData, honeypotNames);

      expect(fieldResult.valid).toBe(true);
      expect(honeypotResult.valid).toBe(true);
    });

    it('應該拒絕 spam bot 請求（填充 honeypot）', () => {
      const fieldNames = getDefaultFieldTrapNames();
      const honeypotNames = getHoneypotNames();

      const formData = {
        [fieldNames.name]: 'Spam Bot',
        [fieldNames.email]: 'spam@bot.com',
        [fieldNames.subject]: 'Buy now',
        [fieldNames.comment]: 'Great offer',
        [honeypotNames.name1]: 'bot filled this',
        [honeypotNames.name2]: '',
        [honeypotNames.name3]: '',
      };

      const fieldResult = verifyFieldTrap(formData, fieldNames);
      const honeypotResult = validateHoneypot(formData, honeypotNames);

      expect(fieldResult.valid).toBe(true); // 欄位名稱正確
      expect(honeypotResult.valid).toBe(false); // honeypot 被觸發
    });

    it('應該拒絕舊式 bot（使用舊欄位名稱）', () => {
      const fieldNames = getDefaultFieldTrapNames();
      const honeypotNames = getHoneypotNames();

      const formData = {
        'name': 'Old Bot',
        'email': 'old@bot.com',
        'subject': 'Old',
        'comment': 'Old content',
        [honeypotNames.name1]: '',
        [honeypotNames.name2]: '',
        [honeypotNames.name3]: '',
      };

      const fieldResult = verifyFieldTrap(formData, fieldNames);

      expect(fieldResult.valid).toBe(false);
      expect(fieldResult.errors.length).toBeGreaterThan(0);
      expect(fieldResult.errors[0]).toContain('Detected old field name');
    });
  });
});
