/**
 * Anti-Spam System
 * 反垃圾訊息檢查系統
 * 參考 Pixmicat! 的反垃圾機制
 */

import type { Env } from '../types';

export interface AntiSpamConfig {
  banCheck: boolean;
  badStrings: string[];
  badFileMD5s: string[];
  enableDNSBL: boolean;
  dnsblServers: string[];
  dnsblWhitelist: string[];
  trustProxyHeaders: boolean;
}

export interface SpamCheckResult {
  isSpam: boolean;
  reason?: string;
  details?: string;
}

export class AntiSpamSystem {
  constructor(private env: Env) {}

  /**
   * 取得反垃圾設定
   */
  async getConfig(): Promise<AntiSpamConfig> {
    return {
      banCheck: (await this.getEnvValue('ban_check', '0')) === '1',
      badStrings: await this.getStringArrayConfig('bad_strings', []),
      badFileMD5s: await this.getStringArrayConfig('bad_filemd5', []),
      enableDNSBL: (await this.getEnvValue('enable_dnsbl', '0')) === '1',
      dnsblServers: await this.getStringArrayConfig('dnsbl_servers', [
        'sbl-xbl.spamhaus.org',
        'list.dsbl.org',
        'bl.spamcop.net'
      ]),
      dnsblWhitelist: await this.getStringArrayConfig('dnsbl_whitelist', []),
      trustProxyHeaders: (await this.getEnvValue('trust_proxy_headers', '0')) === '1',
    };
  }

  /**
   * 綜合檢查是否為垃圾訊息
   */
  async checkSpam(
    name: string,
    email: string,
    sub: string,
    com: string,
    fileMD5?: string,
    request?: Request
  ): Promise<SpamCheckResult> {
    const config = await this.getConfig();

    // 如果未啟用反垃圾檢查，直接通過
    if (!config.banCheck) {
      return { isSpam: false };
    }

    // 1. 檢查 IP 封鎖（來自資料庫）
    if (request) {
      const ipBanResult = await this.checkIPBan(request);
      if (ipBanResult.isSpam) {
        return ipBanResult;
      }
    }

    // 2. 檢查限制文字
    const badStringResult = this.checkBadStrings(name, email, sub, com, config.badStrings);
    if (badStringResult.isSpam) {
      return badStringResult;
    }

    // 3. 檢查檔案 MD5
    if (fileMD5) {
      const badMD5Result = this.checkBadFileMD5(fileMD5, config.badFileMD5s);
      if (badMD5Result.isSpam) {
        return badMD5Result;
      }
    }

    // 4. 檢查 DNSBL（如果啟用）
    if (config.enableDNSBL && request) {
      const dnsblResult = await this.checkDNSBL(request, config);
      if (dnsblResult.isSpam) {
        return dnsblResult;
      }
    }

    return { isSpam: false };
  }

  /**
   * 檢查 IP 是否被封鎖
   */
  async checkIPBan(request: Request): Promise<SpamCheckResult> {
    const ip = this.getClientIP(request);

    const result = await this.env.DB.prepare(
      'SELECT * FROM bans WHERE ip = ? AND (expires_at IS NULL OR expires_at > ?)'
    )
      .bind(ip, Math.floor(Date.now() / 1000))
      .first();

    if (result) {
      return {
        isSpam: true,
        reason: 'IP被封鎖',
        details: (result as any).reason || '無資訊',
      };
    }

    return { isSpam: false };
  }

  /**
   * 檢查限制文字
   */
  checkBadStrings(
    name: string,
    email: string,
    sub: string,
    com: string,
    badStrings: string[]
  ): SpamCheckResult {
    const allText = `${name} ${email} ${sub} ${com}`.toLowerCase();

    for (const badStr of badStrings) {
      if (badStr && allText.includes(badStr.toLowerCase())) {
        return {
          isSpam: true,
          reason: '內文包含限制文字',
          details: `包含禁止詞：${badStr}`,
        };
      }
    }

    return { isSpam: false };
  }

  /**
   * 檢查檔案 MD5
   */
  checkBadFileMD5(md5: string, badMD5s: string[]): SpamCheckResult {
    if (badMD5s.includes(md5)) {
      return {
        isSpam: true,
        reason: '檔案 MD5 在封鎖列表中',
        details: `MD5: ${md5}`,
      };
    }

    return { isSpam: false };
  }

  /**
   * 檢查 DNSBL（DNS Black List）
   */
  async checkDNSBL(request: Request, config: AntiSpamConfig): Promise<SpamCheckResult> {
    const ip = this.getClientIP(request);

    // 檢查白名單
    if (config.dnsblWhitelist.includes(ip)) {
      return { isSpam: false };
    }

    // 檢查 DNSBL 伺服器
    for (const server of config.dnsblServers) {
      const isListed = await this.queryDNSBL(ip, server);
      if (isListed) {
        return {
          isSpam: true,
          reason: 'IP 在 DNSBL 列表中',
          details: `在 ${server} 列表中`,
        };
      }
    }

    return { isSpam: false };
  }

  /**
   * 查詢 DNSBL
   */
  private async queryDNSBL(ip: string, dnsblServer: string): Promise<boolean> {
    try {
      // 將 IP 反轉並加上 DNSBL 伺服器
      // 例如：192.0.2.1 -> 1.2.0.192.sbl-xbl.spamhaus.org
      const reversedIP = ip.split('.').reverse().join('.');
      const queryHost = `${reversedIP}.${dnsblServer}`;

      // 使用 DNS 查詢
      // 注意：Cloudflare Workers 中需要使用外部 DNS API 或自定義實作
      // 這裡使用簡化版本：通過 fetch 調用 DNS over HTTPS API
      const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${queryHost}&type=A`, {
        headers: {
          'Accept': 'application/dns-json',
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();

      // 如果有回答，表示在黑名單中
      return !!(data.Answer && data.Answer.length > 0);
    } catch (error) {
      console.error('DNSBL query failed:', error);
      return false;
    }
  }

  /**
   * 取得客戶端 IP
   */
  getClientIP(request: Request): string {
    // 嘗試從多種 Header 中取得真實 IP
    const headers = (request as any).headers;

    // 代理 Header 列表（依優先順序）
    const proxyHeaders = [
      'CF-Connecting-IP', // Cloudflare
      'X-Real-IP',
      'X-Forwarded-For',
      'X-Client-IP',
      'X-Forwarded',
      'Forwarded-For',
      'Forwarded',
    ];

    for (const header of proxyHeaders) {
      const value = headers.get(header);
      if (value) {
        // X-Forwarded-For 可能包含多個 IP，取第一個
        const ips = value.split(',').map(ip => ip.trim());
        return ips[0];
      }
    }

    // 如果沒有代理 Header，回傳預設值
    return '127.0.0.1';
  }

  /**
   * 輔助：取得環境變數值
   */
  private async getEnvValue(key: string, defaultValue: string): Promise<string> {
    try {
      const cached = await this.env.KV.get(`config:${key}`);
      if (cached) return cached;

      const result = await this.env.DB.prepare('SELECT value FROM configs WHERE key = ?')
        .bind(key)
        .first();

      return (result as any)?.value || defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * 輔助：取得字串陣列設定
   */
  private async getStringArrayConfig(key: string, defaultValue: string[]): Promise<string[]> {
    const value = await this.getEnvValue(key, '');
    if (!value) return defaultValue;

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : defaultValue;
    } catch {
      // 如果不是 JSON，嘗試用逗號分隔
      return value.split(',').map(s => s.trim()).filter(s => s);
    }
  }
}
