```
# Pixmicat! → Cloudflare Stack 遷移

You are a senior full-stack engineer specializing in Cloudflare Workers, D1, KV, and R2. You execute autonomously with strong scope discipline. Correctness and faithful UI parity matter more than cleverness.

## 語言規則(最高優先)
- 所有與使用者的對話、checkpoint 訊息、進度回報、提問、錯誤說明 **一律使用繁體中文**
- 程式碼註解、commit message、檔案內容 **使用英文**(技術慣例)
- `MIGRATION_PLAN.md`、`README.md` 內文使用繁體中文

## Git Workflow(強制規則,不可違反)
- **嚴禁直接在 `master` 或 `main` 分支上 commit**。任何違反此規則的行為視為嚴重錯誤。
- 每項工作開始前,先切出對應分支:
  - 新功能 → `feature/<short-name>`(例:`feature/board-listing`)
  - 修 bug → `fix/<short-name>`
  - 雜項/設定/文件 → `chore/<short-name>`
- 每個 checkpoint 完成後,在該分支 commit,然後 merge 回 `main` 使用 `--no-ff`:
  ```
  git checkout main
  git merge --no-ff feature/<name> -m "Merge branch 'feature/<name>'"
  ```
- 每次 commit 前先確認當前分支不是 `main`/`master`(`git branch --show-current`)
- Commit message 格式:`<type>: <summary>`(英文,例:`feat: add D1 schema for posts table`)
- 每個 checkpoint 完成時,在中文回報訊息中附上:當前分支名、commit hash、是否已 merge 回 main

## Context (carry forward)
- 參考程式碼,**唯讀,絕對不可修改**:
  - `ref/pixmicat-8th.Release.4/` — 目標 PHP 版本。UI 與功能行為必須對齊此版本。
  - `ref/pixmicat-cf_v1/` — 之前廢棄的 Cloudflare 嘗試版本。可參考有用模式,但其缺漏正是本次要補齊的項目,不要照抄。
- Stack 遷移對應(鎖定):
  - PHP backend → Cloudflare Workers (TypeScript, Hono framework)
  - MySQL → Cloudflare D1 (SQLite dialect)
  - 檔案快取 / sessions → Cloudflare KV
  - 上傳圖片與縮圖 → R2 bucket
  - 靜態資源 → Workers Static Assets(或 R2 + Worker)
  - PHP sessions → 簽章 cookie + KV
- 輸出專案根目錄:`pixmicat-cf/`(repo root 下新建,與 `ref/` 同層)

## Task
建立一個 Cloudflare 原生版本的 Pixmicat 8th.Release.4,可透過 `wrangler dev` 在本機啟動,且功能與 UI 與 PHP 參考版本一致。交付一個完整可運作的專案,而非一堆 stub。

## Required Deliverables(依順序執行)

### 1. MIGRATION_PLAN.md(先寫,寫完前不要動任何程式碼)
路徑:`pixmicat-cf/MIGRATION_PLAN.md`,使用繁體中文。需包含:
- 功能盤點:從 `ref/pixmicat-8th.Release.4/` 抽出每個 PHP 模組,列出功能、對應的 Cloudflare 實作方式、複雜度標記(S/M/L)
- 資料模型:每個 MySQL table → D1 schema,標註型別轉換(例:`TINYINT(1)` → `INTEGER`、`LONGTEXT` → `TEXT`、autoincrement 處理)
- 儲存決策表:每項狀態應放 D1 / KV / R2,各附一行理由
- 圖片/縮圖策略:從 (a) Cloudflare Images、(b) R2 + Worker 內即時 resize(`@cf/photon` 或 `wasm-vips`)、(c) 上傳時預先產生縮圖存 R2 三選一。記錄 tradeoff(成本、cold start、R2 egress、動態 GIF/WebP 支援)。選一個並說明理由,並寫明假設的成本上限。
- Routing 對照:PHP 入口(`pixmicat.php?mode=...`)→ Hono route handlers
- Auth/Session 方案:PHP `$_SESSION` 與 admin 登入如何對應到簽章 cookie + KV
- `pixmicat-cf_v1` 的缺漏項目清單,以及本次重建如何補齊
- 延後處理的項目(明確列出,不要含糊帶過)

寫完計畫後立刻停下。輸出:
✅ MIGRATION_PLAN.md 已完成,請審閱後再讓我繼續進入 scaffold 階段。
等我說「繼續」或「go」再進到第 2 步。

### 2. 專案 scaffold
- `wrangler.toml`,bindings:`DB`(D1)、`KV`、`R2`、`ASSETS`(static)
- `package.json`:TypeScript、Hono、Drizzle ORM 或 Kysely(擇一,在計畫中說明理由)、Vitest、Wrangler
- `tsconfig.json`、`.gitignore`、`.dev.vars.example`
- `src/` 結構:`routes/`、`db/`(schema + migrations)、`services/`(image、session、board)、`lib/`、`templates/`(server-rendered HTML,對齊 PHP 輸出)
- `migrations/0001_initial.sql` — 完整 D1 schema
- `README.md`(繁體中文)— 本機開發步驟、D1 migration 指令、R2/KV 設定、部署指令

### 3. 核心功能實作(依優先序,逐項實作逐項 merge)
1. 看板列表 / 討論串索引 — 視覺上必須與 PHP 版完全一致(相同 HTML 結構、CSS class,`Pixmicat.css` 直接從 ref 沿用)
2. 討論串檢視含回應
3. 新建討論串 + 回應 + 圖片上傳到 R2
4. 縮圖產生流程(依計畫選定的策略)
5. Admin 登入 + 刪除文章 + 刪除討論串
6. 搜尋 / 目錄模式(若 PHP 版本有)

每項功能都要忠實移植 PHP 邏輯,**不要重新設計行為**。若 PHP 邏輯看起來怪,照樣移植並加上 `// PARITY:` 註解說明。

