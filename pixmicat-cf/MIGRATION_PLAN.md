# Pixmicat! 8th.Release.4 Cloudflare Stack 遷移計畫

## 目標與範圍

本專案在 `pixmicat-cf/` 內重建 Pixmicat!-PIO 8th.Release.4，目標是以 Cloudflare Workers + Hono、D1、KV、R2、Workers Static Assets 取代 PHP、檔案系統與 SQLite/MySQL 後端。參考來源一律唯讀：

- `ref/pixmicat-8th.Release.4/`：功能與 UI parity 的主要來源。
- `ref/pixmicat-cf_v1/`：廢棄版嘗試，只用來辨識可用模式與缺漏，不照抄設計。

本階段只完成遷移計畫，不建立程式碼 scaffold。

## 技術選型

| 項目 | 選擇 | 理由 |
| --- | --- | --- |
| Worker router | Hono | 符合指定 stack；比 v1 的 itty-router 更適合拆 route modules 與 typed bindings。 |
| DB access | Kysely | D1 是 SQLite dialect，Kysely 可維持 SQL 形狀、明確型別與低抽象成本；Pixmicat PIO 邏輯依賴精確排序與欄位名稱，Kysely 比 ORM entity 模型更容易忠實移植。 |
| HTML rendering | 字串 template + block parser | PHP 版 `inc_pixmicat.tpl` 使用 `<!--&BLOCK-->` 與 `{$VAR}` 替換；移植一個小型 template parser 可最大化 HTML parity。 |
| Static assets | Workers Static Assets | `mainstyle.css`、`mainscript.js`、`iedivfix.js`、`nothumb.gif` 原封不動沿用，避免重寫樣式。 |

## 功能盤點與模組對應

| PHP 檔案 / 模組 | 主要功能 | Cloudflare 實作方式 | 複雜度 |
| --- | --- | --- | --- |
| `pixmicat.php::updatelog` | 看板索引、討論串檢視、分頁、回應隱藏、刪除表單、靜態頁輸出 | `routes/board.ts` + `services/board.ts` 產生 SSR HTML；靜態頁檔案生成改為 KV cache，不產生 `index.htm` 實體檔 | L |
| `pixmicat.php::arrangeThread` | THREAD/REPLY HTML、圖片列、引用連結、類別連結、警告文字 | `templates/thread.ts` + `services/render-post.ts`，沿用 template block 與 `PARITY` 註解 | L |
| `pixmicat.php::regist` | 新主題、回應、field trap、Trip、Cap、sage、圖片檢查、重複圖、連續投稿、cookie、redirect | `routes/posts.ts` + `services/posting.ts` + `services/image.ts` + `services/session.ts` | L |
| `pixmicat.php::usrdel` | 使用者刪文、只刪圖、密碼/cookie/host/admin 權限 | `routes/delete.ts` + `services/delete.ts`；D1 刪資料、R2 刪物件 | M |
| `pixmicat.php::valid` | 管理員登入、選單、logout | `routes/admin.ts` + `services/session.ts`；簽章 cookie + KV session | M |
| `pixmicat.php::admindel` | 管理文章列表、刪文、只刪圖、停止回應 TS flag | `routes/admin.ts` + `services/admin.ts`；沿用表格 HTML | L |
| `pixmicat.php admin=optimize/check/repair/export` | PIO 維護動作 | D1 無完整等價；`optimize` 可對應 `PRAGMA optimize`，`check/repair/export` 第一輪以不支援訊息忠實回應 | S |
| `pixmicat.php::search` | 搜尋表單、com/name/sub/no 搜尋、AND/OR | `routes/search.ts` + D1 `LIKE` 查詢，沿用 `SEARCHRESULT` block | M |
| `pixmicat.php::searchCategory` | 類別模式、session 快取、分頁 | `routes/category.ts`；類別結果放 KV 短期快取取代 PHP session serialize | M |
| `pixmicat.php::showstatus` | 系統資訊、文章數、儲存量、縮圖支援狀態 | `routes/status.ts`；依 Workers/D1/R2 顯示對應資訊 | M |
| `pixmicat.php::listModules` / `mode=module` | PHP module loader 與 module page | 本次不實作任意 PHP module 載入；保留 `moduleloaded` 為空清單/不支援頁，`mode=module` 回 404 parity | S |
| `pixmicat.php?mode=remake` | 重新產生靜態頁後導回首頁 | Worker 不產生實體 HTML；改為清除/重建 KV HTML cache 後 302 導回首頁 | S |
| `default.php` | 初始目錄建立與導向 | Workers 不需要檔案目錄初始化；README 說明 D1/KV/R2 初始化 | S |
| `lib/lib_common.php` | head/form/foot、清理字串、auto link、quote、admin auth、IP 判定 | `lib/common.ts` + `templates/page.ts` + `services/session.ts` | L |
| `lib/lib_pte.php` | Template block parser | `templates/pte.ts`，讀取移植後 `.tpl` 或 TS 字串 | M |
| `lib/lib_pio.php` + `lib/pio/*` | PIO interface、FlagHelper、感測刪舊文、DB 後端 | `db/pio.ts` + `db/schema.ts`；只實作 D1 backend | L |
| `lib/fileio/*` + `lib/interfaces.php::IFileIO` | 圖片存在、URL、上傳、刪除、容量、縮圖名解析 | `services/image.ts` + `services/r2-fileio.ts`；R2 key 模擬 `tim.ext` / `tims.jpg` | L |
| `lib/thumb/*` | GD/ImageMagick 縮圖產生 | 上傳時預先產生縮圖存 R2，詳見圖片策略 | M |
| `lib/lib_language.php` + `lib/lang/zh_TW.php` | 語系字串 `_T()` | `lib/i18n.ts`，先移植 `zh_TW`；其它語系延後 | M |
| `lib/lib_pms.php` + `pmclibrary.php` | Module system、service locator | 不移植任意 plugin runtime；保留 hook 呼叫點為 no-op，需 parity 時加 `PARITY` | M |
| `lib/lib_errorhandler.php` / logger | PHP error handling、簡易 logger | Worker response error page + console logging | S |
| `Utilities/*`, `TestCase/*` | 維護工具與 PHP 測試 | 不移植；README 標註資料匯入匯出延後 | S |
| `inc_pixmicat.tpl` | futaba theme HTML block | 原樣轉入 `src/templates/inc_pixmicat.tpl` 或 TS raw string | L |
| `inc_pixmicat-festival.tpl`, `inc_pixmicat-uploader.tpl` | 替代 theme/uploader theme | 延後，先完成預設 `inc_pixmicat.tpl` | S |
| `mainstyle.css`, `mainscript.js`, `iedivfix.js`, `nothumb.gif` | UI 樣式與前端腳本 | 原封不動複製到 static assets | S |

