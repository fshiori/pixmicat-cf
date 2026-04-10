# Pixmicat! for Cloudflare Workers

Pixmicat! 圖版系統的 Cloudflare Workers TypeScript 移植版本。

## 功能特性

### 核心功能
- ✅ 發文與回應功能
- ✅ 圖片上傳（支援 JPG, PNG, GIF, WebP, BMP）
- ✅ 自動縮圖生成
- ✅ Tripcode 身分驗證
- ✅ Sage（不推文）
- ✅ 引用系統 (>>No.)
- ✅ 自動連結 URL

### 討論串功能
- ✅ 討論串列表
- ✅ 單一討論串頁面
- ✅ 分頁瀏覽
- ✅ 分類標籤
- ✅ 搜尋功能（全文/標題/作者/圖片）
- ✅ Ajax 自動更新（30 秒輪詢）
- ✅ RSS 輸出

### 管理功能
- ✅ 管理員 Cap 系統
- ✅ 管理員後台登入
- ✅ 文章刪除（含密碼驗證）
- ✅ 文章管理（瀏覽/搜尋/刪除）
- ✅ 文章置頂/鎖定
- ✅ IP 封鎖管理（暫時/永久）
- ✅ 資料匯入/匯出（JSON 格式）
- ✅ 資料庫維護（清理舊文章/檔案）
- ✅ 設定管理（37 個可調整設定）

### 防護機制
- ✅ Honeypot 驗證
- ✅ 連續投稿限制
- ✅ DNSBL（DNS Blacklist）
- ✅ 限制文字過濾
- ✅ 檔案 MD5 封鎖
- ✅ IP 模式封鎖

### 開發者功能
- ✅ API 文件
- ✅ 單元測試（133 個測試通過）
- ✅ 完整的 TypeScript 類型定義

## 技術架構

- **Runtime**: Cloudflare Workers (V8 Isolate)
- **Language**: TypeScript
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Cache**: Cloudflare KV
- **Router**: itty-router

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 建立 D1 資料庫

```bash
# 建立資料庫
npm run d1:create

# 更新 wrangler.toml 中的 database_id
```

### 3. 執行資料庫遷移

```bash
# 本地開發
npm run d1:migrate:local

# 生產環境
npm run d1:migrate
```

### 4. 建立 R2 Bucket

```bash
wrangler r2 bucket create pixmicat-storage
wrangler r2 bucket create pixmicat-storage-local  # 本地開發
```

### 5. 建立 KV Namespace

```bash
wrangler kv namespace create pixmicat-kv
```

更新 `wrangler.toml` 中的 `id`。

### 6. 設定環境變數

複製 `.dev.vars.example` 到 `.dev.vars`（本地）或在 Cloudflare Dashboard 設定。

### 7. 本地開發

```bash
npm run dev
```

### 8. 部署

```bash
npm run deploy
```

## 設定

設定值儲存在 `configs` 表中，可透過資料庫或管理員後台修改：

| 設定鍵 | 預設值 | 說明 |
|-------|--------|------|
| `title` | Pixmicat!-CF | 網站標題 |
| `max_posts` | 0 | 最大文章數 (0=無限) |
| `max_threads` | 0 | 最大討論串數 (0=無限) |
| `storage_max` | 0 | 最大儲存空間 bytes (0=無限) |
| `max_file_size` | 10485760 | 最大上傳檔案大小 (10MB) |
| `allow_res_img` | 1 | 回應是否允許附加圖片 |
| `use_search` | 1 | 是否開啟搜尋 |
| `use_category` | 1 | 是否開啟分類 |
| `show_id` | 2 | ID 顯示模式 (0=不顯示, 1=選擇性, 2=強制) |
| `allow_noname` | 1 | 是否允許匿名 |
| `default_name` | 無名氏 | 預設名稱 |
| `bump_limit` | 0 | 自動沉底限制 |
| `reply_limit` | 0 | 回應數限制 |

## 專案結構

```
pixmicat-cf/
├── src/
│   ├── index.ts              # 主入口 + 路由
│   ├── lib/
│   │   ├── pio-interface.ts  # PIO 介面定義
│   │   ├── pio-d1.ts         # PIO D1 實作
│   │   ├── fileio-interface.ts # FileIO 介面定義
│   │   ├── fileio-r2.ts      # FileIO R2 實作
│   │   ├── admin.ts          # 管理員系統
│   │   ├── anti-spam.ts      # 防護機制
│   │   └── utils.ts          # 工具函數
│   └── types/
│       └── index.ts          # TypeScript 類型
├── migrations/               # 資料庫遷移
├── tests/                    # 單元測試
├── docs/                     # 文檔
│   ├── API.md                # API 文檔
│   └── CONFIG_KEYS_REFERENCE.md
├── public/                   # 靜態資源
├── wrangler.toml            # Cloudflare 設定
├── tsconfig.json
├── package.json
└── README.md
```

