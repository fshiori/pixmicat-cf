# 本地縮圖生成說明

## 概述

本地開發環境現在可以生成真實的縮圖（使用 [sharp](https://sharp.pixelplums.com/)），而不是直接回傳原圖。

## 安裝步驟

### 1. 安裝 sharp

```bash
cd /home/eric/workspaces/pixmicat-cf
npm install --save-dev sharp
```

**注意：** sharp 是 optional dependency，如果沒有安裝，縮圖會自動回退到原圖。

### 2. 測試安裝

```bash
# 執行測試
npm run test:run -- tests/image-local.test.ts

# 啟動本地開發伺服器
npm run dev
```

### 3. 驗證

訪問 `http://localhost:8787/thumb/<filename>s.jpg`，檢查 response headers：

- 成功：`X-Local-Thumbnail: true`
- 回退：`X-Thumbnail-Fallback: original`

## 工作原理

### 生產環境（Cloudflare Workers）
- 使用 **Cloudflare Image Resizing API**
- 透過 307 重定向到 `/cdn-cgi/image/...`
- 無額外費用（包含在 Workers Bundled 裡）

### 本地開發環境
- 使用 **sharp** 動態生成縮圖
- 規格：250x250, JPEG, quality 75
- 如果 sharp 不可用，回退到原圖

## 程式碼結構

```
src/lib/image-local.ts    # 本地圖片處理工具
src/index.ts (line ~840)  # /thumb/:filename 路由
```

## 測試

### 單元測試
```bash
npm run test:run -- tests/image-local.test.ts
```

### 手動測試
```bash
# 1. 啟動本地伺服器
npm run dev

# 2. 上傳一張圖片（透過首頁表單）

# 3. 檢查縮圖
curl -I http://localhost:8787/thumb/1234567890s.jpg

# 應該看到：
# X-Local-Thumbnail: true
# Content-Type: image/jpeg
# Content-Length: <小於原圖>
```

## 故障排除

### 問題：總是回退到原圖
- 檢查 sharp 是否正確安裝：`npm list sharp`
- 查看伺服器 console 的 warning 訊息

### 問題：sharp 安裝失敗
- 確認系統有安裝 build tools：
  - Ubuntu/Debian: `sudo apt install build-essential`
  - macOS: `xcode-select --install`
- 或使用預編譯版本：`npm install sharp --no-optional`

### 問題：生產環境仍然顯示原圖
- 確認 `request.url` 不包含 localhost/127.0.0.1
- 檢查 Cloudflare Image Resizing 是否啟用

## 效能影響

- **首次生成**：約 50-200ms（取決於圖片大小）
- **後續請求**：由 R2/CDN 快取處理
- **記憶體使用**：約 20-50MB per request（sharp 預設）

## 未來改進

- [ ] 支援快取本地縮圖到 R2
- [ ] 支援自訂縮圖尺寸
- [ ] 支援更多圖片格式（AVIF, TIFF）