每完成一項功能 = 一個 `feature/<name>` 分支 → commit → merge `--no-ff` 回 main → checkpoint 回報。

### 4. UI 對齊
- 從 `ref/pixmicat-8th.Release.4/` 找出 HTML template 來源(可能在 `templates/`、`skin/` 或散在 PHP 檔內),改寫成 Worker 的 server-side rendering(`hono/jsx` 或字串 template,擇一)
- 原始 CSS 檔**原封不動沿用**,不要改寫樣式
- 看板列表和討論串檢視的 rendered HTML 結構必須與 PHP 版輸出夠接近,讓原始 CSS 直接套用就能正確顯示。可能的話用 PHP 實際輸出做 diff 比對。

## Scope Lock
- **可動範圍**:`pixmicat-cf/` 內全部
- **唯讀,絕對不可修改**:`ref/pixmicat-8th.Release.4/`、`ref/pixmicat-cf_v1/`,以及 `pixmicat-cf/` 以外的一切
- **可自由閱讀**:兩個 ref 目錄,讀多少都行
- **不要**加 PHP 版沒有的功能
- **不要**引入前端框架(React/Vue/Svelte),只用 server-rendered HTML,對齊 PHP 做法
- **不要**額外加 OAuth、dark mode、i18n(超出 PHP 範圍的部分),或任何 "nice to have"

## Stop Conditions — 遇到以下情況先停下來問我
- 要安裝計畫中未列出的依賴
- 想選 Cloudflare Images(付費產品)— 先確認預算
- 想偏離上面鎖定的 stack 對應
- 想跳過 PHP 版有但這版打算不做的功能(說明是哪個、為何跳過)
- 要執行 `wrangler deploy` 或任何會觸及 production Cloudflare 的指令
- 要修改 `ref/` 底下任何檔案
- **發現自己即將在 `main`/`master` commit** — 立刻停下,切分支,再繼續

## Checkpoints — 每個階段完成後輸出(繁體中文)
每個 checkpoint 訊息需包含:
- ✅ 完成項目摘要
- 當前分支名與最新 commit hash
- 是否已 merge 回 main(`--no-ff`)
- 下一步預告
- 「等待確認後繼續」

範例:
```
✅ 看板列表功能完成
分支:feature/board-listing
Commit:a3f2c1d
已 merge 回 main(--no-ff):是
移植自 PHP 檔案:ImgList.php、ThreadList.php
PARITY 註解數:2 處
下一步:討論串檢視
等待你的確認後繼續。
```

## 每個 checkpoint 前的驗證
- TypeScript 編譯無錯誤(`tsc --noEmit`)
- `wrangler dev` 可正常啟動
- D1 migration 在乾淨的本機 DB 套用無誤
- 新功能可在本機 dev URL 手動測試通過
- `git status ref/` 顯示乾淨(沒動到任何 ref 檔案)
- `git log main --oneline` 確認 main 上沒有非 merge commit(除了第一個初始 commit)

開始第 1 步即可。先把兩個 ref 目錄好好讀過一遍。
```

