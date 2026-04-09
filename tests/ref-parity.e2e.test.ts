import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AntiSpamSystem } from '../src/lib/anti-spam';

describe('E2E: ref parity anti-spam flow', () => {
  let env: any;
  let antiSpam: AntiSpamSystem;

  beforeEach(() => {
    env = {
      DB: {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn((...args: any[]) => ({
            first: vi.fn(async () => {
              // bans 查詢：預設沒命中
              if (sql.includes('FROM bans')) return null;
              // configs 查詢
              if (sql.includes('FROM configs')) {
                const key = args[0];
                const map: Record<string, string> = {
                  ban_check: '1',
                  bad_strings: '["viagra"]',
                  bad_filemd5: '[]',
                  enable_dnsbl: '0',
                  dnsbl_servers: '[]',
                  dnsbl_whitelist: '[]',
                  ban_patterns: '["/^203\\\\.0\\\\.113\\\\./"]',
                  trust_http_x_forwarded_for: '1',
                };
                if (map[key] !== undefined) return { value: map[key] };
                return null;
              }
              return null;
            }),
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

  it('從 request → IP 解析 → BANPATTERN 規則，完整攔截', async () => {
    const request = {
      headers: new Headers({
        'X-Forwarded-For': '203.0.113.45, 198.51.100.3',
      }),
    } as any;

    const result = await antiSpam.checkSpam(
      'user',
      '',
      'hello',
      'normal content',
      undefined,
      request
    );

    expect(result.isSpam).toBe(true);
    expect(result.reason).toBe('IP符合封鎖模式');
  });
});
