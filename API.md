# Pixmicat-CF API 文件

## 基礎資訊

- **Base URL**: `https://your-worker.workers.dev`
- **Content-Type**: `application/json` 或 `multipart/form-data`
- **Response Format**: JSON

## 回應格式

所有 API 回應都遵循以下格式：

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

## API 端點

### 1. 取得討論串列表

**端點**: `GET /api/threads`

**參數**:
- `page` (optional): 頁碼，預設 1
- `limit` (optional): 每頁數量，預設 20

**回傳**:
```json
{
  "success": true,
  "data": [
    {
      "no": 1234567890,
      "resto": 0,
      "posts": [...],
      "reply_count": 5,
      "image_count": 2,
      "last_reply_time": 1234567890,
      "sticky": 0,
      "locked": 0
    }
  ]
}
```

**範例**:
```bash
curl https://your-worker.workers.dev/api/threads?page=1&limit=20
```

---

### 2. 取得單一討論串

**端點**: `GET /api/thread/:no`

**參數**:
- `no`: 討論串編號（路徑參數）

**回傳**:
```json
{
  "success": true,
  "data": {
    "no": 1234567890,
    "posts": [
      {
        "no": 1234567890,
        "resto": 0,
        "name": "無名氏",
        "email": "",
        "sub": "標題",
        "com": "內容",
        "time": 1234567890,
        "tim": "1234567890",
        "ext": ".jpg",
        "filename": "image.jpg",
        "w": 1920,
        "h": 1080,
        "tn_w": 250,
        "tn_h": 140,
        "filesize": 123456,
        "md5": "abc123..."
      }
    ],
    "reply_count": 5,
    "image_count": 2,
    "last_reply_time": 1234567890,
    "sticky": 0,
    "locked": 0
  }
}
```

**錯誤回應** (404):
```json
{
  "success": false,
  "error": "Thread not found"
}
```

---

### 3. 新增文章/回應

**端點**: `POST /api/post`

**Content-Type**: `multipart/form-data`

**參數**:
- `name` (optional): 發文名稱，預設「無名氏」
- `email` (optional): Email 或 cap code
- `sub` (optional): 標題
- `com` (optional): 內容
- `file` (optional): 圖片檔案
- `password` (optional): 刪除密碼
- `category` (optional): 分類標籤
- `resto` (required): 回應編號，0 = 新主題

**回傳** (成功):
```json
{
  "success": true,
  "data": {
    "no": 1234567890,
    "redirect": "/"
  }
}
```

**錯誤回應**:
```json
{
  "success": false,
  "error": "錯誤訊息"
}
```

**範例** (curl):
```bash
# 新主題
curl -X POST https://your-worker.workers.dev/api/post \
  -F "name=測試" \
  -F "sub=標題" \
  -F "com=內容" \
  -F "password=123456" \
  -F "resto=0" \
  -F "file=@image.jpg"

# 回應
curl -X POST https://your-worker.workers.dev/api/post \
  -F "com=回應內容" \
  -F "password=123456" \
  -F "resto=1234567890"
```

---

### 4. 刪除文章

**端點**: `POST /api/delete`

**Content-Type**: `multipart/form-data`

**參數**:
- `no` (required): 文章編號
- `password` (required): 刪除密碼

**回傳** (成功):
```json
{
  "success": true
}
```

**錯誤回應**:
```json
{
  "success": false,
  "error": "密碼錯誤"
}
```

**範例**:
```bash
curl -X POST https://your-worker.workers.dev/api/delete \
  -F "no=1234567890" \
  -F "password=123456"
```

---

### 5. 搜尋文章

**端點**: `GET /api/search`

**參數**:
- `q` (required): 搜尋關鍵字
- `type` (optional): 搜尋類型，`all`|`subject`|`content`，預設 `all`
- `page` (optional): 頁碼，預設 1
- `limit` (optional): 每頁數量，預設 20

**回傳**:
```json
{
  "success": true,
  "data": [
    {
      "no": 1234567890,
      "resto": 0,
      "name": "無名氏",
      "sub": "包含關鍵字的標題",
      "com": "包含關鍵字的內容",
      "time": 1234567890,
      ...
    }
  ]
}
```

**範例**:
```bash
# 搜尋全部
curl https://your-worker.workers.dev/api/search?q=關鍵字

# 只搜尋標題
curl https://your-worker.workers.dev/api/search?q=關鍵字&type=subject

# 只搜尋內容
curl https://your-worker.workers.dev/api/search?q=關鍵字&type=content
```

---

### 6. 取得圖片

**端點**: `GET /img/:filename`

**參數**:
- `filename`: 圖片檔名 (例如: `1234567890.jpg`)

**回傳**: 圖片檔案二進位資料

**範例**:
```bash
curl https://your-worker.workers.dev/img/1234567890.jpg --output image.jpg
```

---

### 7. 取得縮圖

**端點**: `GET /thumb/:filename`

**參數**:
- `filename`: 縮圖檔名 (例如: `1234567890s.jpg`)

**回傳**: 縮圖檔案二進位資料

**範例**:
```bash
curl https://your-worker.workers.dev/thumb/1234567890s.jpg --output thumb.jpg
```

---

## 資料結構

### Post (文章)

```typescript
interface Post {
  no: number;          // 文章編號
  resto: number;       // 0 = OP, >0 = 回應編號
  name: string;        // 發文名稱
  email: string;       // Email / cap code
  sub: string;         // 標題
  com: string;         // 內容
  time: number;        // 發文時間 (Unix timestamp)
  tim?: string;        // 時間戳檔名
  ext?: string;        // 副檔名 (含 .)
  filename?: string;   // 原始檔名
  w?: number;          // 原圖寬度
  h?: number;          // 原圖高度
  tn_w?: number;       // 縮圖寬度
  tn_h?: number;       // 縮圖高度
  filesize?: number;   // 檔案大小
  md5?: string;        // MD5 雜湊
  category?: string;   // 分類標籤
  sticky?: number;     // 是否置頂
  locked?: number;     // 是否鎖定
  id?: string;         // User ID
}
```

### Thread (討論串)

```typescript
interface Thread {
  no: number;              // 討論串編號
  resto: number;           // 永遠為 0
  posts: Post[];           // 文章列表
  reply_count: number;     // 回應數
  image_count: number;     // 圖片數
  last_reply_time: number; // 最後回應時間
  sticky: number;          // 是否置頂
  locked: number;          // 是否鎖定
}
```

---

## 錯誤碼

| HTTP 狀態碼 | 說明 |
|------------|------|
| 200 | 成功 |
| 400 | 請求參數錯誤 |
| 403 | 權限不足或功能未開啟 |
| 404 | 資源不存在 |
| 500 | 伺服器錯誤 |

---

## 限制

- 最大上傳檔案大小：10MB（預設，可設定）
- 支援圖片格式：JPG, PNG, GIF, WebP
- 回應附加圖片：可設定是否允許
- 請求速率限制：由 Cloudflare Workers 免費方案限制

---

## 開發中功能

以下功能尚未實作：

- [ ] 管理員 API
- [ ] 設定更新 API
- [ ] RSS 輸出
- [ ] 批次操作
- [ ] WebSocket 支援
