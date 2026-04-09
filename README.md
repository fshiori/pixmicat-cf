# Pixmicat! for Cloudflare Workers

Pixmicat! 圖版系統的 Cloudflare Workers TypeScript 移植版本。

## 功能特性

- ✅ 發文與回應功能
- ✅ 圖片上傳（支援 JPG, PNG, GIF, WebP, BMP）
- ✅ 自動縮圖生成（可調整尺寸）
- ✅ 討論串管理
- ✅ 單一討論串頁面
- ✅ 搜尋功能
- ✅ 分類標籤
- ✅ 管理員 Cap 系統
- ✅ 管理員後台（文章管理、設定、封鎖）
- ✅ IP 封鎖管理
- ✅ 文章匯入/匯出
- ✅ Honeypot 驗證（防 spam）
- ✅ 連續投稿限制（防 spam）
- ✅ 字數限制
- ✅ 自動連結 URL
- ✅ 引用系統 (>>No.)
- ✅ 37 個可調整設定
- ✅ RSS 輸出
- ✅ API 文件

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
npm run d2:create

# 更新 wrangler.toml 中的 database_id
```

### 3. 執行資料庫遷移

```bash
# 本地開發
npm run d2:migrate:local

# 生產環境
npm run d2:migrate
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
│   ├── index.ts              # 主入口
│   ├── lib/
│   │   ├── pio-interface.ts  # PIO 介面定義
│   │   ├── pio-d1.ts         # PIO D1 實作
│   │   ├── fileio-interface.ts # FileIO 介面定義
│   │   └── fileio-r2.ts      # FileIO R2 實作
│   ├── routes/
│   │   └── index.ts          # API 路由
│   └── types/
│       └── index.ts          # TypeScript 類型
├── migrations/
│   └── 0001_initial.sql      # 資料庫 schema
├── public/                   # 靜態資源
├── wrangler.toml            # Cloudflare 設定
├── tsconfig.json
├── package.json
└── README.md
```

## API 端點

### 取得討論串列表
```
GET /api/threads?page=1&limit=20
```

### 取得單一討論串
```
GET /api/thread/:no
```

### 新增文章/回應
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

### 刪除文章
```
POST /api/delete
Content-Type: multipart/form-data

{
  no: number,
  password: string
}
```

### 搜尋
```
GET /api/search?q=關鍵字&type=all&page=1
```

## 與原版差異

由於 Cloudflare Workers 環境限制，以下功能需要調整：

1. **圖片處理**: 原版使用 GD library，這裡使用客戶端或外部服務
2. **Session**: Workers 無狀態，使用 JWT 或 cookie-free 設計
3. **檔案系統**: 使用 R2 取代本地檔案系統
4. **背景任務**: 使用 Cloudflare Cron Triggers

## 開發計劃

- [x] 基本 API 框架
- [x] D1 資料庫層
- [x] R2 檔案儲存
- [x] 圖片上傳與縮圖
- [x] 前端頁面
- [x] 搜尋功能
- [x] 管理員認證系統
- [x] 管理員後台
- [x] 設定系統（37 個設定項目）
- [x] Spam 防護機制
- [x] RSS 輸出
- [x] API 文件
- [ ] 單元測試
- [x] 分頁功能（首頁）

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

Artistic License 2.0

## 原始專案

- Pixmicat!: http://pixmicat.openfoundry.org/
- 參考版本: pixmicat-8th.Release.4
