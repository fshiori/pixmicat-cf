-- 補齊與 ref 相容的設定鍵（不覆蓋既有值）
INSERT OR IGNORE INTO configs (key, value, description, updated_at) VALUES
  ('re_page_def', '0', '單一討論串回應每頁顯示數 (0=不分頁)', strftime('%s', 'now')),
  ('clear_sage', '0', '是否清除 E-mail 欄位中的 sage (0=否, 1=是)', strftime('%s', 'now')),
  ('max_line_breaks', '50', '內文換行數上限', strftime('%s', 'now')),
  ('enable_duplicate_check', '1', '是否啟用附檔 MD5 重複檢查 (0=否, 1=是)', strftime('%s', 'now')),
  ('trust_http_x_forwarded_for', '0', '是否信任 X-Forwarded-For 等 Proxy Header (0=否, 1=是)', strftime('%s', 'now'));
