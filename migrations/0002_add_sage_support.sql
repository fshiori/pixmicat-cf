-- 添加 sage 支援
-- 添加 is_sage 欄位標記不推文的回應

ALTER TABLE posts ADD COLUMN is_sage INTEGER DEFAULT 0;
