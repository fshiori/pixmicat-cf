#!/bin/bash

# Pixmicat 表單提交測試 - 實際填寫表單並測試流程

BASE_URL="https://pixmicat.dcard.dev"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=================================="
echo "Pixmicat 表單提交測試"
echo "=================================="
echo ""

# 1. 測試發文表單提交（使用 FormData + Honeypot + Field Trap）
echo "【1. 測試發文表單】"
echo "測試發送一篇文章（使用 FormData）..."

# 先取得首頁的 cookies
response=$(curl -s -c /tmp/cookies.txt -b /tmp/cookies.txt "$BASE_URL/")

# 提交新文章（使用 multipart/form-data）
# 注意：必須包含 Honeypot 欄位（正確值）和 Field Trap 欄位
post_response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/post" \
  -b /tmp/cookies.txt \
  -F "hp_website=spammer" \
  -F "hp_url=foo@foo.bar" \
  -F "hp_company=DO NOT FIX THIS" \
  -F "hp_comment=EID OG SMAPS" \
  -F "hp_reply=" \
  -F "bvUFbdrIC=測試使用者" \
  -F "ObHGyhdTR=" \
  -F "SJBgiFbhj=自動測試文章" \
  -F "pOBvrtyJK=這是透過表單提交的自動測試文章。<br>時間: $(date)" \
  -F "password=" \
  -F "category=general" \
  -F "resto=0" \
  -F "continual_post=1" \
  2>&1)

http_code=$(echo "$post_response" | tail -n1)
body=$(echo "$post_response" | head -n-1)

echo "HTTP 狀態碼: $http_code"
echo "回應: $body" | head -c 300

if echo "$body" | grep -q "success"; then
  echo -e "\n${GREEN}✓ 發文成功${NC}"
  # 取得新文章編號
  post_no=$(echo "$body" | grep -o '"no":[0-9]*' | head -1 | cut -d: -f2)
  echo "新文章編號: $post_no"
else
  echo -e "\n${RED}✗ 發文失敗${NC}"
fi

echo ""

# 2. 測試管理員登入表單
echo "【2. 測試管理員登入表單】"
echo "測試登入管理後台..."

# 測試錯誤密碼
login_response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/admin/api/login" \
  -H "Content-Type: application/json" \
  -d '{"password": "wrongpassword"}' 2>&1)

http_code=$(echo "$login_response" | tail -n1)
body=$(echo "$login_response" | head -n-1)

echo "嘗試錯誤密碼..."
echo "HTTP 狀態碼: $http_code"
echo "回應: $body" | head -c 200

if echo "$body" | grep -q "密碼錯誤\|失敗\|error"; then
  echo -e "\n${GREEN}✓ 正確拒絕錯誤密碼${NC}"
else
  echo -e "\n${YELLOW}⚠ 未正確拒絕錯誤密碼${NC}"
fi

echo ""

# 3. 測試搜尋表單
echo "【3. 測試搜尋表單】"
# URL 編碼中文關鍵字
QUERY_ENCODED=$(echo -n "測試" | jq -sRr @uri)
search_response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/search?q=$QUERY_ENCODED&type=all" 2>&1)

http_code=$(echo "$search_response" | tail -n1)
body=$(echo "$search_response" | head -n-1)

echo "HTTP 狀態碼: $http_code"

if echo "$body" | grep -q "success"; then
  count=$(echo "$body" | grep -o '"count":[0-9]*' | cut -d: -f2)
  echo -e "${GREEN}✓ 搜尋成功${NC} (找到 $count 筆結果)"
else
  echo -e "${RED}✗ 搜尋失敗${NC}"
fi

echo ""

# 4. 測試 Ajax 更新功能（模擬前端自動更新）
echo "【4. 測試 Ajax 自動更新】"
echo "檢查是否有新文章..."

update_response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/update?thread=1&time=0" 2>&1)

http_code=$(echo "$update_response" | tail -n1)
body=$(echo "$update_response" | head -n-1)

echo "HTTP 狀態碼: $http_code"

if echo "$body" | grep -q "success"; then
  count=$(echo "$body" | grep -o '"count":[0-9]*' | cut -d: -f2)
  echo -e "${GREEN}✓ 更新檢查成功${NC} (有 $count 筆新回應)"
else
  echo -e "${RED}✗ 更新檢查失敗${NC}"
fi

echo ""

# 5. 測試分類過濾
echo "【5. 測試分類過濾】"
category_response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/category/general" 2>&1)

http_code=$(echo "$category_response" | tail -n1)
body=$(echo "$category_response" | head -n-1)

echo "HTTP 狀態碼: $http_code"

if echo "$body" | grep -q "success"; then
  count=$(echo "$body" | grep -o '"count":[0-9]*' | cut -d: -f2)
  echo -e "${GREEN}✓ 分類過濾成功${NC} (找到 $count 筆)"
else
  echo -e "${RED}✗ 分類過濾失敗${NC}"
fi

echo ""

# 6. 測試文章匯出
echo "【6. 測試文章匯出】"
export_response=$(curl -s -w "\n%{http_code}" "$BASE_URL/admin/api/export" 2>&1)

http_code=$(echo "$export_response" | tail -n1)
body=$(echo "$export_response" | head -n-1)

echo "HTTP 狀態碼: $http_code"

if [ "$http_code" = "200" ] && echo "$body" | grep -q "version\|posts"; then
  echo -e "${GREEN}✓ 文章匯出成功${NC}"
else
  echo -e "${YELLOW}⚠ 匯出可能需要管理員權限${NC}"
fi

echo ""
echo "=================================="
echo "測試完成"
echo "=================================="

# 清理
rm -f /tmp/cookies.txt
