/**
 * PIOD1 單元測試
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PIOD1 } from '../src/lib/pio-d1';
import type { MockEnv } from './types';

describe('PIOD1', () => {
  let mockEnv: MockEnv;
  let pio: PIOD1;

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
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      },
    };

    pio = new PIOD1(mockEnv.DB as any);
  });

  describe('prepare', () => {
    it('應該成功準備資料庫', async () => {
      await pio.prepare();
      expect(mockEnv.DB.prepare).toHaveBeenCalled();
    });
  });

  describe('getPost', () => {
    it('應該返回 null 如果文章不存在', async () => {
      const mockStmt = {
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(null)),
        })),
      };
      (mockEnv.DB.prepare as any).mockReturnValue(mockStmt);

      await pio.prepare();
      const post = await pio.getPost(999999);

      expect(post).toBeNull();
      expect(mockStmt.bind).toHaveBeenCalledWith(999999);
    });

    it('應該返回文章數據', async () => {
      const mockPost = {
        no: 1,
        resto: 0,
        name: '測試用戶',
        email: '',
        sub: '測試標題',
        com: '測試內容',
        timestamp: 1234567890,
      };

      const mockStmt = {
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(mockPost)),
        })),
      };
      (mockEnv.DB.prepare as any).mockReturnValue(mockStmt);

      await pio.prepare();
      const post = await pio.getPost(1);

      expect(post).toEqual(mockPost);
      expect(mockStmt.bind).toHaveBeenCalledWith(1);
    });
  });

  describe('getThread', () => {
    it('應該返回討論串和回應', async () => {
      const mockThread = {
        no: 1,
        resto: 0,
        posts: [
          { no: 1, resto: 0, name: 'OP' },
          { no: 2, resto: 1, name: '回應者' },
        ],
      };

      const mockStmt = {
        bind: vi.fn(() => ({
          all: vi.fn(() => Promise.resolve({ results: [mockThread] })),
        })),
      };
      (mockEnv.DB.prepare as any).mockReturnValue(mockStmt);

      await pio.prepare();
      const thread = await pio.getThread(1);

      expect(thread).toBeDefined();
      expect(thread?.posts).toHaveLength(2);
    });
  });

  describe('createPost', () => {
    it('應該成功創建文章', async () => {
      const postData = {
        name: '測試用戶',
        email: '',
        sub: '測試標題',
        com: '測試內容',
        resto: 0,
      };

      const mockStmt = {
        bind: vi.fn(() => ({
          run: vi.fn(() => Promise.resolve({ meta: { last_row_id: 123 } })),
        })),
      };
      (mockEnv.DB.prepare as any).mockReturnValue(mockStmt);

      await pio.prepare();
      const no = await pio.createPost(postData);

      expect(no).toBe(123);
      expect(mockStmt.bind).toHaveBeenCalled();
    });
  });

  describe('deletePost', () => {
    it('應該成功刪除文章', async () => {
      const mockStmt = {
        bind: vi.fn(() => ({
          run: vi.fn(() => Promise.resolve({ meta: {} })),
        })),
      };
      (mockEnv.DB.prepare as any).mockReturnValue(mockStmt);

      await pio.prepare();
      const result = await pio.deletePost(1);

      expect(result).toBe(true);
      expect(mockStmt.bind).toHaveBeenCalledWith(1);
    });
  });

  describe('getThreadList', () => {
    it('應該返回討論串列表', async () => {
      const mockThreads = [
        { no: 1, reply_count: 5, last_reply_time: 1234567890 },
        { no: 2, reply_count: 3, last_reply_time: 1234567800 },
      ];

      const mockStmt = {
        bind: vi.fn(() => ({
          all: vi.fn(() => Promise.resolve({ results: mockThreads })),
        })),
      };
      (mockEnv.DB.prepare as any).mockReturnValue(mockStmt);

      await pio.prepare();
      const threads = await pio.getThreadList(20, 0);

      expect(threads).toHaveLength(2);
      expect(threads[0].no).toBe(1);
    });
  });
});
