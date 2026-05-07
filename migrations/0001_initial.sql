-- Pixmicat!-PIO 8th.Release.4 compatible D1 schema.

CREATE TABLE IF NOT EXISTS imglog (
  no INTEGER PRIMARY KEY AUTOINCREMENT,
  resto INTEGER NOT NULL DEFAULT 0,
  root TEXT NOT NULL DEFAULT '0',
  time INTEGER NOT NULL,
  md5chksum TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  tim TEXT NOT NULL DEFAULT '',
  ext TEXT NOT NULL DEFAULT '',
  imgw INTEGER NOT NULL DEFAULT 0,
  imgh INTEGER NOT NULL DEFAULT 0,
  imgsize TEXT NOT NULL DEFAULT '',
  tw INTEGER NOT NULL DEFAULT 0,
  th INTEGER NOT NULL DEFAULT 0,
  pwd TEXT NOT NULL DEFAULT '',
  now TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  sub TEXT NOT NULL DEFAULT '',
  com TEXT NOT NULL DEFAULT '',
  host TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_imglog_resto ON imglog(resto);
CREATE INDEX IF NOT EXISTS idx_imglog_root ON imglog(root);
CREATE INDEX IF NOT EXISTS idx_imglog_time ON imglog(time);
CREATE INDEX IF NOT EXISTS idx_imglog_resto_no ON imglog(resto, no);
CREATE INDEX IF NOT EXISTS idx_imglog_root_no ON imglog(root DESC, no DESC);

CREATE TABLE IF NOT EXISTS configs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS banlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  expires_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_banlist_type_pattern ON banlist(type, pattern);

CREATE TABLE IF NOT EXISTS moderation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  target_no INTEGER,
  target_type TEXT NOT NULL DEFAULT '',
  moderator TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_log_target ON moderation_log(target_type, target_no);
CREATE INDEX IF NOT EXISTS idx_moderation_log_created_at ON moderation_log(created_at);

INSERT OR IGNORE INTO configs (key, value, description, updated_at) VALUES
  ('TITLE', 'Pixmicat!-CF', 'Page title from config.php TITLE', unixepoch()),
  ('HOME', '../', 'Top link home target', unixepoch()),
  ('TIME_ZONE', '+8', 'GMT offset used by Pixmicat date formatting', unixepoch()),
  ('PIXMICAT_LANGUAGE', 'zh_TW', 'Default language', unixepoch()),
  ('USE_FLOATFORM', '1', 'Use floating post form', unixepoch()),
  ('USE_SEARCH', '1', 'Enable search page', unixepoch()),
  ('USE_UPSERIES', '1', 'Enable continual posting redirect', unixepoch()),
  ('RESIMG', '1', 'Allow images on replies', unixepoch()),
  ('AUTO_LINK', '1', 'Auto-link URLs in comments', unixepoch()),
  ('KILL_INCOMPLETE_UPLOAD', '1', 'Delete incomplete uploads', unixepoch()),
  ('ALLOW_NONAME', '1', 'Allow anonymous posts', unixepoch()),
  ('CAP_ENABLE', '1', 'Enable admin cap', unixepoch()),
  ('CAP_NAME', 'futaba', 'Admin cap display name', unixepoch()),
  ('CAP_PASS', 'futaba', 'Admin cap password', unixepoch()),
  ('CAP_SUFFIX', ' ★', 'Admin cap suffix', unixepoch()),
  ('DISP_ID', '2', 'Display poster ID mode', unixepoch()),
  ('CLEAR_SAGE', '0', 'Clear sage from email while rendering', unixepoch()),
  ('USE_QUOTESYSTEM', '1', 'Enable quote links', unixepoch()),
  ('SHOW_IMGWH', '1', 'Show image dimensions', unixepoch()),
  ('USE_CATEGORY', '1', 'Enable category tags', unixepoch()),
  ('USE_RE_CACHE', '1', 'Enable reply page cache', unixepoch()),
  ('TRUST_HTTP_X_FORWARDED_FOR', '0', 'Trust proxy headers', unixepoch()),
  ('BAN_CHECK', '0', 'Enable ban checks', unixepoch()),
  ('MAX_KB', '2000', 'Max upload size in KB', unixepoch()),
  ('STORAGE_LIMIT', '1', 'Enable attachment storage limit', unixepoch()),
  ('STORAGE_MAX', '30000', 'Attachment storage limit in KB', unixepoch()),
  ('ALLOW_UPLOAD_EXT', 'GIF|JPG|JPEG|PNG|BMP|SWF', 'Allowed upload extensions', unixepoch()),
  ('RENZOKU', '60', 'Successive post interval seconds', unixepoch()),
  ('RENZOKU2', '60', 'Successive image post interval seconds', unixepoch()),
  ('USE_THUMB', '1', 'Thumbnail generation mode', unixepoch()),
  ('MAX_W', '250', 'Thread thumbnail max width', unixepoch()),
  ('MAX_H', '250', 'Thread thumbnail max height', unixepoch()),
  ('MAX_RW', '125', 'Reply thumbnail max width', unixepoch()),
  ('MAX_RH', '125', 'Reply thumbnail max height', unixepoch()),
  ('THUMB_FORMAT', 'jpg', 'Thumbnail file format', unixepoch()),
  ('THUMB_QUALITY', '75', 'Thumbnail quality', unixepoch()),
  ('PAGE_DEF', '15', 'Threads per page', unixepoch()),
  ('ADMIN_PAGE_DEF', '20', 'Admin rows per page', unixepoch()),
  ('RE_DEF', '10', 'Replies shown on board index', unixepoch()),
  ('RE_PAGE_DEF', '30', 'Replies per reply-mode page', unixepoch()),
  ('MAX_RES', '30', 'Bump limit', unixepoch()),
  ('MAX_AGE_TIME', '0', 'Max bump age in hours', unixepoch()),
  ('COMM_MAX', '2000', 'Max comment length', unixepoch()),
  ('INPUT_MAX', '100', 'Max input field length', unixepoch()),
  ('BR_CHECK', '0', 'Line break limit', unixepoch()),
  ('STATIC_HTML_UNTIL', '10', 'Legacy static HTML page limit', unixepoch()),
  ('DEFAULT_NOTITLE', '無標題', 'Default subject', unixepoch()),
  ('DEFAULT_NONAME', '無名氏', 'Default name', unixepoch()),
  ('DEFAULT_NOCOMMENT', '無內文', 'Default comment', unixepoch()),
  ('FT_NAME', 'bvUFbdrIC', 'Field trap name input', unixepoch()),
  ('FT_EMAIL', 'ObHGyhdTR', 'Field trap email input', unixepoch()),
  ('FT_SUBJECT', 'SJBgiFbhj', 'Field trap subject input', unixepoch()),
  ('FT_COMMENT', 'pOBvrtyJK', 'Field trap comment input', unixepoch());
