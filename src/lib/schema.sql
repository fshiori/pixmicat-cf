-- IP 封鎖表（注意：production 使用 banlist 表名）
CREATE TABLE IF NOT EXISTS banlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, -- 'ip', 'hostname', 'md5', 'string'
  pattern TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  created_by TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  expires_at INTEGER DEFAULT 0 -- 0 = 永久
);

CREATE INDEX IF NOT EXISTS idx_banlist_type ON banlist(type);
CREATE INDEX IF NOT EXISTS idx_banlist_pattern ON banlist(pattern);
CREATE INDEX IF NOT EXISTS idx_banlist_expires ON banlist(expires_at);