## 資料模型：PIO V3 到 D1

PHP 預設 SQLite3 PIO 會建立 `imglog`，欄位如下。D1 schema 會保留原欄位名，避免 template/render 邏輯轉譯過多。

| PHP / MySQL 欄位 | 原型別 | D1 欄位 | D1 型別 | 轉換說明 |
| --- | --- | --- | --- | --- |
| `no` | `INTEGER PRIMARY KEY` / MySQL `int auto_increment` | `no` | `INTEGER PRIMARY KEY AUTOINCREMENT` | D1 rowid autoincrement；仍以 `no` 作文章編號。 |
| `resto` | `INTEGER NOT NULL` | `resto` | `INTEGER NOT NULL DEFAULT 0` | `0` 為首篇，其他為回應目標。 |
| `root` | `TIMESTAMP` / MySQL `timestamp` | `root` | `TEXT NOT NULL DEFAULT '0'` | PHP 用 UTC datetime 字串排序 bump；D1 保持 ISO-like text。 |
| `time` | `INTEGER` | `time` | `INTEGER NOT NULL` | Unix seconds。 |
| `md5chksum` | `VARCHAR(32)` | `md5chksum` | `TEXT NOT NULL DEFAULT ''` | 圖片 MD5。 |
| `category` | `VARCHAR(255)` | `category` | `TEXT NOT NULL DEFAULT ''` | 保留 `,tag,` 格式。 |
| `tim` | `INTEGER` 但實際 13 位字串 | `tim` | `TEXT NOT NULL DEFAULT ''` | PHP 註解指出 13-digit workaround；D1 用 TEXT 避免精度問題。 |
| `ext` | `VARCHAR(4)` | `ext` | `TEXT NOT NULL DEFAULT ''` | 包含點，如 `.jpg`。 |
| `imgw` / `imgh` | `INTEGER` / MySQL `smallint` | `imgw` / `imgh` | `INTEGER NOT NULL DEFAULT 0` | 原圖尺寸。 |
| `imgsize` | `VARCHAR(10)` | `imgsize` | `TEXT NOT NULL DEFAULT ''` | 顯示字串，如 `123 KB`。 |
| `tw` / `th` | `INTEGER` / MySQL `smallint` | `tw` / `th` | `INTEGER NOT NULL DEFAULT 0` | 縮圖顯示尺寸。 |
| `pwd` | `VARCHAR(8)` | `pwd` | `TEXT NOT NULL DEFAULT ''` | `substr(md5(password),2,8)`。 |
| `now` | `VARCHAR(255)` | `now` | `TEXT NOT NULL DEFAULT ''` | 顯示用時間字串含 ID。 |
| `name` | `VARCHAR(255)` | `name` | `TEXT NOT NULL DEFAULT ''` | 已清理/含 trip/cap HTML。 |
| `email` | `VARCHAR(255)` | `email` | `TEXT NOT NULL DEFAULT ''` | 含 sage 判斷。 |
| `sub` | `VARCHAR(255)` | `sub` | `TEXT NOT NULL DEFAULT ''` | 標題。 |
| `com` | `TEXT` / MySQL `text` / `LONGTEXT` 若舊版 | `com` | `TEXT NOT NULL DEFAULT ''` | 內文 HTML。 |
| `host` | `VARCHAR(255)` | `host` | `TEXT NOT NULL DEFAULT ''` | Workers 無 reverse DNS 時存 IP 或 hostname fallback。 |
| `status` | `VARCHAR(255)` | `status` | `TEXT NOT NULL DEFAULT ''` | FlagHelper 字串，如 `TS`。 |

