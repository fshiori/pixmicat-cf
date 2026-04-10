/**
 * PIOD1 單元測試
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PIOD1 } from '../src/lib/pio-d1';
import type { MockEnv } from './types';
import type { Post } from '../src/types';

describe('PIOD1', () => {
  let mockEnv: MockEnv;
  let pio: PIOD1;
  let mockStmt: any;

  beforeEach(() => {
    // 創建基本的 mock statement
    mockStmt = {
      bind: vi.fn(() => mockStmt),
      all: vi.fn(() => Promise.resolve({ results: [] })),
      first: vi.fn(() => Promise.resolve(null)),
      run: vi.fn(() => Promise.resolve({ meta: {} })),
    };

    // 創建模擬環境
    mockEnv = {
      DB: {
        prepare: vi.fn(() => mockStmt),
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
      expect(pio).toBeDefined();
    });
  });

  describe('fetchPosts', () => {
    it('應該返回空陣列如果文章不存在', async () => {
      await pio.prepare();
      const posts = await pio.fetchPosts([999999]);

      expect(posts).toEqual([]);
    });

    it('應該返回文章數據', async () => {
      const mockPost = {
        no: 1,
        resto: 0,
        name: '測試用戶',
        email: '',
        sub: '測試標題',
        com: '測試內容',
        time: 1234567890,
      };

      mockStmt.all = vi.fn(() => Promise.resolve({ results: [mockPost] }));

      await pio.prepare();
      const posts = await pio.fetchPosts([1]);

      expect(posts).toHaveLength(1);
      expect(posts[0]).toEqual(mockPost);
    });

    it('應該支持單一文章查詢', async () => {
      const mockPost = {
        no: 1,
        resto: 0,
        name: '測試用戶',
      };

      mockStmt.all = vi.fn(() => Promise.resolve({ results: [mockPost] }));

      await pio.prepare();
      const posts = await pio.fetchPosts(1);

      expect(posts).toHaveLength(1);
      expect(posts[0]).toEqual(mockPost);
    });
  });

  describe('getThread', () => {
    it('應該返回 null 如果討論串不存在', async () => {
      await pio.prepare();
      const thread = await pio.getThread(999999);

      expect(thread).toBeNull();
    });

    it('應該返回討論串和回應', async () => {
      const opPost = { no: 1, resto: 0, name: 'OP', time: 1234567890 };
      const replyPosts = [
        { no: 2, resto: 1, name: '回應者', time: 1234567891 },
        { no: 3, resto: 1, name: '回應者2', time: 1234567892 },
      ];

      // 模擬多個調用返回不同結果
      let callCount = 0;
      mockStmt.all = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          // 第一次：fetchPosts(threadNo) - 取得 OP
          return Promise.resolve({ results: [opPost] });
        } else if (callCount === 2) {
          // 第二次：fetchPostList - 取得回應編號
          return Promise.resolve({ results: replyPosts.map(p => ({ no: p.no })) });
        } else if (callCount === 3) {
          // 第三次：fetchPosts(replyNos) - 取得回應
          return Promise.resolve({ results: replyPosts });
        }
        return Promise.resolve({ results: [] });
      });

      await pio.prepare();
      const thread = await pio.getThread(1);

      expect(thread).toBeDefined();
      expect(thread?.posts).toBeDefined();
      // 至少應該有 OP
      expect(thread?.posts.length).toBeGreaterThan(0);
    });

    it('應該正確計算回應數量', async () => {
      const opPost = { no: 1, resto: 0, name: 'OP', time: 1234567890 };
      const replyPosts = [
        { no: 2, resto: 1, name: '回應者1', time: 1234567891 },
        { no: 3, resto: 1, name: '回應者2', time: 1234567892 },
        { no: 4, resto: 1, name: '回應者3', time: 1234567893 },
      ];

      let callCount = 0;
      mockStmt.all = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ results: [opPost] });
        } else if (callCount === 2) {
          return Promise.resolve({ results: replyPosts.map(p => ({ no: p.no })) });
        } else if (callCount === 3) {
          return Promise.resolve({ results: replyPosts });
        }
        return Promise.resolve({ results: [] });
      });

      await pio.prepare();
      const thread = await pio.getThread(1);

      expect(thread).toBeDefined();
      expect(thread?.reply_count).toBe(3);
    });
  });

  describe('addPost', () => {
    it('應該成功創建文章', async () => {
      const postData: Partial<Post> = {
        name: '測試用戶',
        email: '',
        sub: '測試標題',
        com: '測試內容',
        resto: 0,
        time: 1234567890,
      };

      mockStmt.run = vi.fn(() => Promise.resolve({ success: true, meta: { last_row_id: { id: 123 } } }));
      mockStmt.first = vi.fn(() => Promise.resolve({ max_no: 0 })); // for getLastPostNo

      await pio.prepare();
      const no = await pio.addPost(postData);

      expect(no).toBeGreaterThan(0);
    });

    it('應該使用預設值', async () => {
      const postData: Partial<Post> = {
        name: '測試用戶',
        resto: 0,
      };

      mockStmt.run = vi.fn(() => Promise.resolve({ success: true, meta: { last_row_id: { id: 1 } } }));
      mockStmt.first = vi.fn(() => Promise.resolve({ max_no: 0 })); // for getLastPostNo

      await pio.prepare();
      const no = await pio.addPost(postData);

      expect(no).toBe(1);
    });
  });

  describe('removePosts', () => {
    it('應該成功刪除單一文章', async () => {
      mockStmt.run = vi.fn(() => Promise.resolve({ success: true, meta: {} }));
      mockStmt.all = vi.fn(() => Promise.resolve({ results: [] }));

      await pio.prepare();
      const deleted = await pio.removePosts([1]);

      // removePosts 返回附件列表，不是文章編號
      expect(deleted).toEqual([]);
    });

    it('應該支援批次刪除', async () => {
      mockStmt.run = vi.fn(() => Promise.resolve({ success: true, meta: {} }));
      mockStmt.all = vi.fn(() => Promise.resolve({ results: [] }));

      await pio.prepare();
      const deleted = await pio.removePosts([1, 2, 3]);

      // removePosts 返回附件列表，不是文章編號
      expect(deleted).toEqual([]);
    });

    it('應該返回附件列表', async () => {
      // Mock 有附件的文章
      mockStmt.all = vi.fn(() => {
        return Promise.resolve({
          results: [
            { tim: '1234567890', ext: '.jpg' },
            { tim: '1234567891', ext: '.png' },
          ]
        });
      });

      mockStmt.run = vi.fn(() => Promise.resolve({ success: true, meta: {} }));

      await pio.prepare();
      const deleted = await pio.removePosts([1]);

      // 應該返回附件檔案名稱（包含縮圖）
      expect(deleted).toContain('1234567890.jpg');
      expect(deleted).toContain('1234567890s.jpg');
      expect(deleted).toContain('1234567891.png');
      expect(deleted).toContain('1234567891s.jpg');
    });

    it('應該清除附件資訊並刪除文章', async () => {
      let allCallCount = 0;
      let runCallCount = 0;

      mockStmt.all = vi.fn(() => {
        allCallCount++;
        if (allCallCount === 1) {
          // 第一次調用：查詢附件（recursion = true）
          return Promise.resolve({
            results: [
              { tim: '1234567890', ext: '.jpg' },
            ]
          });
        }
        return Promise.resolve({ results: [] });
      });

      mockStmt.run = vi.fn(() => {
        runCallCount++;
        return Promise.resolve({ success: true, meta: {} });
      });

      await pio.prepare();
      const deleted = await pio.removePosts([1]);

      // 應該調用 all 一次（查詢附件）和 run 一次（刪除文章）
      expect(allCallCount).toBeGreaterThanOrEqual(1);
      expect(runCallCount).toBeGreaterThanOrEqual(1);
      // 返回附件列表
      expect(deleted).toContain('1234567890.jpg');
      expect(deleted).toContain('1234567890s.jpg');
    });
  });

  describe('fetchThreadList', () => {
    it('應該返回空陣列如果沒有討論串', async () => {
      await pio.prepare();
      const threadNos = await pio.fetchThreadList(20, 0);

      expect(threadNos).toEqual([]);
    });

    it('應該返回討論串編號列表', async () => {
      const mockThreads = [
        { thread_no: 1 },
        { thread_no: 2 },
      ];

      mockStmt.all = vi.fn(() => Promise.resolve({ results: mockThreads }));

      await pio.prepare();
      const threadNos = await pio.fetchThreadList(20, 0);

      expect(threadNos).toHaveLength(2);
      expect(threadNos[0]).toBe(1);
      expect(threadNos[1]).toBe(2);
    });
  });

  describe('postCount', () => {
    it('應該返回文章總數', async () => {
      mockStmt.first = vi.fn(() => Promise.resolve({ count: 100 }));

      const count = await pio.postCount();

      expect(count).toBe(100);
    });

    it('應該返回指定討論串的文章數', async () => {
      const bindMock = vi.fn(() => ({
        first: vi.fn(() => Promise.resolve({ count: 5 })),
      }));

      mockStmt.bind = bindMock;

      const count = await pio.postCount(1);

      expect(count).toBe(5);
    });
  });

  describe('threadCount', () => {
    it('應該返回討論串總數', async () => {
      mockStmt.first = vi.fn(() => Promise.resolve({ count: 10 }));

      const count = await pio.threadCount();

      expect(count).toBe(10);
    });
  });

  describe('getLastPostNo', () => {
    it('應該返回最後文章編號（afterCommit）', async () => {
      mockStmt.first = vi.fn(() => Promise.resolve({ max_no: 999 }));

      const no = await pio.getLastPostNo('afterCommit');

      expect(no).toBe(999);
    });

    it('應該返回追蹤的編號（beforeCommit）', async () => {
      const no = await pio.getLastPostNo('beforeCommit');

      expect(no).toBe(0); // 初始值
    });
  });

  describe('searchPosts', () => {
    it('應該搜尋文章', async () => {
      const mockPosts = [
        { no: 1, sub: '測試標題', com: '測試內容' },
        { no: 2, sub: '相關標題', com: '相關內容' },
      ];

      mockStmt.all = vi.fn(() => Promise.resolve({ results: mockPosts }));

      await pio.prepare();
      const posts = await pio.searchPosts('測試');

      expect(posts).toHaveLength(2);
      expect(posts[0].no).toBe(1);
      expect(posts[1].no).toBe(2);
    });

    it('應該返回空陣列如果沒有結果', async () => {
      await pio.prepare();
      const posts = await pio.searchPosts('不存在');

      expect(posts).toEqual([]);
    });
  });

  describe('getPostByMD5', () => {
    it('應該返回 null 如果 MD5 不存在', async () => {
      const bindMock = vi.fn(() => ({
        first: vi.fn(() => Promise.resolve(null)),
      }));

      mockStmt.bind = bindMock;

      await pio.prepare();
      const post = await pio.getPostByMD5('abc123');

      expect(post).toBeNull();
    });

    it('應該返回文章如果 MD5 存在', async () => {
      const mockPost = {
        no: 1,
        resto: 0,
        name: '測試用戶',
        md5: 'abc123',
      };

      const bindMock = vi.fn(() => ({
        first: vi.fn(() => Promise.resolve(mockPost)),
      }));

      mockStmt.bind = bindMock;

      await pio.prepare();
      const post = await pio.getPostByMD5('abc123');

      expect(post).toBeDefined();
      expect(post?.no).toBe(1);
      expect(post?.md5).toBe('abc123');
    });
  });

  describe('version', () => {
    it('應該返回版本號', () => {
      const version = pio.version();
      expect(version).toBe('0.1.0-d1');
    });
  });

  describe('connect', () => {
    it('應該成功連線', async () => {
      await expect(pio.connect()).resolves.toBeUndefined();
    });
  });

  describe('init', () => {
    it('應該成功初始化', async () => {
      await expect(pio.init()).resolves.toBeUndefined();
    });

    it('應該支持不加入初始資料', async () => {
      await expect(pio.init(false)).resolves.toBeUndefined();
    });
  });

  describe('commit', () => {
    it('應該成功提交', async () => {
      await expect(pio.commit()).resolves.toBeUndefined();
    });
  });

  describe('maintenance', () => {
    it('應該拒絕無效的動作', async () => {
      const result = await pio.maintenance('invalid');
      expect(result).toBe(false);
    });

    it('應該接受有效的動作（不執行）', async () => {
      const result = await pio.maintenance('optimize', false);
      expect(result).toBe(true);
    });

    it('應該執行 VACUUM', async () => {
      mockStmt.all = vi.fn(() => Promise.resolve({ results: [] }));

      const result = await pio.maintenance('vacuum', true);
      expect(result).toBe(true);
    });

    it('應該執行 ANALYZE', async () => {
      mockStmt.all = vi.fn(() => Promise.resolve({ results: [] }));

      const result = await pio.maintenance('analyze', true);
      expect(result).toBe(true);
    });
  });

  describe('fetchPostList', () => {
    it('應該返回文章編號列表', async () => {
      const mockPosts = [
        { no: 1 },
        { no: 2 },
        { no: 3 },
      ];

      mockStmt.all = vi.fn(() => Promise.resolve({ results: mockPosts }));

      await pio.prepare();
      const postNos = await pio.fetchPostList(0, 0, 10);

      expect(postNos).toHaveLength(3);
      expect(postNos).toEqual([1, 2, 3]);
    });

    it('應該支持指定討論串', async () => {
      const mockPosts = [
        { no: 2 },
        { no: 3 },
      ];

      mockStmt.all = vi.fn(() => Promise.resolve({ results: mockPosts }));

      await pio.prepare();
      const postNos = await pio.fetchPostList(1, 0, 10);

      expect(postNos).toHaveLength(2);
    });
  });

  describe('updatePost', () => {
    it('應該更新文章', async () => {
      mockStmt.run = vi.fn(() => Promise.resolve({ success: true, meta: { changes: 1 } }));

      await pio.prepare();
      const result = await pio.updatePost(1, { sticky: 1 });

      expect(result).toBe(true);
    });

    it('應該返回 false 如果沒有變更', async () => {
      mockStmt.run = vi.fn(() => Promise.resolve({ success: true, meta: { changes: 0 } }));

      await pio.prepare();
      const result = await pio.updatePost(1, { sticky: 1 });

      expect(result).toBe(false);
    });

    it('應該返回 false 如果沒有欄位更新', async () => {
      await pio.prepare();
      const result = await pio.updatePost(1, {});

      expect(result).toBe(false);
    });
  });
});
