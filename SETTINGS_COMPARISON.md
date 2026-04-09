# Pixmicat 設定功能比較

> 注意：此文件部分內容已過時，最新精細對比請看 `REF_PARITY_REPORT.md`。

## 原本 Pixmicat (PHP) 的設定

### 1. 程式基本設定
- `DEBUG` - 是否產生詳細 DEBUG 訊息
- `TIME_ZONE` - 時區設定
- `PIXMICAT_LANGUAGE` - 語系設定
- `HTTP_UPLOAD_DIFF` - HTTP上傳誤差值
- `memory_limit` - PHP運行記憶體限制

### 2. FileIO 設定
- `FILEIO_BACKEND` - FileIO後端 (local, normal, ftp)
- `FILEIO_INDEXLOG` - FileIO索引記錄檔
- `FILEIO_PARAMETER` - FileIO參數

### 3. PIO 資料來源設定
- `CONNECTION_STRING` - PIO 連線字串 (Log, MySQL, SQLite, PostgreSQL)

### 4. 板面各項細部功能設定
- `IMG_DIR` - 圖片存放目錄
- `THUMB_DIR` - 預覽圖存放目錄
- `PHP_SELF2` - 入口檔名
- `PHP_EXT` - 副檔名
- `TITLE` - 網頁標題
- `HOME` - 回首頁連結
- `TOP_LINKS` - 額外連結
- `ADMIN_HASH` - 管理者密碼 Hash
- `IDSEED` - 生成ID之隨機種子

### 5. 管理員 Cap 設定
- `CAP_ENABLE` - 是否使用管理員 Cap
- `CAP_NAME` - 管理員 Cap 識別名稱
- `CAP_PASS` - 管理員 Cap 啟動密碼
- `CAP_SUFFIX` - 管理員 Cap 後綴字元 (★)
- `CAP_ISHTML` - 管理員 Cap 是否接受 HTML

### 6. 功能切換
- `USE_FLOATFORM` - 新增文章表單使用自動隱藏
- `USE_SEARCH` - 開放搜尋功能
- `USE_UPSERIES` - 啟用連貼機能
- `RESIMG` - 回應附加圖檔機能
- `AUTO_LINK` - URL自動作成超連結
- `KILL_INCOMPLETE_UPLOAD` - 自動刪除不完整上傳
- `ALLOW_NONAME` - 是否接受匿名發送
- `DISP_ID` - 顯示ID (0=不顯示, 1=選擇性, 2=強制)
- `CLEAR_SAGE` - 清除 E-mail 中的「sage」
- `USE_QUOTESYSTEM` - 引用瀏覽系統
- `SHOW_IMGWH` - 顯示附加圖檔長寬尺寸
- `USE_CATEGORY` - 開啟類別標籤分類功能
- `USE_RE_CACHE` - 回應頁面顯示快取功能
- `TRUST_HTTP_X_FORWARDED_FOR` - 利用 Proxy Header 抓取真實 IP

### 7. 封鎖設定
- `BAN_CHECK` - 綜合性封鎖檢查功能
- `BANPATTERN` - IP/Hostname封鎖黑名單
- `DNSBLservers` - DNSBL伺服器列表
- `DNSBLWHlist` - DNSBL白名單
- `BAD_STRING` - 限制出現之文字
- `BAD_FILEMD5` - 限制上傳附加圖檔之MD5

### 8. 附加圖檔限制
- `MAX_KB` - 附加圖檔上傳容量限制 (KB)
- `STORAGE_LIMIT` - 附加圖檔總容量限制功能
- `STORAGE_MAX` - 附加圖檔總容量限制上限 (KB)
- `ALLOW_UPLOAD_EXT` - 接受之附加圖檔副檔名

### 9. 連續投稿時間限制
- `RENZOKU` - 連續投稿間隔秒數
- `RENZOKU2` - 連續貼圖間隔秒數