索引：

- `idx_imglog_resto` on `(resto)`
- `idx_imglog_root` on `(root)`
- `idx_imglog_time` on `(time)`
- `idx_imglog_resto_no` on `(resto, no)`
- `idx_imglog_root_no` on `(root DESC, no DESC)` 用於 thread listing。

初始資料：

- PHP `pio.sqlite3.php` 會插入一筆 `no=1`、`time=1111111111`、`tim=1111111111111`、預設匿名/無標題/無內文的初始文章；D1 migration 也要 seed 同等資料，確保乾淨 DB 啟動後的行為與參考版一致。

額外 D1 tables：

| Table | 欄位 | 理由 |
| --- | --- | --- |
| `configs` | `key TEXT PRIMARY KEY`, `value TEXT`, `description TEXT`, `updated_at INTEGER` | 將 `config.php` 常數以 runtime config 表示，仍提供 defaults。 |
| `banlist` | `id INTEGER PRIMARY KEY AUTOINCREMENT`, `type TEXT`, `pattern TEXT`, `reason TEXT`, `expires_at INTEGER`, `created_at INTEGER` | 對應 `BANPATTERN`, `BAD_STRING`, `BAD_FILEMD5`；初期 seed PHP 預設 dummy 值可省略。 |
| `moderation_log` | `id`, `action`, `target_no`, `target_type`, `moderator`, `reason`, `created_at` | 記錄 admin/user delete，便於 debug；不改 UI 行為。 |

常見型別轉換規則：

- `TINYINT(1)` → `INTEGER`，以 `0/1` 儲存。
- `SMALLINT(1)` → `INTEGER`。
- `VARCHAR(n)` → `TEXT`，在 service layer 做長度限制。
- `TEXT` / `LONGTEXT` → `TEXT`。
- `TIMESTAMP` / `DATETIME` → `TEXT` 儲存 UTC 字串，或 `INTEGER` 儲存 Unix seconds；依 PHP 欄位原用途決定。
- MySQL `AUTO_INCREMENT` → D1 `INTEGER PRIMARY KEY AUTOINCREMENT`。

## 儲存決策表

