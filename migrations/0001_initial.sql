-- 初始資料庫 Schema

-- 文章表
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  no INTEGER UNIQUE NOT NULL,
  resto INTEGER DEFAULT 0, -- 0 = OP, >0 = reply to post no
  name TEXT DEFAULT '無名氏', -- 發文名稱
  email TEXT DEFAULT '', -- Email/ cap code
  sub TEXT DEFAULT '', -- 標題
  com TEXT DEFAULT '', -- 內容
  password TEXT DEFAULT '', -- 刪除密碼 (hash)
  time INTEGER NOT NULL, -- 發文時間 (Unix timestamp)
  md5 TEXT DEFAULT '', -- 圖片 MD5
  filename TEXT DEFAULT '', -- 原始檔名
  ext TEXT DEFAULT '', -- 副檔名 (含 .)
  w INTEGER DEFAULT 0, -- 原圖寬度
  h INTEGER DEFAULT 0, -- 原圖高度
  tn_w INTEGER DEFAULT 0, -- 縮圖寬度
  tn_h INTEGER DEFAULT 0, -- 縮圖高度
  tim TEXT DEFAULT '', -- 時間戳檔名
  filesize INTEGER DEFAULT 0, -- 檔案大小
  category TEXT DEFAULT '', -- 分類標籤
  sticky INTEGER DEFAULT 0, -- 是否置頂
  locked INTEGER DEFAULT 0, -- 是否鎖定
  status INTEGER DEFAULT 0, -- 狀態位元
  ip TEXT DEFAULT '', -- IP hash
  uid TEXT DEFAULT '', -- User ID
  last_modified INTEGER DEFAULT 0, -- 最後修改時間
  root INTEGER DEFAULT 0 -- 根文章編號
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_posts_resto ON posts(resto);
CREATE INDEX IF NOT EXISTS idx_posts_time ON posts(time);
CREATE INDEX IF NOT EXISTS idx_posts_root ON posts(root);
CREATE INDEX IF NOT EXISTS idx_posts_sticky ON posts(sticky, time DESC);

-- 系統設定表
CREATE TABLE IF NOT EXISTS configs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT DEFAULT '',
  updated_at INTEGER NOT NULL
);

-- 封鎖列表
CREATE TABLE IF NOT EXISTS banlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, -- 'ip', 'hostname', 'md5', 'string'
  pattern TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  expires_at INTEGER DEFAULT 0 -- 0 = 永久
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_banlist_type ON banlist(type);
CREATE INDEX IF NOT EXISTS idx_banlist_pattern ON banlist(pattern);

-- 報告/刪除日誌
CREATE TABLE IF NOT EXISTS moderation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL, -- 'delete', 'ban', 'sticky', etc.
  target_no INTEGER,
  target_type TEXT, -- 'post', 'thread'
  reason TEXT DEFAULT '',
  moderator TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);

-- 插入預設設定
INSERT INTO configs (key, value, description, updated_at) VALUES
  ('title', 'Pixmicat!-CF', '網站標題', strftime('%s', 'now')),
  ('max_posts', '0', '最大文章數量 (0=無限)', strftime('%s', 'now')),
  ('max_threads', '0', '最大討論串數量 (0=無限)', strftime('%s', 'now')),
  ('storage_max', '0', '最大儲存空間 bytes (0=無限)', strftime('%s', 'now')),
  ('max_file_size', '10485760', '最大上傳檔案大小 bytes (10MB)', strftime('%s', 'now')),
  ('allow_res_img', '1', '是否允許回應附加圖片 (0=否, 1=是)', strftime('%s', 'now')),
  ('use_search', '1', '是否開啟搜尋功能 (0=否, 1=是)', strftime('%s', 'now')),
  ('use_category', '1', '是否開啟分類功能 (0=否, 1=是)', strftime('%s', 'now')),
  ('show_id', '2', '顯示 ID (0=不顯示, 1=選擇性, 2=強制)', strftime('%s', 'now')),
  ('allow_noname', '1', '是否允許匿名 (0=否, 1=是)', strftime('%s', 'now')),
  ('default_name', '無名氏', '預設名稱', strftime('%s', 'now')),
  ('bump_limit', '0', '自動沉底限制 (0=不沉底)', strftime('%s', 'now')),
  ('reply_limit', '0', '回應數限制 (0=無限制)', strftime('%s', 'now')),
  -- 管理員 Cap 設定
  ('cap_enable', '1', '是否啟用管理員 Cap (0=否, 1=是)', strftime('%s', 'now')),
  ('cap_name', 'futaba', '管理員 Cap 識別名稱', strftime('%s', 'now')),
  ('cap_password', 'futaba', '管理員 Cap 啟動密碼', strftime('%s', 'now')),
  ('cap_suffix', ' ★', '管理員 Cap 後綴字元', strftime('%s', 'now')),
  ('cap_allow_html', '1', '管理員 Cap 是否接受 HTML (0=否, 1=是)', strftime('%s', 'now')),
  -- 連續投稿限制
  ('post_interval', '60', '連續投稿間隔秒數', strftime('%s', 'now')),
  ('image_post_interval', '60', '連續貼圖間隔秒數', strftime('%s', 'now')),
  -- 預覽圖設定
  ('thumb_max_width', '250', '預覽圖最大寬度', strftime('%s', 'now')),
  ('thumb_max_height', '250', '預覽圖最大高度', strftime('%s', 'now')),
  ('thumb_quality', '75', '預覽圖品質 (1-100)', strftime('%s', 'now')),
  -- 分頁設定
  ('threads_per_page', '15', '每頁顯示討論串數', strftime('%s', 'now')),
  ('replies_per_thread', '30', '每串顯示回應數 (0=全部)', strftime('%s', 'now')),
  ('auto_bump_limit', '0', '回應超過此數不再自動推文 (0=不限制)', strftime('%s', 'now')),
  -- 字數限制
  ('max_comment_length', '2000', '內文最大字數', strftime('%s', 'now')),
  ('max_field_length', '100', '其他欄位最大字數', strftime('%s', 'now')),
  -- 功能切換
  ('auto_link_urls', '1', 'URL 自動連結 (0=否, 1=是)', strftime('%s', 'now')),
  ('enable_quote_system', '1', '引用系統 >>No. (0=否, 1=是)', strftime('%s', 'now')),
  ('show_image_dimensions', '1', '顯示圖片尺寸 (0=否, 1=是)', strftime('%s', 'now')),
  ('use_floating_form', '0', '使用浮動表單 (0=否, 1=是)', strftime('%s', 'now')),
  -- 檔案限制
  ('allowed_extensions', 'GIF,JPG,JPEG,PNG,BMP,WEBP', '允許的圖片副檔名 (逗號分隔)', strftime('%s', 'now')),
  -- 外觀設定
  ('default_title', '無標題', '預設文章標題', strftime('%s', 'now')),
  ('default_comment', '無內文', '預設文章內文', strftime('%s', 'now')),
  ('form_notice', '• 附檔請使用圖片 (GIF, JPG, PNG, WEBP)<br>• 請勿上傳違法圖片<br>• 同一 IP 60秒內只能發文一次', '表單說明文字', strftime('%s', 'now')),
  ('max_age_time', '0', '討論串可接受推文的時間範圍-小時 (0=不限制)', strftime('%s', 'now'));
