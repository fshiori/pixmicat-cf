# 本地開發環境完整設定指南

本文檔涵蓋 Pixmicat Cloudflare Workers 專案的完整本地開發環境設定。

## 📋 目錄

1. [系統需求](#系統需求)
2. [初始安裝](#初始安裝)
3. [設定 Wrangler](#設定-wrangler)
4. [初始化資料庫](#初始化資料庫)
5. [安裝可選依賴](#安裝可選依賴)
6. [啟動開發伺服器](#啟動開發伺服器)
7. [驗證安裝](#驗證安裝)
8. [常用操作](#常用操作)
9. [故障排除](#故障排除)
10. [開發工作流程](#開發工作流程)

---

## 系統需求

### 必要軟體

| 軟體 | 版本 | 用途 |
|------|------|------|
| Node.js | 18+ | 執行環境 |
| npm | 9+ | 套件管理 |
| Git | 最新版 | 版本控制 |

### 可選軟體

| 軟體 | 用途 |
|------|------|
| wrangler CLI | Cloudflare Workers 開發工具 |
| sharp | 本地縮圖生成（建議安裝） |

### 檢查安裝

```bash
node --version   # 應該 >= 18
npm --version    # 應該 >= 9
git --version
```

---

## 初始安裝

### 1. 複製專案

```bash
cd /home/eric/workspaces
git clone https://github.com/fshiori/pixmicat-cf.git
cd pixmicat-cf
```

### 2. 安裝依賴

```bash
npm install
```

這會安裝：
- `itty-router` - 路由框架
- `@cloudflare/workers-types` - TypeScript 類型
- `vitest` - 測試框架
- `wrangler` - Cloudflare Workers CLI

---

## 設定 Wrangler

### 1. 登入 Cloudflare

```bash
npx wrangler login
```

這會開啟瀏覽器進行 OAuth 授權。

### 2. 設定專案配置

編輯 `wrangler.toml`：

```toml
name = "pixmicat-cf"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "pixmicat-db"
database_id = "local"  # 本地開發使用 "local"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "pixmicat-storage"

[[kv_namespaces]]
binding = "KV"
id = "local"  # 本地開發使用 "local"
```

---

## 初始化資料庫

### 1. 套用資料庫遷移

```bash
# 本地資料庫
npx wrangler d1 migrations apply pixmicat-db --local

# 生產資料庫（需要先建立）
npx wrangler d1 create pixmicat-db  # 取得 database_id
npx wrangler d1 migrations apply pixmicat-db --remote
```

### 2. 驗證資料庫

```bash
npx wrangler d1 execute pixmicat-db --local --command "SELECT COUNT(*) FROM posts"
```

應該顯示：0

---

## 安裝可選依賴

### sharp（本地縮圖生成）

#### 為什麼需要 sharp？

- **生產環境**：使用 Cloudflare Image Resizing API（自動）
- **本地開發**：需要 sharp 生成真實縮圖
- **回退行為**：沒有 sharp 時會回退到原圖

#### 安裝

```bash
npm install --save-dev sharp
```

#### 驗證安裝

```bash
npm run test:run -- tests/image-local.test.ts
```

#### 故障排除

如果安裝失敗：

```bash
# Ubuntu/Debian
sudo apt install build-essential

# macOS
xcode-select --install

# 然後重新安裝
npm install --save-dev sharp
```

---

## 啟動開發伺服器

### 基本啟動

```bash
npm run dev
```

這會啟動在 `http://localhost:8787`

### 完整參數

```bash
npx wrangler dev --local --port 8787 --persist
```

- `--local`：完全本地模式（不連接 Cloudflare）
- `--port 8787`：指定端口
- `--persist`：持續化 D1/R2/KV 數據

### 查看日誌

```bash
# 另一個終端機
npx wrangler tail
```

---

## 驗證安裝

### 1. 檢查首頁

```bash
curl http://localhost:8787/
```

應該看到完整的 HTML 表單。

### 2. 測試發文

```bash
curl -X POST http://localhost:8787/ \
  -F "name=測試" \
  -F "sub=測試標題" \
  -F "com=測試內文"
```

### 3. 測試縮圖

```bash
# 先上傳一張圖片（透過 Web UI）

# 然後測試縮圖
curl -I http://localhost:8787/thumb/1234567890s.jpg
```

應該看到：
```
X-Local-Thumbnail: true
Content-Type: image/jpeg
```

### 4. 執行測試

```bash
# 所有測試
npm run test:run

# 特定測試
npm run test:run -- tests/anti-spam.test.ts
npm run test:run -- tests/image-local.test.ts
npm run test:run -- tests/ref-parity.e2e.test.ts
```

---

## 常用操作

### 資料庫操作

```bash
# 查詢文章
npx wrangler d1 execute pixmicat-db --local --command "SELECT * FROM posts LIMIT 10"

# 清空資料庫
npx wrangler d1 execute pixmicat-db --local --command "DELETE FROM posts"

# 檢查配置
npx wrangler d1 execute pixmicat-db --local --command "SELECT * FROM configs"
```

### R2 儲存操作

```bash
# 列出檔案
npx wrangler r2 object list pixmicat-storage --local

# 刪除檔案
npx wrangler r2 object delete pixmicat-storage/<filename> --local

# 上傳測試圖片
npx wrangler r2 object put pixmicat-storage/test.jpg --file=./test.jpg --local
```

### KV 快取操作

```bash
# 清空快取
npx wrangler kv:key list --local | xargs -I {} npx wrangler kv:key delete {} --local

# 查看特定鍵
npx wrangler kv:key get "config:show_image_dimensions" --local
```

---

## 故障排除

### 問題：D1 資料庫連接失敗

**症狀**：
```
Error: D1_ERROR: database not found
```

**解決**：
```bash
# 確認資料庫已初始化
npx wrangler d1 migrations apply pixmicat-db --local

# 檢查 wrangler.toml 中的 database_id 是否為 "local"
```

### 問題：R2 儲存不存在

**症狀**：
```
Error: R2 bucket not found
```

**解決**：
```bash
# 本地模式會自動建立，但如果錯誤持續：
npx wrangler r2 bucket create pixmicat-storage
```

### 問題：sharp 總是回退到原圖

**症狀**：
```
X-Thumbnail-Fallback: original
```

**解決**：
```bash
# 1. 確認 sharp 安裝
npm list sharp

# 2. 重新安裝
npm uninstall sharp
npm install --save-dev sharp

# 3. 檢查伺服器日誌
npm run dev
# 應該看到 warning 訊息
```

### 問題：KV 快取不生效

**症狀**：配置讀取很慢，每次都查 D1

**解決**：
```bash
# 本地 KV 模擬有時不穩定，重啟伺服器
# Ctrl+C 然後重新 npm run dev
```

### 問題：TypeScript 編譯錯誤

**症狀**：
```
npm run type-check 失敗
```

**解決**：
```bash
# 1. 清理快取
rm -rf node_modules/.cache

# 2. 重新安裝
rm -rf node_modules
npm install

# 3. 檢查類型
npm run type-check
```

---

## 開發工作流程

### 1. 建立功能分支

```bash
git checkout -b feature/your-feature-name
```

### 2. 開發並測試

```bash
# 編輯程式碼
vim src/index.ts

# 執行測試
npm run test:run

# 本地測試
npm run dev
```

### 3. 提交變更

```bash
git add .
git commit -m "feat: description of changes"
git push origin feature/your-feature-name
```

### 4. 合併到 main

```bash
git checkout main
git merge --no-ff feature/your-feature-name
git push origin main
```

---

## 進階主題

### 本地 HTTPS

```bash
# 使用自簽憑證
npx wrangler dev --local --https
```

### 效能分析

```bash
# 啟動效能分析
npx wrangler dev --local --prof
```

### 環境變數

建立 `.dev.vars`（**不要提交到 Git**）：

```bash
# .dev.vars
ADMIN_PASSWORD=test123456
CAPTCHA_ENABLED=false
```

---

## 下一步

- 📖 閱讀 [API 文檔](API.md)
- 🔧 查看 [配置指南](SETTINGS_COMPARISON.md)
- 🧪 瀏覽 [測試文檔](tests/README.md)
- 🐛 回報 [問題](https://github.com/fshiori/pixmicat-cf/issues)

---

## 相關文檔

- [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文檔](https://developers.cloudflare.com/workers/wrangler/)
- [Sharp 文檔](https://sharp.pixelplums.com/)
- [Pixmicat 原始文檔](https://pixmicat.moeplay.com/)

---

**最後更新**：2026-04-10
**維護者**：Pixmicat CF 開發團隊