| 狀態 / 資料 | 儲存位置 | 理由 |
| --- | --- | --- |
| 文章、回應、thread root、post status | D1 | 需要關聯查詢、排序、LIKE 搜尋與交易一致性。 |
| 設定值 | D1 + in-memory defaults | 需要可遷移、可查詢；defaults 讓乾淨 DB 可啟動。 |
| 管理員 session | KV | PHP `$_SESSION` 替代；session id 對應 server-side 狀態與 TTL。 |
| 簽章 cookie secret / admin hash | `.dev.vars` / Worker secrets | 敏感值不可放 D1 migration。 |
| 類別搜尋結果快取 | KV | PHP session cache 替代，按 category hash + page 短期快取。 |
| 討論串 HTML cache / ETag | KV | 取代 `cache/{resno}-{page}.{etag}` 檔案快取。 |
| 總附件容量 | KV | R2 無總大小查詢；PHP FileIO 本來也以快取維護容量。 |
| 原圖 | R2 | 二進位物件與公開 URL 最適合 object storage。 |
| 縮圖 | R2 | 固定檔名 `tims.jpg`，符合 PHP template 與刪除流程。 |
| 靜態 CSS/JS/GIF | Workers Static Assets | 原檔直出，避免 Worker route 干擾。 |
| moderation log | D1 | 需查詢與持久保存。 |

## 圖片與縮圖策略

### 選項比較

| 選項 | 成本 | Cold start / runtime | R2 egress | 動態 GIF / WebP 支援 | 評估 |
| --- | --- | --- | --- | --- | --- |
| Cloudflare Images | 付費產品，另有 image count / delivery 成本 | 最低實作成本 | Images 平台處理 | 支援佳，但行為依產品 | 需先確認預算；目前不選。 |
| R2 + Worker 即時 resize (`@cf/photon` 或 `wasm-vips`) | 無 Images 費用，但 CPU 成本高 | wasm cold start 風險高 | 每次 miss 需讀 R2 原圖 | GIF 動畫與 WebP 處理複雜 | 本專案以 parity 與穩定啟動優先，不選。 |
| 上傳時預先產生縮圖存 R2 | 僅 R2 儲存與 Worker CPU；可控 | 發文時多一次處理，讀頁穩定 | 讀頁直接取縮圖，避免即時轉換 | 動態 GIF 可先產生首幀 jpg；WebP 可先允許或降級 | 選用。最接近 PHP `thumb/*.php` 的「寫入縮圖檔」模式。 |

### 決策

選擇 `(c) 上傳時預先產生縮圖存 R2`。假設成本上限：本機與初期部署每月 R2 儲存低於 10GB、Class A/B 操作在免費/低成本級距內，且不使用 Cloudflare Images 付費產品。若之後要改用 Cloudflare Images，需先停下確認預算。

實作細節：

- 原圖 key：`${tim}${ext}`，例如 `1710000000123.jpg`。
- 縮圖 key：`${tim}s.jpg`，對齊 PHP `THUMB_SETTING['Format']='jpg'`。
- `tw` / `th` 在發文時依 PHP `MAX_W/MAX_H` 或 `MAX_RW/MAX_RH` 計算。
- 支援格式以 PHP 預設 `GIF|JPG|JPEG|PNG|BMP|SWF` 為準；SWF 可上傳但不產生縮圖。
- 動態 GIF 先取首幀產生 jpg 縮圖；若函式庫不支援動畫，保留原圖與 `nothumb.gif` fallback，並加 `PARITY` 註解。
- WebP 非 PHP 預設允許格式，不主動加入，除非使用者修改設定。

## Routing 對照

