# 快速開始指南

## 前置需求

- Node.js 18+
- npm 或 yarn
- Cloudflare 帳號（免費方案即可）
- wrangler CLI

## 安裝步驟

### 1. 安裝 wrangler

```bash
npm install -g wrangler
```

### 2. 登入 Cloudflare

```bash
wrangler login
```

### 3. 複製專案（如果還沒有）

```bash
cd /home/eric/workspaces/pixmicat-cf
```

### 4. 執行初始化腳本

```bash
./setup.sh
```

這個腳本會自動：
- 建立 D1 資料庫
- 建立 R2 bucket
- 建立 KV namespace
- 安裝 npm 依賴
- 執行資料庫遷移

### 5. 設定 wrangler.toml

初始化腳本會顯示你的 database_id 和 KV id，請更新 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "pixmicat-db"
database_id = "your-database-id-here"  # 更新這裡

[[kv_namespaces]]
binding = "KV"
id = "your-kv-id-here"  # 更新這裡
```

### 6. 設定環境變數

編輯 `.dev.vars`：

```bash
# 管理員密碼（至少 8 字元）
ADMIN_PASSWORD=your-secure-password

# 其他設定可選
ADMIN_CAP_NAME=futaba
ADMIN_CAP_PASSWORD=futaba
```

### 7. 本地開發

```bash
npm run dev
```

瀏覽器會自動開啟 `http://localhost:8787`

### 8. 部署到生產環境

```bash
npm run deploy
```

## 手動設定（如果不使用 setup.sh）

### 建立 D1 資料庫

```bash
wrangler d1 create pixmicat-db
```

記下輸出的 `database_id`。

### 執行資料庫遷移

本地：
```bash
wrangler d2 migrations apply pixmicat-db --local
```

生產：
```bash
wrangler d2 migrations apply pixmicat-db --remote
```

### 建立 R2 Bucket

```bash
wrangler r2 bucket create pixmicat-storage
wrangler r2 bucket create pixmicat-storage-local  # 本地開發
```

### 建立 KV Namespace

```bash
wrangler kv namespace create pixmicat-kv
```

記下輸出的 `id`。

## 常見問題

### Q: 圖片上傳失敗？
A: 檢查 R2 bucket 是否正確設定，檔案大小是否超過限制。

### Q: 資料庫連線失敗？
A: 確認 `wrangler.toml` 中的 `database_id` 正確。

### Q: 如何修改設定？
A: 設定儲存在資料庫的 `configs` 表中，可以：
1. 直接使用 SQL 更新
2. 使用管理員後台（開發中）
3. 透過 API 修改（開發中）

例如：
```sql
UPDATE configs SET value = '我的圖版' WHERE key = 'title';
```

### Q: 如何備份資料？
A: 使用 wrangler 匯出 D1 資料庫：
```bash
wrangler d1 export pixmicat-db --remote --output=backup.sql
```

### Q: 本地開發時資料不見？
A: 本地開發使用記憶體資料庫，重啟後會清空。如需持久化，使用 `--local` 模式。

## 下一步

- 閱讀 [README.md](./README.md) 了解完整功能
- 查看 API 文件
- 自訂前端樣式
- 設定 Cloudflare Analytics

## 取得幫助

- GitHub Issues: (專案連結)
- Cloudflare Workers 文件: https://developers.cloudflare.com/workers/
