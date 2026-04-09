#!/bin/bash
# Pixmicat-CF 初始化腳本

set -e

echo "🎨 Pixmicat! for Cloudflare Workers - 初始化腳本"
echo "================================================"
echo ""

# 檢查 wrangler 是否安裝
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler 未安裝，請先安裝："
    echo "   npm install -g wrangler"
    exit 1
fi

echo "✓ wrangler 已安裝"

# 檢查是否已登入
echo ""
echo "📝 檢查 Cloudflare 登入狀態..."
if wrangler whoami &> /dev/null; then
    echo "✓ 已登入 Cloudflare"
else
    echo "❌ 未登入 Cloudflare，請先登入："
    echo "   wrangler login"
    exit 1
fi

# 建立 D1 資料庫
echo ""
echo "🗄️ 建立 D1 資料庫..."
if wrangler d1 list | grep -q "pixmicat-db"; then
    echo "⚠️ 資料庫 pixmicat-db 已存在，跳過建立"
else
    DB_OUTPUT=$(wrangler d1 create pixmicat-db)
    DB_ID=$(echo "$DB_OUTPUT" | grep "database_id" | awk -F'"' '{print $2}')
    echo "✓ 資料庫已建立，ID: $DB_ID"
    echo ""
    echo "⚠️ 請將以下內容加入 wrangler.toml 的 [[d1_databases]] 區塊："
    echo "   database_id = \"$DB_ID\""
fi

# 建立 R2 Bucket
echo ""
echo "📦 建立 R2 Bucket..."
if wrangler r2 bucket list | grep -q "pixmicat-storage"; then
    echo "⚠️ R2 bucket pixmicat-storage 已存在，跳過建立"
else
    wrangler r2 bucket create pixmicat-storage
    echo "✓ R2 bucket 已建立"
fi

# 建立本地開發用的 R2 Bucket
if wrangler r2 bucket list | grep -q "pixmicat-storage-local"; then
    echo "⚠️ 本地 R2 bucket 已存在，跳過建立"
else
    wrangler r2 bucket create pixmicat-storage-local
    echo "✓ 本地 R2 bucket 已建立"
fi

# 建立 KV Namespace
echo ""
echo "🔑 建立 KV Namespace..."
if wrangler kv namespace list | grep -q "pixmicat-kv"; then
    echo "⚠️ KV namespace pixmicat-kv 已存在，跳過建立"
else
    KV_OUTPUT=$(wrangler kv namespace create pixmicat-kv)
    KV_ID=$(echo "$KV_OUTPUT" | grep "id" | awk -F'"' '{print $2}')
    echo "✓ KV namespace 已建立，ID: $KV_ID"
    echo ""
    echo "⚠️ 請將以下內容加入 wrangler.toml 的 [[kv_namespaces]] 區塊："
    echo "   id = \"$KV_ID\""
fi

# 執行資料庫遷移
echo ""
echo "🔄 執行資料庫遷移..."
read -p "是否執行生產環境遷移？(y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    wrangler d2 migrations apply pixmicat-db --remote
else
    echo "⚠️ 跳過生產環境遷移"
fi

echo ""
read -p "是否執行本地環境遷移？(Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    wrangler d2 migrations apply pixmicat-db --local
    echo "✓ 本地環境遷移完成"
else
    echo "⚠️ 跳過本地環境遷移"
fi

# 安裝依賴
echo ""
echo "📦 安裝 npm 依賴..."
npm install
echo "✓ 依賴安裝完成"

# 建立 .dev.vars
echo ""
if [ ! -f .dev.vars ]; then
    echo "📝 建立 .dev.vars..."
    cp dev.vars.example .dev.vars
    echo "✓ .dev.vars 已建立"
    echo "⚠️ 請編輯 .dev.vars 並設定必要的環境變數"
else
    echo "⚠️ .dev.vars 已存在，跳過"
fi

echo ""
echo "🎉 初始化完成！"
echo ""
echo "下一步："
echo "  1. 編輯 wrangler.toml，填入 database_id 和 KV id"
echo "  2. 編輯 .dev.vars，設定環境變數"
echo "  3. 執行 npm run dev 開始本地開發"
echo "  4. 執行 npm run deploy 部署到生產環境"
echo ""