| PHP 入口 | Hono route | Handler |
| --- | --- | --- |
| `GET /` | `GET /` | 對應 `index.htm` 入口，輸出第 0 頁看板索引。 |
| `GET /index.htm` | `GET /index.htm` | 同第 0 頁，保留 PHP 連結 parity。 |
| `GET /pixmicat.php?page_num=N` | `GET /pixmicat.php?page_num=N` | 看板第 N 頁。 |
| `GET /pixmicat.php?res=NO` | `GET /pixmicat.php?res=NO` | 單一討論串，預設最末回應頁。 |
| `GET /pixmicat.php?res=NO&page_num=N|all` | `GET /pixmicat.php?res=NO&page_num=N|all` | 討論串回應分頁或全部顯示。 |
| `POST /pixmicat.php?mode=regist` / form `mode=regist` | `POST /pixmicat.php` | `routes/posts.ts` 檢查 `mode=regist`。 |
| `POST /pixmicat.php?mode=usrdel` / form `mode=usrdel` | `POST /pixmicat.php` | `routes/delete.ts`。 |
| `GET|POST /pixmicat.php?mode=admin` | `GET|POST /pixmicat.php` | admin login/menu。 |
| `GET|POST /pixmicat.php?mode=admin&admin=del` | `GET|POST /pixmicat.php` | admin post management。 |
| `GET /pixmicat.php?mode=admin&admin=logout` | `GET /pixmicat.php` | 清 KV session + cookie。 |
| `GET|POST /pixmicat.php?mode=admin&admin=optimize` | `GET|POST /pixmicat.php` | D1 `PRAGMA optimize` 或顯示不支援訊息。 |
| `GET|POST /pixmicat.php?mode=admin&admin=check` | `GET|POST /pixmicat.php` | 第一輪顯示 PHP 相同語意的不支援訊息。 |
| `GET|POST /pixmicat.php?mode=admin&admin=repair` | `GET|POST /pixmicat.php` | 第一輪顯示 PHP 相同語意的不支援訊息。 |
| `GET|POST /pixmicat.php?mode=admin&admin=export` | `GET|POST /pixmicat.php` | 第一輪顯示 PHP 相同語意的不支援訊息；完整 PIO export 延後。 |
| `GET|POST /pixmicat.php?mode=search` | `GET|POST /pixmicat.php` | 搜尋表單/結果。 |
| `GET /pixmicat.php?mode=category&c=TAG&p=N` | `GET /pixmicat.php` | 目錄/類別模式。 |
| `GET /pixmicat.php?mode=status` | `GET /pixmicat.php` | 系統資訊。 |
| `GET /pixmicat.php?mode=moduleloaded` | `GET /pixmicat.php` | 顯示 no-op module 清單與不支援說明。 |
| `GET /pixmicat.php?mode=module&load=NAME` | `GET /pixmicat.php` | 任意 PHP module 不支援，回 404 parity。 |
| `GET /mainstyle.css`, `/mainscript.js`, `/iedivfix.js`, `/nothumb.gif` | Static Assets | 原檔直出。 |
| `GET /src/:key`, `/thumb/:key` 或 `/r2/:key` | `GET /src/:key`, `GET /thumb/:key` | Worker 讀 R2 回應，URL 盡量對齊 PHP `src/` / `thumb/`。 |

## Auth / Session 方案

PHP 行為來源：

- `passwordVerify($passwordInput)` 驗證 `ADMIN_HASH`。
- `adminAuthenticate('login'|'check'|'logout')` 使用 `$_SESSION` 保存 admin login。
- user delete 可用文章密碼、cookie `pwdc`、host match 或 admin permission。

Cloudflare 對應：

1. 管理員密碼 hash 存在 `ADMIN_HASH` secret，沿用 PHP `genhash.php` 的 hash 語意；若 hash 格式不完整，README 要求使用者設定。
2. 登入成功後產生高熵 session id，KV key `session:admin:{sid}`，TTL 預設 7 天。
3. Cookie `pmc_admin` 內容為 `sid.signature`，signature 使用 HMAC-SHA-256 與 `SESSION_SECRET`。
4. 每次 `check` 先驗 cookie signature，再查 KV session。
5. Logout 刪 KV key 並清 cookie。
6. 投稿密碼 cookie 沿用 `pwdc`，email cookie 沿用 `emailc`，期限一週。
7. category cache 不使用瀏覽器 session，改 KV key `category:{md5}:list`，TTL 5 分鐘；`recache=1` 強制重建。

## `pixmicat-cf_v1` 缺漏與重建補齊方式

| v1 問題 / 缺漏 | 影響 | 本次補齊方式 |
| --- | --- | --- |
| 使用 itty-router，不符合指定 Hono stack | 架構偏離 | scaffold 使用 Hono。 |
| D1 schema 改名為 `posts` 並加入 `sticky/locked/uid/filename` 等非 PHP 欄位 | PIO V3 欄位與 template parity 困難 | 保留 `imglog`/PIO V3 欄位，額外表只放設定與 log。 |
| `root` 語意改成根文章編號，與 PHP 用 bump timestamp 排序不同 | 看板排序錯誤 | `root` 保持 UTC datetime 字串，`fetchThreadList` 依 `root DESC`。 |
| 動態 Cloudflare Image Resizing URL 依賴公開 R2 domain / CDN | 本機 `wrangler dev` 難以完整運作，且偏離 PHP 寫縮圖檔 | 上傳時產生縮圖存 R2，Worker 本機也可服務。 |
| 新增 API、Ajax polling、RSS、sticky、locked、設定後台等 PHP 預設沒有的功能 | scope creep，UI 不一致 | 不納入核心交付；只保留 PHP 版既有 mode。 |
| README 宣稱大量功能與測試，但 SSR HTML 與 PHP template parity 不明確 | 交付驗證弱 | 以 `inc_pixmicat.tpl` block parser 與 HTML snapshot/diff 驗證。 |
| 管理功能與前端管理行為重設計 | PHP 表格與刪除流程不一致 | 逐段移植 `valid()` / `admindel()` / `usrdel()` HTML 與流程。 |
| Config keys 與 PHP 常數名稱不一致 | parity 設定難追 | defaults 使用 PHP constant naming 或清楚 mapping。 |
| module system 未清楚界定 | 可能誤以為支援 PHP modules | 明確 no-op hooks，任意 PHP module 載入延後。 |

