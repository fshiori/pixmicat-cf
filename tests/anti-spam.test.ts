import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AntiSpamSystem } from '../src/lib/anti-spam';

describe('AntiSpamSystem', () => {
  let env: any;
  let antiSpam: AntiSpamSystem;

  beforeEach(() => {
    env = {
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: vi.fn(async () => null),
          })),
        })),
      },
      KV: {
        get: vi.fn(async () => null),
        put: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
      },
    };

    antiSpam = new AntiSpamSystem(env);
  });

  it('支援 regex ban pattern（修正順序後）', () => {
    const patterns = ['/^192\\.168\\./'];
    const result = antiSpam.checkBanPatterns('192.168.1.1', patterns);
    expect(result.isSpam).toBe(true);
  });

  it('不信任代理 header 時，不使用 X-Forwarded-For', () => {
    const request = {
      headers: new Headers({
        'X-Forwarded-For': '203.0.113.10',
      }),
    } as any;

    const ip = antiSpam.getClientIP(request, false);
    expect(ip).toBe('127.0.0.1');
  });

  it('信任代理 header 時，使用 X-Forwarded-For 第一個 IP', () => {
    const request = {
      headers: new Headers({
        'X-Forwarded-For': '203.0.113.10, 198.51.100.20',
      }),
    } as any;

    const ip = antiSpam.getClientIP(request, true);
    expect(ip).toBe('203.0.113.10');
  });

  it('永遠優先使用 CF-Connecting-IP', () => {
    const request = {
      headers: new Headers({
        'CF-Connecting-IP': '1.2.3.4',
        'X-Forwarded-For': '203.0.113.10',
      }),
    } as any;

    const ip = antiSpam.getClientIP(request, true);
    expect(ip).toBe('1.2.3.4');
  });

  it('trust_http_x_forwarded_for 可讀取舊鍵 trust_proxy_headers（alias）', async () => {
    env.KV.get = vi.fn(async (key: string) => {
      if (key === 'config:trust_http_x_forwarded_for') return null;
      if (key === 'config:trust_proxy_headers') return '1';
      return null;
    });

    const config = await antiSpam.getConfig();
    expect(config.trustProxyHeaders).toBe(true);
  });
});
