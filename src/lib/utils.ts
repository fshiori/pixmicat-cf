/**
 * 工具函數庫
 */

/**
 * 生成 Tripcode（2ch 風格）
 */
export async function generateTripcode(key: string): Promise<string> {
  // 2ch Tripcode 使用特殊的 salt 處理
  // 將密碼和 salt 組合後進行雜湊
  const salt = generateTripcodeSalt(key);
  const combined = key + salt;

  // 使用 SHA-1 並轉換為 base64（類似 2ch 的處理方式）
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  const hash = await crypto.subtle.digest('SHA-1', data);

  // 取雜湊的前 10 個字元作為 Tripcode
  const tripArray = Array.from(new Uint8Array(hash)).slice(0, 10);
  return tripArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 10);
}

/**
 * 生成 Tripcode 使用的 salt
 * 2ch 風格：從 key 中提取字元，替換特殊字元
 */
function generateTripcodeSalt(key: string): string {
  // 2ch Tripcode salt 規則
  // 從 key 的後半部分提取，並替換特殊字元
  const specialChars = ':;<=>?@[\\]^_`';
  const replacements = 'ABCDEFGabcdef';

  let salt = '';
  const keyStr = key.substring(Math.floor(key.length / 2));

  for (let i = 0; i < keyStr.length && salt.length < 8; i++) {
    const char = keyStr[i];
    const idx = specialChars.indexOf(char);
    if (idx !== -1) {
      salt += replacements[idx % replacements.length];
    } else if (/[a-zA-Z0-9.]/.test(char)) {
      salt += char;
    }
  }

  // 確保 salt 至少有 2 個字元，前面加上 H.
  if (salt.length < 2) {
    salt = 'H.';
  } else {
    salt = 'H.' + salt.substring(0, 8);
  }

  return salt.substring(0, 12); // 限制長度
}

/**
 * 自動將 URL 轉換為超連結
 */
export function autoLinkUrls(text: string): string {
  // 匹配 HTTP/HTTPS URL
  const urlRegex = /(https?:\/\/[^\s<>]+)/g;
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="nofollow noreferrer">$1</a>');
}

/**
 * 處理引用系統 (>>No.xxx)
 */
export function processQuotes(text: string): string {
  // 處理 >>No.123 或 >>123 格式（未轉義的）
  let result = text.replace(/>>No\.(\d+)/g, (match, postNo) => {
    return `<a href="/res/${postNo}.htm">&gt;&gt;No.${postNo}</a>`;
  });
  result = result.replace(/>>(\d+)/g, (match, postNo) => {
    return `<a href="/res/${postNo}.htm">&gt;&gt;${postNo}</a>`;
  });
  // 處理已轉義的格式
  result = result.replace(/&gt;&gt;No\.(\d+)/g, (match, postNo) => {
    return `<a href="/res/${postNo}.htm">&gt;&gt;No.${postNo}</a>`;
  });
  result = result.replace(/&gt;&gt;(\d+)/g, (match, postNo) => {
    return `<a href="/res/${postNo}.htm">&gt;&gt;${postNo}</a>`;
  });
  return result;
}

/**
 * 處理內容（自動連結 + 引用系統 + 換行）
 */
export function processComment(text: string, enableAutoLink: boolean, enableQuotes: boolean): string {
  let processed = text;

  // 先處理換行
  processed = processed.replace(/\n/g, '<br/>');

  if (enableAutoLink) {
    processed = autoLinkUrls(processed);
  }

  if (enableQuotes) {
    // 處理 >>No.123 或 >>123 格式（未轉義的）
    processed = processed.replace(/&gt;&gt;No\.(\d+)/g, (match, postNo) => {
      return `<a href="/res/${postNo}.htm">&gt;&gt;No.${postNo}</a>`;
    });
    processed = processed.replace(/&gt;&gt;(\d+)/g, (match, postNo) => {
      return `<a href="/res/${postNo}.htm">&gt;&gt;${postNo}</a>`;
    });
    // 處理原始 >> 格式（未 HTML 轉義的）
    processed = processed.replace(/>>No\.(\d+)/g, (match, postNo) => {
      return `<a href="/res/${postNo}.htm">&gt;&gt;No.${postNo}</a>`;
    });
    processed = processed.replace(/>>(\d+)/g, (match, postNo) => {
      return `<a href="/res/${postNo}.htm">&gt;&gt;${postNo}</a>`;
    });
  }

  return processed;
}

/**
 * HTML 轉義
 */
export function htmlEscape(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * 計算是否為 sage（不推文）
 */
export function calculateSage(email: string): boolean {
  return email.toLowerCase() === 'sage';
}

/**
 * 格式化檔案大小
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  // 小於 1K 的位元組不顯示小數
  if (i === 0) {
    return `${Math.round(size)} B`;
  }
  return `${size.toFixed(2)} ${sizes[i]}`;
}

/**
 * 格式化時間戳
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}/${month}/${day}(${['日','一','二','三','四','五','六'][date.getDay()]})${hour}:${minute}:${second}`;
}
