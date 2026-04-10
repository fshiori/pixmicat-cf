# 配置鍵參考文檔

本文檔說明 Pixmicat CF 中所有配置鍵的用途、預設值和安全考量。

---

## 📋 分類索引

- [顯示設定](#顯示設定)
- [表單設定](#表單設定)
- [安全與反垃圾](#安全與反垃圾)
- [討論串設定](#討論串設定)
- [檔案處理](#檔案處理)
- [系統設定](#系統設定)

---

## 顯示設定

### `show_image_dimensions`

**Canonical Key**: `show_image_dimensions`
**舊鍵名**: `show_imgwh`（已棄用，但仍支援）

**用途**：是否在文章中顯示圖片尺寸（寬x高）

**預設值**：`'1'`（顯示）

**格式**：字串 `'0'` 或 `'1'`

**範例**：
```sql
UPDATE configs SET value = '1' WHERE key = 'show_image_dimensions';
```

**注意事項**：
- 僅影響前端顯示，不影響功能
- 建議保持啟用以提供更好的用戶體驗

---

### `show_id`

**用途**：是否顯示發文者 ID

**預設值**：`'1'`（顯示）

**格式**：字串 `'0'` 或 `'1'`

**注意事項**：
- ID 是基於 IP 和日期的 hash
- 提供一定程度的匿名性

---

## 表單設定

### `use_floating_form`

**Canonical Key**: `use_floating_form`
**舊鍵名**: `use_float_form`（已棄用，但仍支援）

**用途**：是否使用浮動表單（固定在頁面底部）

**預設值**：`'0'`（不使用）

**格式**：字串 `'0'` 或 `'1'`

**優點**：
- 在長頁面中始終可見
- 提升移動設備體驗

**缺點**：
- 可能遮擋部分內容
- 需要更多 CSS

---

### `form_notice`

**Canonical Key**: `form_notice`
**舊鍵名**: `addition_info`（已棄用，但仍支援）

**用途**：在發文表單下方顯示的提示文字

**預設值**：
```
• 附檔請使用圖片 (GIF, JPG, PNG, WEBP)
• 請勿上傳違法圖片
• 同一 IP 60秒內只能發文一次
```

**格式**：HTML 字串（支援 `<br>` 換行）

**範例**：
```sql
UPDATE configs SET value = '• 歡迎發文！<br>• 請遵守規則' WHERE key = 'form_notice';
```

**安全考量**：
- ⚠️ **HTML 注入風險**：管理員編輯時需小心
- 建議僅使用簡單 HTML 標籤

---

### `default_name`

**用途**：預設的發文者名稱

**預設值**：`'無名氏'`

**格式**：純文字字串

---

### `default_title`

**用途**：預設的文章標題

**預設值**：`'無標題'`

**格式**：純文字字串

---

### `default_comment`

**用途**：預設的文章內文

**預設值**：`'無內文'`

**格式**：純文字字串

---

## 安全與反垃圾

### ⚠️ `trust_http_x_forwarded_for`

**Canonical Key**: `trust_http_x_forwarded_for`
**舊鍵名**: `trust_proxy_headers`（已棄用，但仍支援）

**用途**：是否信任 `X-Forwarded-For` 等 Proxy Header

**預設值**：`'0'`（**不信任**）

**格式**：字串 `'0'` 或 `'1'`

**🚨 重要安全警告**：

#### 何時不應啟用（絕大多數情況）
- 如果你的網站直接部署在 Cloudflare 上
- 如果前面沒有其他可信的 Reverse Proxy
- **啟用會導致 IP 欺騙風險**

#### 何時可以啟用（極少數情況）
- 你有 Cloudflare Enterprise + IP Firewall
- 你有其他可信的 Reverse Proxy（如 Cloudflare Access）
- 你完全理解安全風險

#### 技術細節

當啟用時，系統會依次檢查以下 Header：
1. `CF-Connecting-IP`（永遠優先，Cloudflare 提供）
2. `X-Real-IP`
3. `X-Forwarded-For`（取第一個 IP）
4. `X-Client-IP`
5. `X-Forwarded`
6. `Forwarded-For`
7. `Forwarded`

**關鍵**：`CF-Connecting-IP` 始終優先，不受此設定影響。

#### 配置範例

```sql
-- ❌ 不要輕易啟用
UPDATE configs SET value = '1' WHERE key = 'trust_http_x_forwarded_for';

-- ✅ 建議保持預設值
UPDATE configs SET value = '0' WHERE key = 'trust_http_x_forwarded_for';
```

#### 驗證設定

```javascript
// 在管理頁面 Console 中測試
fetch('/admin/api/test-ip')
  .then(r => r.json())
  .then(d => console.log('Detected IP:', d.ip));
```

---

### `ban_check`

**用途**：是否啟用反垃圾檢查

**預設值**：`'0'`（不啟用）

**格式**：字串 `'0'` 或 `'1'`

**相關設定**：
- `bad_strings`：禁止的關鍵字（JSON array）
- `bad_filemd5`：禁止的檔案 MD5（JSON array）
- `enable_dnsbl`：是否啟用 DNSBL
- `dnsbl_servers`：DNSBL 伺服器列表

---

### `enable_duplicate_check`

**用途**：是否啟用附檔 MD5 重複檢查

**預設值**：`'1'`（啟用）

**用途**：阻止相同的圖片重複上傳

**注意事項**：
- 僅檢查 MD5，不檢查內容
- 可能被繞過（修改 1 bit）

---

## 討論串設定

### `auto_bump_limit`

**Canonical Key**: `auto_bump_limit`
**舊鍵名**: `max_res`, `bump_limit`（已棄用，但仍支援）

**用途**：討論串推文數量達到此數後，不再自動推到頂部

**預設值**：`'0'`（無限制）

**格式**：數字字串

**範例**：
```sql
-- 設定為 500 回應後不再自動推文
UPDATE configs SET value = '500' WHERE key = 'auto_bump_limit';
```

---

### `max_age_time`

**用途**：討論串可接受推文的時間範圍（小時）

**預設值**：`'0'`（無限制）

**格式**：數字字串

**範例**：
```sql
-- 設定為 168 小時（7天）後關閉推文
UPDATE configs SET value = '168' WHERE key = 'max_age_time';
```

---

### `re_page_def`

**用途**：單一討論串回應每頁顯示數（0 = 不分頁）

**預設值**：`'0'`（不分頁）

**格式**：數字字串

**範例**：
```sql
-- 每頁顯示 50 個回應
UPDATE configs SET value = '50' WHERE key = 're_page_def';
```

---

### `threads_per_page`

**用途**：首頁每頁顯示的討論串數量

**預設值**：`'15'`

**格式**：數字字串

---

## 檔案處理

### `max_upload_size`

**用途**：最大上傳檔案大小（bytes）

**預設值**：`'10485760'`（10MB）

**格式**：數字字串

**計算**：
- 1MB = 1048576 bytes
- 10MB = 10485760 bytes

**注意事項**：
- Cloudflare Workers 限制：單次 request 最大 100MB
- R2 單檔限制：5GB

---

### `allowed_extensions`

**用途**：允許上傳的檔案副檔名

**預設值**：
```json
["jpg","jpeg","png","gif","webp"]
```

**格式**：JSON 陣列字串

**範例**：
```sql
UPDATE configs
SET value = '["jpg","jpeg","png","gif","webp","bmp"]'
WHERE key = 'allowed_extensions';
```

**安全警告**：
- ⚠️ 永遠不要允許 `.php`, `.js`, `.exe` 等可執行檔
- 僅允許圖片格式

---

## 系統設定

### `title`

**用途**：網站標題

**預設值**：`'Pixmicat!-CF'`

**格式**：純文字字串

---

### `default_language`

**用途**：預設語言

**預設值**：`'zh-TW'`

**格式**：語言代碼（如 `zh-TW`, `en-US`, `ja-JP`）

---

## 舊鍵名相容性

以下舊鍵名仍可使用，但建議遷移到新的 canonical key：

| 舊鍵名 | Canonical Key | 狀態 |
|--------|---------------|------|
| `show_imgwh` | `show_image_dimensions` | 棄用 |
| `use_float_form` | `use_floating_form` | 棄用 |
| `addition_info` | `form_notice` | 棄用 |
| `max_res` | `auto_bump_limit` | 棄用 |
| `bump_limit` | `auto_bump_limit` | 棄用 |
| `trust_proxy_headers` | `trust_http_x_forwarded_for` | 棄用 |

**遷移建議**：
```sql
-- 1. 確保新 key 存在
INSERT OR IGNORE INTO configs (key, value, description, updated_at)
VALUES ('show_image_dimensions',
  (SELECT value FROM configs WHERE key = 'show_imgwh'),
  '是否顯示圖片尺寸',
  strftime('%s', 'now'));

-- 2. 刪除舊 key
DELETE FROM configs WHERE key = 'show_imgwh';
```

---

## 故障排除

### 問題：修改配置後沒有生效

**原因**：KV 快取（1 小時 TTL）

**解決**：
```sql
-- 清除快取
DELETE FROM kv WHERE key LIKE 'config:%';
-- 或重啟伺服器
```

### 問題：配置值格式錯誤

**症狀**：功能異常、TypeError

**檢查**：
```sql
-- JSON 格式驗證
SELECT key, json_valid(value) FROM configs
WHERE key IN ('allowed_extensions', 'bad_strings');
```

---

**最後更新**：2026-04-10
**相關文檔**：[SETTINGS_COMPARISON.md](SETTINGS_COMPARISON.md), [REF_PARITY_REPORT.md](REF_PARITY_REPORT.md)