### 10. 預覽圖片相關限制
- `USE_THUMB` - 使用預覽圖機能
- `MAX_W` - 討論串本文預覽圖片寬度
- `MAX_H` - 討論串本文預覽圖片高度
- `MAX_RW` - 討論串回應預覽圖片寬度
- `MAX_RH` - 討論串回應預覽圖片高度
- `THUMB_SETTING` - 預覽圖生成設定

### 11. 外觀設定
- `ADDITION_INFO` - 表單下額外文字
- `LIMIT_SENSOR` - 文章自動刪除機制設定
- `TEMPLATE_FILE` - 樣板位置
- `PAGE_DEF` - 一頁顯示幾篇討論串
- `ADMIN_PAGE_DEF` - 管理模式每頁顯示筆數
- `RE_DEF` - 一篇討論串最多顯示之回應筆數
- `RE_PAGE_DEF` - 回應模式一頁顯示幾筆回應
- `MAX_RES` - 回應筆數超過多少則不自動推文
- `MAX_AGE_TIME` - 討論串可接受推文的時間範圍
- `COMM_MAX` - 內文接受字數
- `INPUT_MAX` - 其他欄位的字數上限
- `BR_CHECK` - 文字換行行數上限
- `STATIC_HTML_UNTIL` - 自動生成靜態網頁至第幾頁
- `GZIP_COMPRESS_LEVEL` - Gzip壓縮層級
- `DEFAULT_NOTITLE` - 預設文章標題
- `DEFAULT_NONAME` - 預設文章名稱
- `DEFAULT_NOCOMMENT` - 預設文章內文

### 12. Anti-SPAM 欄位陷阱
- `FT_NAME` - 名稱欄位偽裝名稱
- `FT_EMAIL` - E-mail欄位偽裝名稱
- `FT_SUBJECT` - 標題欄位偽裝名稱
- `FT_COMMENT` - 內文欄位偽裝名稱

---

## 現在實作 (Cloudflare Workers) 的設定

### 目前實作的設定 (13個)
1. `title` - 網站標題
2. `max_posts` - 最大文章數量 (0=無限)
3. `max_threads` - 最大討論串數量 (0=無限)
4. `storage_max` - 最大儲存空間 bytes (0=無限)
5. `max_file_size` - 最大上傳檔案大小 bytes (預設 10MB)
6. `allow_res_img` - 是否允許回應附加圖片
7. `use_search` - 是否開啟搜尋功能
8. `use_category` - 是否開啟分類功能
9. `show_id` - 顯示 ID (0=不顯示, 1=選擇性, 2=強制)
10. `allow_noname` - 是否允許匿名
11. `default_name` - 預設名稱
12. `bump_limit` - 自動沉底限制 (0=不沉底)
13. `reply_limit` - 回應數限制 (0=無限制)

---

## 缺失的重要設定

### 🔴 高優先級（影響功能）

1. **管理員 Cap 設定**
   - `CAP_ENABLE` - 是否使用管理員 Cap
   - `CAP_NAME` - 管理員 Cap 識別名稱
   - `CAP_PASS` - 管理員 Cap 啟動密碼
   - `CAP_SUFFIX` - 管理員 Cap 後綴字元
   - `CAP_ISHTML` - 管理員 Cap 是否接受 HTML
   - **目前狀態：** 硬編碼在程式中

2. **連續投稿時間限制**
   - `RENZOKU` - 連續投稿間隔秒數
   - `RENZOKU2` - 連續貼圖間隔秒數
   - **目前狀態：** 未實作

3. **預覽圖尺寸設定**
   - `MAX_W` - 討論串本文預覽圖片寬度
   - `MAX_H` - 討論串本文預覽圖片高度
   - `MAX_RW` - 討論串回應預覽圖片寬度
   - `MAX_RH` - 討論串回應預覽圖片高度
   - **目前狀態：** 硬編碼為 250x250

4. **顯示設定**
   - `PAGE_DEF` - 一頁顯示幾篇討論串
   - `RE_DEF` - 一篇討論串最多顯示之回應筆數
   - `MAX_RES` - 回應筆數超過多少則不自動推文
   - **目前狀態：** 未實作分頁