## API 端點

### 公開 API

#### 取得討論串列表
```
GET /api/threads?page=1&limit=20
```

#### 取得單一討論串
```
GET /api/thread/:no
```

#### 新增文章/回應
```
POST /api/post
Content-Type: multipart/form-data

{
  name: string,
  email: string,
  sub: string,
  com: string,
  file: File,
  password: string,
  category: string,
  resto: number  // 0 = 新主題, >0 = 回應
}
```

#### 刪除文章
```
POST /api/delete
Content-Type: multipart/form-data

{
  no: number,
  password: string
}
```

#### 搜尋
```
GET /api/search?q=關鍵字&type=all&page=1
```

#### 更新檢查
```
GET /api/update?since=timestamp
```

#### 分類
```
GET /api/category/:name
```

#### RSS
```
GET /rss.xml
GET /api/rss
```

### 管理 API

#### 認證
```
POST /admin/api/login
POST /admin/api/logout
```

#### 文章管理
```
GET /admin/posts?page=1&limit=20
POST /admin/api/delete
POST /admin/api/toggle-sticky
POST /admin/api/toggle-locked
```

#### 設定管理
```
GET /admin/settings
POST /admin/api/config
PUT /admin/api/config/:key
DELETE /admin/api/config/:key
```

#### 封鎖管理
```
GET /admin/bans
POST /admin/api/bans
DELETE /admin/api/bans/:id
```

#### 備份與維護
```
GET /admin/api/export
POST /admin/api/import
POST /admin/api/maintenance
GET /admin/status
```

## 與原版差異

由於 Cloudflare Workers 環境限制，以下功能需要調整：

1. **圖片處理**: 原版使用 GD library，這裡使用客戶端或外部服務
2. **Session**: Workers 無狀態，使用 JWT 或 cookie-free 設計
3. **檔案系統**: 使用 R2 取代本地檔案系統
4. **背景任務**: 使用 Cloudflare Cron Triggers

## 開發計劃

### 已完成 ✅
- [x] 基本 API 框架
- [x] D1 資料庫層
- [x] R2 檔案儲存
- [x] 圖片上傳與縮圖
- [x] 前端頁面
- [x] 搜尋功能
- [x] 管理員認證系統
- [x] 管理員後台
- [x] 設定系統（37 個設定項目）
- [x] Spam 防護機制（Honeypot, DNSBL, 連續投稿限制等）
- [x] RSS 輸出
- [x] API 文件
- [x] 單元測試（133 個測試通過）
- [x] 分頁功能
- [x] 分類瀏覽
- [x] 本地縮圖生成（sharp）
- [x] Tripcode 身分驗證
- [x] Sage（不推文）
- [x] 單一討論串頁面
- [x] Ajax 自動更新
- [x] 文章置頂/鎖定
- [x] IP 封鎖管理
- [x] 資料匯入/匯出
- [x] 資料庫維護

### 規劃中 🚧
- [ ] PWA 支援
- [ ] WebSocket 即時更新
- [ ] 多語言支援
- [ ] 主題切換
- [ ] 用戶檢舉系統

## 貢獻

歡迎提交 Issue 和 Pull Request！

請參考 [貢獻指南](CONTRIBUTING.md) 了解開發流程和規範。

### Git 工作流程

我們使用功能分支工作流程：

1. 從 `main` 建立功能分支：`git checkout -b feature/your-feature`
2. 開發並提交：`git commit -m "feat: 描述你的功能"`
3. 推送到遠端：`git push -u origin feature/your-feature`
4. 在 GitHub 建立 Pull Request
5. 使用 `--no-ff` 合併回 `main`

詳細說明請參考 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 授權

MIT License

## 原始專案

本專案是 Pixmicat! 圖版系統的 Cloudflare Workers 移植版本。

- **Pixmicat!**: https://github.com/pixmicat/pixmicat
- 參考版本: pixmicat-8th.Release.4

## 相關文檔

- [API 文檔](docs/API.md)
- [配置鍵參考](docs/CONFIG_KEYS_REFERENCE.md)
- [本地開發設定](LOCAL_DEVELOPMENT_SETUP.md)
- [貢獻指南](CONTRIBUTING.md)
