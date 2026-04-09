/**
 * 測試類型定義
 */

// 模擬環境變數
export interface MockEnv {
  DB: {
    prepare: ReturnType<typeof vi.fn>;
    batch: ReturnType<typeof vi.fn>;
    exec: ReturnType<typeof vi.fn>;
  };
  STORAGE: {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  KV: {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
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
