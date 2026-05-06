# Pixmicat! Cloudflare Workers 版

這個專案是 Pixmicat!-PIO 8th.Release.4 的 Cloudflare 原生移植版本。目標 stack：

- Cloudflare Workers + TypeScript + Hono
- Cloudflare D1 作為 PIO 資料庫
- Cloudflare KV 作為 session 與快取
- Cloudflare R2 作為原圖與縮圖儲存
- Workers Static Assets 提供原始 CSS、JS 與 `nothumb.gif`

目前狀態：已完成核心移植，可用 `wrangler dev` 在本機啟動。已實作看板列表、討論串檢視、發文與回應、R2 圖片上傳、JPEG 縮圖產生、管理員登入、刪除、搜尋、目錄模式與狀態頁。

## 本機開發

安裝依賴：

```bash
npm install
```

複製本機 secrets 範例：

```bash
cp .dev.vars.example .dev.vars
```

請至少設定：

- `SESSION_SECRET`：長隨機字串，用於簽章 cookie。
- `ADMIN_HASH`：對應 PHP `ADMIN_HASH` 的管理員密碼 hash。

套用本機 D1 migration：

```bash
npm run d1:migrate:local
```

啟動本機 Worker：

```bash
npm run dev
```

預設網址為 `http://localhost:8787`。

## Cloudflare 資源設定

正式部署參數不要寫入可提交的 `wrangler.toml`。請先複製本機部署設定樣板，實際 Account ID、正式網域、D1/KV/R2 ID 與資源名稱只填在被 `.gitignore` 排除的檔案：

```bash
cp deploy/production.example.env deploy/production.env
```

`wrangler.toml` 只保留開源專案可提交的 placeholder；若要針對正式環境產生實際設定，請使用本機的 `deploy/production.env` 作為來源，不要把個人 Cloudflare 資訊 commit 進 repo。

建立 D1 database：

```bash
wrangler d1 create pixmicat-db
```

把輸出的 `database_id` 填到本機 `deploy/production.env` 的 `D1_DATABASE_ID`，不要填回可提交的 `wrangler.toml`。

建立 KV namespace：

```bash
wrangler kv namespace create pixmicat-kv
```

把輸出的 `id` 填到本機 `deploy/production.env` 的 `KV_NAMESPACE_ID`，不要填回可提交的 `wrangler.toml`。

建立 R2 bucket：

```bash
wrangler r2 bucket create pixmicat-assets
```

把 bucket 名稱填到本機 `deploy/production.env` 的 `R2_BUCKET_NAME`。`wrangler.toml` 只保留 `R2` binding 的 placeholder。

## D1 Migration

本機：

```bash
npm run d1:migrate:local
```

遠端：

```bash
npm run d1:migrate
```

`migrations/0001_initial.sql` 會建立：

- `imglog`：相容 Pixmicat PIO V3 欄位。
- `configs`：移植 `config.php` 常數預設值。
- `banlist`：封鎖規則。
- `moderation_log`：管理操作記錄。

## 靜態資源

以下檔案由 PHP 參考版原封不動沿用，放在 `public/`：

- `mainstyle.css`
- `mainscript.js`
- `iedivfix.js`
- `nothumb.gif`

Workers Static Assets 設定在 `wrangler.toml` 的 `[assets]` 區塊，binding 名稱為 `ASSETS`。

## 開發指令

```bash
npm run type-check
npm run test:run
npm run dev
```

## 部署

部署會觸及 production Cloudflare，執行前必須先確認：

```bash
npm run deploy
```

正式 secrets 請透過 Wrangler 設定，不要寫入 repo：

```bash
wrangler secret put SESSION_SECRET
wrangler secret put ADMIN_HASH
```

## 專案結構

```text
.
├── migrations/
│   └── 0001_initial.sql
├── public/
│   ├── iedivfix.js
│   ├── mainstyle.css
│   ├── mainscript.js
│   └── nothumb.gif
├── src/
│   ├── db/
│   ├── lib/
│   ├── routes/
│   ├── services/
│   ├── templates/
│   └── types/
├── MIGRATION_PLAN.md
├── package.json
├── tsconfig.json
└── wrangler.toml
```
