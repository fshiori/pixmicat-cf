/**
 * 工具函數單元測試
 */

import { describe, it, expect } from 'vitest';
import {
  htmlEscape,
  autoLinkUrls,
  processQuotes,
  processComment,
  formatSize,
  formatDate,
  generateTripcode,
  calculateSage,
} from '../src/lib/utils';

describe('htmlEscape', () => {
  it('應該轉義 HTML 特殊字符', () => {
    expect(htmlEscape('<script>')).toBe('&lt;script&gt;');
    expect(htmlEscape('<div class="test">')).toBe('&lt;div class=&quot;test&quot;&gt;');
    expect(htmlEscape('&')).toBe('&amp;');
    expect(htmlEscape('"')).toBe('&quot;');
    expect(htmlEscape("'")).toBe('&#039;');
  });

  it('應該保留正常文本', () => {
    expect(htmlEscape('正常文本')).toBe('正常文本');
    expect(htmlEscape('Hello World')).toBe('Hello World');
  });
});

describe('autoLinkUrls', () => {
  it('應該自動連結 HTTP URL', () => {
    const input = 'Visit https://example.com for more info';
    const result = autoLinkUrls(input);
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="nofollow');
  });

  it('應該自動連結多個 URL', () => {
    const input = 'Visit https://example.com and http://test.org';
    const result = autoLinkUrls(input);
    expect(result).toContain('https://example.com');
    expect(result).toContain('http://test.org');
  });

  it('不應該重複連結已經有連結的 URL', () => {
    const input = '<a href="https://example.com">Link</a>';
    const result = autoLinkUrls(input);
    // 應該保留原始連結
    expect(result).toContain('<a href="https://example.com"');
  });
});

describe('processQuotes', () => {
  it('應該轉換 >>No.123 為引用連結', () => {
    const input = '回應 >>No.123 的文章';
    const result = processQuotes(input);
    expect(result).toContain('<a href="/res/123.htm');
    expect(result).toContain('&gt;&gt;No.123</a>');
  });

  it('應該處理多個引用', () => {
    const input = '回應 >>No.1 和 >>No.2';
    const result = processQuotes(input);
    expect(result).toContain('/res/1.htm');
    expect(result).toContain('/res/2.htm');
  });

  it('應該轉換 >>123 為引用連結', () => {
    const input = '回應 >>123 的文章';
    const result = processQuotes(input);
    expect(result).toContain('<a href="/res/123.htm');
    expect(result).toContain('&gt;&gt;123</a>');
  });
});

describe('processComment', () => {
  it('應該同時處理自動連結和引用', () => {
    const input = 'Visit https://example.com and reply to >>No.123';
    const result = processComment(input, true, true);
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain('/res/123.htm');
  });

  it('應該只處理引用', () => {
    const input = '回應 >>No.456 的文章';
    const result = processComment(input, false, true);
    expect(result).toContain('/res/456.htm');
  });

  it('應該保留換行符', () => {
    const input = '第一行\n第二行\n第三行';
    const result = processComment(input, false, false);
    expect(result).toContain('第一行<br/>第二行<br/>第三行');
  });
});

describe('formatSize', () => {
  it('應該格式化位元組', () => {
    expect(formatSize(500)).toBe('500 B');
    expect(formatSize(1024)).toBe('1.00 KB');
    expect(formatSize(1048576)).toBe('1.00 MB');
    expect(formatSize(1073741824)).toBe('1.00 GB');
  });

  it('應該處理小數', () => {
    expect(formatSize(1536)).toBe('1.50 KB');
    expect(formatSize(1572864)).toBe('1.50 MB');
  });

  it('應該處理 0', () => {
    expect(formatSize(0)).toBe('0 B');
  });
});

describe('formatDate', () => {
  it('應該格式化時間戳', () => {
    const timestamp = 1234567890;
    const result = formatDate(timestamp);
    expect(result).toContain('2009'); // 1234567890 是 2009-02-13
  });

  it('應該處理當前時間', () => {
    const now = Math.floor(Date.now() / 1000);
    const result = formatDate(now);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});

describe('generateTripcode', () => {
  it('應該生成 Tripcode', async () => {
    const tripcode = await generateTripcode('password');
    expect(tripcode).toBeDefined();
    expect(typeof tripcode).toBe('string');
    expect(tripcode.length).toBeGreaterThan(0);
  });

  it('相同密碼應該生成相同 Tripcode', async () => {
    const tripcode1 = await generateTripcode('test123');
    const tripcode2 = await generateTripcode('test123');
    expect(tripcode1).toBe(tripcode2);
  });

  it('不同密碼應該生成不同 Tripcode', async () => {
    const tripcode1 = await generateTripcode('password1');
    const tripcode2 = await generateTripcode('password2');
    expect(tripcode1).not.toBe(tripcode2);
  });

  it('空密碼應該正常處理', async () => {
    const tripcode = await generateTripcode('');
    expect(tripcode).toBeDefined();
  });

  it('應該處理特殊字符', async () => {
    const tripcode = await generateTripcode('test!@#$%^&*()');
    expect(tripcode).toBeDefined();
    expect(typeof tripcode).toBe('string');
  });
});

describe('calculateSage', () => {
  it('應該檢測 sage', () => {
    expect(calculateSage('sage')).toBe(true);
    expect(calculateSage('SAGE')).toBe(true);
    expect(calculateSage('Sage')).toBe(true);
  });

  it('應該檢測非 sage Email', () => {
    expect(calculateSage('test@example.com')).toBe(false);
    expect(calculateSage('')).toBe(false);
    expect(calculateSage('noko')).toBe(false);
  });
});
