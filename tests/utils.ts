/**
 * 測試工具函數
 */

import { vi } from 'vitest';
import type { MockEnv } from './types';

/**
 * 創建模擬環境
 */
export function createMockEnv(): MockEnv {
  return {
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
      get: vi.fn(() => Promise.resolve(null)),
      put: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
      list: vi.fn(() => Promise.resolve({ objects: [] })),
    },
    KV: {
      get: vi.fn(() => Promise.resolve(null)),
      put: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve()),
    },
  };
}

/**
 * 創建模擬請求
 */
export function createMockRequest(
  url: string,
  method: string = 'GET',
  body?: any
): Request {
  const init: RequestInit = {
    method,
    headers: {},
  };

  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  return new Request(url, init);
}

/**
 * 創建模擬表單數據
 */
export function createMockFormData(data: Record<string, string | File>): FormData {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
}

/**
 * 等待異步操作
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 模擬延遲
 */
export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
