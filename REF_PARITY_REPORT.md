# Ref 對比報告（pixmicat-8th.Release.4 vs pixmicat-cf）

更新時間：2026-04-10

## 對比範圍
- Ref：`/home/eric/workspaces/ref/pixmicat-8th.Release.4/config.php`
- 現行：`/home/eric/workspaces/pixmicat-cf/src/**`, `migrations/**`

## 結論（重點）

### 這次已補齊/修正
1. **設定鍵命名不一致（高風險）**
   - 已加 alias 相容：
     - `show_image_dimensions` ↔ `show_imgwh`
     - `use_floating_form` ↔ `use_float_form`
     - `form_notice` ↔ `addition_info`
     - `auto_bump_limit` ↔ `max_res` / `bump_limit`
     - `trust_http_x_forwarded_for` ↔ `trust_proxy_headers`
2. **BANPATTERN regex 判斷順序錯誤**（會誤判成 CIDR）
   - 已修正：先判斷 `/.../` regex，再判斷 CIDR。
3. **TRUST_HTTP_X_FORWARDED_FOR 行為補齊**
   - 已修正：
     - 永遠優先 `CF-Connecting-IP`
     - 僅在啟用 `trust_http_x_forwarded_for` 時信任 `X-Forwarded-For` 等代理 header
4. **缺漏預設設定補齊（migrations）**
   - 新增：`re_page_def`, `clear_sage`, `max_line_breaks`, `enable_duplicate_check`, `trust_http_x_forwarded_for`
   - 並新增 `migrations/0002_config_parity.sql` 給既有資料庫補值。

---

## 仍待補齊（和 ref 比較）

### 🔴 高優先級
1. **縮圖本地模式真實 resize**
   - 現況：`/thumb/:filename` 本地開發直接回原圖，非真縮圖。
   - 建議：本地加 fallback resize 流程（或明確文件化限制）。

2. **部分設定未完整進入管理 UI 的「語意一致」層**
   - 現況：雖有 DB key，但 UI/說明仍混有舊鍵名語意。
   - 建議：統一使用 canonical key，alias 僅做讀取相容。

### 🟡 中優先級
3. **`TRUST_HTTP_X_FORWARDED_FOR` 可視化配置/說明**
   - 現況：後端支援，但管理頁需明確提示風險。

4. **Ref 中部分展示細節（TOP_LINKS / HOME 等）尚未完整對齊**
   - 屬 UX parity，不影響核心發文/管理流程。

### ⚪ 可不做（平台差異）
- `FILEIO_BACKEND`, `CONNECTION_STRING`, `GZIP_COMPRESS_LEVEL`, `STATIC_HTML_UNTIL`, `memory_limit`
- 原因：Cloudflare Workers 平台已處理/不適用。
