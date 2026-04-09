// 測試環境設定
import { vi } from 'vitest';

// 模擬 Cloudflare Workers 環境
global.Response = Response;
global.Request = Request;
global.Headers = Headers;

// 模擬 crypto.subtle
if (!global.crypto) {
  global.crypto = {
    subtle: {
      digest: vi.fn(async (algorithm: string, data: Uint8Array) => {
        // 簡單的 mock：返回資料的長度作為 hash
        const hash = new Uint8Array([data.length % 256]);
        return hash.buffer;
      }),
    },
  } as any;
}

// 模擬 URL 和 URLSearchParams
global.URL = URL as any;
global.URLSearchParams = URLSearchParams as any;