5. **字數限制**
   - `COMM_MAX` - 內文接受字數
   - `INPUT_MAX` - 其他欄位的字數上限
   - **目前狀態：** 未實作

### 🟡 中優先級（影響使用者體驗）

6. **功能切換**
   - `USE_FLOATFORM` - 新增文章表單使用自動隱藏
   - `AUTO_LINK` - URL自動作成超連結
   - `USE_QUOTESYSTEM` - 引用瀏覽系統
   - `SHOW_IMGWH` - 顯示附加圖檔長寬尺寸
   - **目前狀態：** 未實作

7. **附加圖檔限制**
   - `ALLOW_UPLOAD_EXT` - 接受之附加圖檔副檔名
   - **目前狀態：** 硬編碼為 'image/*'

8. **外觀設定**
   - `DEFAULT_NOTITLE` - 預設文章標題
   - `DEFAULT_NOCOMMENT` - 預設文章內文
   - `ADDITION_INFO` - 表單下額外文字
   - **目前狀態：** 未實作

### 🟢 低優先級（技術細節，已由雲端平台處理）

9. **程式基本設定**
   - `DEBUG`, `TIME_ZONE`, `PIXMICAT_LANGUAGE`
   - **已由 Cloudflare Workers 處理**

10. **FileIO 與 PIO 設定**
    - `FILEIO_BACKEND`, `CONNECTION_STRING`
    - **已由 Cloudflare D1 和 R2 處理**

---

## 建議補充的設定

### 立即補充（高優先級）

1. **管理員 Cap 設定**
   ```typescript
   - cap_enable (boolean) - 是否啟用
   - cap_name (string) - Cap 名稱
   - cap_password (string) - Cap 密碼
   - cap_suffix (string) - Cap 後綴
   - cap_allow_html (boolean) - 是否允許 HTML
   ```

2. **連續投稿限制**
   ```typescript
   - post_interval (number) - 連續投稿間隔秒數
   - image_post_interval (number) - 連續貼圖間隔秒數
   ```

3. **預覽圖設定**
   ```typescript
   - thumb_max_width (number) - 預覽圖最大寬度
   - thumb_max_height (number) - 預覽圖最大高度
   - thumb_quality (number) - 預覽圖品質 (1-100)
   ```

4. **分頁設定**
   ```typescript
   - threads_per_page (number) - 每頁顯示討論串數
   - replies_per_thread (number) - 每串顯示回應數
   - auto_bump_limit (number) - 自動推文限制
   ```

5. **字數限制**
   ```typescript
   - max_comment_length (number) - 內文最大字數
   - max_field_length (number) - 其他欄位最大字數
   ```

### 考慮補充（中優先級）

6. **功能切換**
   ```typescript
   - auto_link_urls (boolean) - 自動連結 URL
   - enable_quote_system (boolean) - 引用系統
   - show_image_dimensions (boolean) - 顯示圖片尺寸
   - use_floating_form (boolean) - 浮動表單
   ```

7. **檔案限制**
   ```typescript
   - allowed_extensions (string) - 允許的副檔名 (逗號分隔)
   ```

8. **外觀設定**
   ```typescript
   - default_title (string) - 預設標題
   - default_comment (string) - 預設內文
   - form_notice (string) - 表單說明文字
   ```

---

## 總結

- **原本設定數量：** 約 60+ 個設定項目
- **目前實作：** 13 個設定項目
- **缺失比例：** 約 78%

**關鍵差異：**
1. 原本版本是 PHP 桌架，需要更多技術設定
2. 現在版本是 Serverless 架構，許多技術細節由雲端平台處理
3. 原本版本使用設定檔 (config.php)，現在版本使用資料庫儲存設定
4. 許多原本的設定（如檔案路徑、連線字串）在 Cloudflare 架構中不再需要

**建議優先補充：**
1. 管理員 Cap 設定（影響管理功能）
2. 連續投稿限制（防止 spam）
3. 預覽圖設定（使用者體驗）
4. 分頁設定（瀏覽體驗）
5. 字數限制（防止滥用）
