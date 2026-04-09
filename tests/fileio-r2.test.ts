/**
 * FileIOR2 單元測試
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileIOR2 } from '../src/lib/fileio-r2';
import type { MockEnv } from './types';

describe('FileIOR2', () => {
  let mockEnv: MockEnv;
  let fileio: FileIOR2;

  beforeEach(() => {
    // 創建模擬環境
    mockEnv = {
      DB: {
        prepare: vi.fn(),
        batch: vi.fn(),
        exec: vi.fn(),
      },
      STORAGE: {
        get: vi.fn(() => Promise.resolve(null)),
        put: vi.fn(() => Promise.resolve()),
        delete: vi.fn(() => Promise.resolve()),
        list: vi.fn(() => Promise.resolve({ objects: [] })),
      },
      KV: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      },
    };

    fileio = new FileIOR2(mockEnv.STORAGE as any);
  });

  describe('init', () => {
    it('應該成功初始化', async () => {
      await fileio.init();
      expect(true).toBe(true); // 如果沒有拋出錯誤就算通過
    });
  });

  describe('version', () => {
    it('應該返回版本號', () => {
      const version = fileio.version();
      expect(version).toBe('0.1.0');
    });
  });

  describe('getImage', () => {
    it('應該返回 null 如果圖片不存在', async () => {
      (mockEnv.STORAGE.get as any).mockResolvedValue(null);

      const image = await fileio.getImage('test.png');
      expect(image).toBeNull();
      expect(mockEnv.STORAGE.get).toHaveBeenCalledWith('test.png');
    });

    it('應該返回圖片數據', async () => {
      const mockData = new Uint8Array([1, 2, 3, 4, 5]);
      const mockObject = {
        arrayBuffer: vi.fn(() => Promise.resolve(mockData.buffer)),
        httpMetadata: { contentType: 'image/png' },
      };
      (mockEnv.STORAGE.get as any).mockResolvedValue(mockObject);

      const image = await fileio.getImage('test.png');

      expect(image).toBeInstanceOf(Blob);
      expect(mockEnv.STORAGE.get).toHaveBeenCalledWith('test.png');
    });
  });

  describe('deleteImage', () => {
    it('應該成功刪除圖片', async () => {
      await fileio.deleteImage('test.png');
      expect(mockEnv.STORAGE.delete).toHaveBeenCalledWith('test.png');
    });

    it('應該返回 true 即使刪除失敗', async () => {
      (mockEnv.STORAGE.delete as any).mockRejectedValue(new Error('Not found'));
      const result = await fileio.deleteImage('test.png');
      expect(result).toBe(true);
    });
  });

  describe('validateImage', () => {
    it('應該驗證 PNG 圖片', async () => {
      const pngData = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const file = new File([pngData], 'test.png', { type: 'image/png' });

      const isValid = await fileio.validateImage(file);
      expect(isValid).toBe(true);
    });

    it('應該驗證 JPEG 圖片', async () => {
      const jpegData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
      const file = new File([jpegData], 'test.jpg', { type: 'image/jpeg' });

      const isValid = await fileio.validateImage(file);
      expect(isValid).toBe(true);
    });

    it('應該拒絕無效圖片', async () => {
      const invalidData = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const file = new File([invalidData], 'test.bin', { type: 'application/octet-stream' });

      const isValid = await fileio.validateImage(file);
      expect(isValid).toBe(false);
    });
  });

  describe('getImageDimensions', () => {
    it('應該讀取 PNG 尺寸', async () => {
      // PNG header with 800x600 dimensions
      const pngData = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x03, 0x20, // width: 800
        0x00, 0x00, 0x02, 0x58, // height: 600
      ]);

      const dimensions = await fileio['getImageDimensions'](pngData.buffer);
      expect(dimensions.width).toBe(800);
      expect(dimensions.height).toBe(600);
    });

    it('應該讀取 JPEG 尺寸', async () => {
      // Minimal JPEG with 640x480 dimensions
      const jpegData = new Uint8Array([
        0xFF, 0xD8, 0xFF, 0xE0,
        0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
        0xFF, 0xC0, 0x00, 0x11, 0x08, // SOF marker
        0x02, 0xE0, // height: 736
        0x02, 0x80, // width: 640
      ]);

      const dimensions = await fileio['getImageDimensions'](jpegData.buffer);
      expect(dimensions.width).toBe(640);
      expect(dimensions.height).toBe(736);
    });

    it('應該處理無法識別的格式', async () => {
      const invalidData = new Uint8Array([0x00, 0x00, 0x00, 0x00]);

      const dimensions = await fileio['getImageDimensions'](invalidData.buffer);
      expect(dimensions.width).toBe(0);
      expect(dimensions.height).toBe(0);
    });
  });

  describe('calculateMD5', () => {
    it('應該計算 MD5 雜湊', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const hash = await fileio.calculateMD5(data);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(32); // MD5 是 32 個十六進制字符
    });
  });
});