## UI 對齊策略

1. 原封不動沿用 `mainstyle.css`、`mainscript.js`、`iedivfix.js`、`nothumb.gif`。
2. 預設 theme 只移植 `inc_pixmicat.tpl`，保留 `THREAD`、`REPLY`、`SEARCHRESULT`、`DELFORM`、`MAIN` 等 block。
3. PTE parser 需支援 PHP `lib_pte.php` 的三種語法：`<!--&BLOCK-->...<!--/&BLOCK-->` block、`<!--&IF($VAR,'true','false')-->` / `<!--&IF(&BLOCK,'true','false')-->` 條件、`<!--&BLOCK/-->` block include；`FOREACH` 雖預設 theme 少用，仍在 parser 測試中保留。
4. 版面 helper 對應 PHP：
   - `head()` → `templates/page.ts::renderHead`
   - `form()` → `templates/form.ts::renderPostForm`
   - `foot()` → `templates/page.ts::renderFoot`
   - `arrangeThread()` → `templates/thread.ts::renderThread`
5. HTML 結構優先於 TypeScript 美觀；若 PHP 有不尋常輸出，照樣移植並加 `// PARITY:` 註解。
6. 若本機有 PHP 可執行，後續用參考版產出的首頁/討論串 HTML 與 Worker HTML 做結構 diff；若無 PHP，至少以 snapshot 測試驗證關鍵 class/id/tag 順序。

## 實作階段與分支/Checkpoint

每個 checkpoint 都會在非 `main/master` 分支 commit，再以 `--no-ff` merge 回 `main`，並回報分支、commit hash、merge 狀態。

1. `chore/scaffold`：建立 Cloudflare/Hono/TypeScript 專案、設定檔、初始 migration、README。
2. `feature/board-listing`：看板列表與 PHP theme parity。
3. `feature/thread-view`：討論串檢視與回應分頁。
4. `feature/posting-upload`：新建討論串、回應、R2 原圖上傳。
5. `feature/thumbnails`：上傳時縮圖產生與 R2 儲存。
6. `feature/admin-delete`：admin login、刪除文章、刪除討論串、停止回應。
7. `feature/search-category`：搜尋與類別模式。
8. `chore/ui-parity`：HTML diff/snapshot 補強、靜態資源確認。

## 後續每個 Checkpoint 前驗證

依使用者規則，每個 checkpoint 前執行：

- `npm run type-check` 或 `tsc --noEmit`
- `wrangler dev` 可正常啟動，僅本機，不執行 deploy
- D1 migration 可套用於乾淨本機 DB
- 新功能以本機 dev URL 手動測試通過
- `git status --short ref/` 確認 ref 目錄乾淨
- `git log main --oneline` 檢查 main 無非 merge commit（初始 commit 例外）

## 延後處理項目

以下項目不在第一輪完整交付內，除非後續明確要求：

- 任意 PHP module system 與第三方 module 載入。
- `inc_pixmicat-festival.tpl`、`inc_pixmicat-uploader.tpl` 多 theme 切換。
- `Utilities/*` 資料轉換工具完整移植。
- PIO 匯入/匯出中介格式完整支援。
- `admin=check/repair/export` 的完整資料庫維護/匯出能力；第一輪只保留路由與不支援回應 parity。
- DNSBL 遠端查詢；初期只保留 BAN/BAD_STRING/BAD_FILEMD5 結構與本地檢查。
- Cloudflare Images 方案。
- RSS、Ajax polling、sticky、locked UI 以外的新功能；PHP 版預設未啟用或屬 module 者不主動加入。
- 多語系完整切換；第一輪以 `zh_TW` parity 為準。
- Production `wrangler deploy`；任何部署指令需先確認。
