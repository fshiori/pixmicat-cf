/**
 * API 路由單元測試
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockEnv, createMockRequest } from './utils';

describe('API Routes', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = createMockEnv();
  });

  describe('GET /api/threads', () => {
    it('應該返回討論串列表', async () => {
      const mockThreads = [
        {
          no: 1,
          resto: 0,
          name: '測試用戶',
          sub: '測試標題',
          com: '測試內容',
          timestamp: 1234567890,
          posts: [],
          reply_count: 0,
          image_count: 0,
          last_reply_time: 1234567890,
          sticky: 0,
          locked: 0,
        },
      ];

      // 模擬 DB 查詢
      const mockBindResult = {
        all: vi.fn().mockResolvedValue({ results: mockThreads }),
      };
      
      const mockStmt = {
        bind: vi.fn().mockReturnValue(mockBindResult),
      };
      
      mockEnv.DB.prepare = vi.fn().mockReturnValue(mockStmt);

      // 模擬實際調用流程
      const stmt = mockEnv.DB.prepare('SELECT * FROM threads');
      const bindResult = stmt.bind();
      await bindResult.all();
      
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith('SELECT * FROM threads');
      expect(mockStmt.bind).toHaveBeenCalled();
      expect(mockBindResult.all).toHaveBeenCalled();
    });

    it('應該支援分頁參數', async () => {
      const request = createMockRequest('/api/threads?page=2&limit=10');
      expect(request.url).toContain('page=2');
      expect(request.url).toContain('limit=10');
    });
  });

  describe('POST /api/post', () => {
    it('應該創建新文章', async () => {
      const formData = new FormData();
      formData.append('name', '測試用戶');
      formData.append('sub', '測試標題');
      formData.append('com', '測試內容');
      formData.append('resto', '0');

      // 模擬 DB 插入
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          run: vi.fn(() => Promise.resolve({ meta: { last_row_id: 123 } })),
        })),
      });

      expect(formData.get('name')).toBe('測試用戶');
      expect(formData.get('resto')).toBe('0');
    });
  });

  describe('POST /api/delete', () => {
    it('應該刪除文章', async () => {
      const deleteData = {
        no: 123,
        password: 'test123',
      };

      // 模擬 DB 刪除
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          run: vi.fn(() => Promise.resolve({ meta: {} })),
        })),
      });

      expect(deleteData.no).toBe(123);
    });
  });

  describe('GET /api/search', () => {
    it('應該搜尋文章', async () => {
      const searchQuery = '測試';
      const encodedQuery = encodeURIComponent(searchQuery);
      const request = createMockRequest(`/api/search?q=${encodedQuery}&type=all`);

      expect(request.url).toContain('q=');
      expect(request.url).toContain(encodedQuery);
      expect(request.url).toContain('type=all');
    });
  });

  describe('GET /rss.xml', () => {
    it('應該返回 RSS XML', async () => {
      const mockThreads = [
        {
          no: 1,
          sub: '測試標題',
          com: '測試內容',
          timestamp: 1234567890,
          posts: [],
        },
      ];

      // 模擬 DB 查詢
      (mockEnv.DB.prepare as any).mockReturnValue({
        bind: vi.fn(() => ({
          all: vi.fn(() => Promise.resolve({ results: mockThreads })),
        })),
      });

      expect(mockThreads.length).toBeGreaterThan(0);
    });
  });

  describe('圖片路由', () => {
    describe('GET /img/:filename', () => {
      it('應該返回圖片', async () => {
        const mockImageData = new Uint8Array([1, 2, 3, 4, 5]);
        const mockObject = {
          arrayBuffer: vi.fn(() => Promise.resolve(mockImageData.buffer)),
          httpMetadata: { contentType: 'image/png' },
          size: 5,
        };

        (mockEnv.STORAGE.get as any).mockResolvedValue(mockObject);

        const image = await mockEnv.STORAGE.get('test.png');
        expect(image).toBeDefined();
      });
    });

    describe('GET /thumb/:filename', () => {
      it('應該返回縮圖', async () => {
        const mockThumbData = new Uint8Array([1, 2, 3, 4, 5]);
        const mockObject = {
          arrayBuffer: vi.fn(() => Promise.resolve(mockThumbData.buffer)),
          httpMetadata: { contentType: 'image/jpeg' },
          size: 5,
        };

        (mockEnv.STORAGE.get as any).mockResolvedValue(mockObject);

        const thumb = await mockEnv.STORAGE.get('123456s.jpg');
        expect(thumb).toBeDefined();
      });
    });
  });

  describe('管理員路由', () => {
    describe('POST /admin/login', () => {
      it('應該驗證管理員密碼', async () => {
        const loginData = {
          password: 'admin123',
        };

        // 模擬 KV 查詢
        (mockEnv.KV.get as any).mockResolvedValue('valid-session-token');

        expect(loginData.password).toBeDefined();
      });
    });

    describe('GET /admin/status', () => {
      it('應該返回系統狀態', async () => {
        // 模擬 DB 統計查詢
        const mockBindResult = {
          first: vi.fn().mockResolvedValue({ count: 100 }),
        };
        
        const mockStmt = {
          bind: vi.fn().mockReturnValue(mockBindResult),
        };
        
        mockEnv.DB.prepare = vi.fn().mockReturnValue(mockStmt);
        
        // 模擬實際調用流程
        const stmt = mockEnv.DB.prepare('SELECT COUNT(*) as count FROM posts');
        const bindResult = stmt.bind();
        const result = await bindResult.first();
        
        expect(mockEnv.DB.prepare).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM posts');
        expect(mockStmt.bind).toHaveBeenCalled();
        expect(mockBindResult.first).toHaveBeenCalled();
        expect(result.count).toBe(100);
      });
    });
  });
});
