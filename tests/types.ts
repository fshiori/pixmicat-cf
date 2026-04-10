/**
 * 測試類型定義
 */

import type { Mock } from 'vitest';

// 模擬環境變數
export interface MockEnv {
  DB: {
    prepare: Mock;
    batch: Mock;
    exec: Mock;
  };
  STORAGE: {
    get: Mock;
    put: Mock;
    delete: Mock;
    list: Mock;
  };
  KV: {
    get: Mock;
    put: Mock;
    delete: Mock;
  };
  ADMIN_PASSWORD?: string;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_CAP_ENABLED?: string;
  ADMIN_CAP_NAME?: string;
  ADMIN_CAP_PASSWORD?: string;
  ADMIN_CAP_SUFFIX?: string;
  ADMIN_CAP_ALLOW_HTML?: string;
}

// 模擬請求
export interface MockRequest {
  method: string;
  url: string;
  headers?: HeadersInit;
  body?: any;
}

// 模擬回應
export interface MockResponse {
  status: number;
  headers: Headers;
  body: any;
}
