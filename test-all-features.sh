#!/bin/bash

# Pixmicat Cloudflare Workers - 完整功能測試
# 測試所有功能（除了縮圖相關）

BASE_URL="https://pixmicat.dcard.dev"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 測試輔助函數
test_api() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_code="$5"
    local check_contains="$6"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "測試 $TOTAL_TESTS: $name ... "

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "$expected_code" ]; then
        if [ -z "$check_contains" ] || echo "$body" | grep -q "$check_contains"; then
            echo -e "${GREEN}✓ 通過${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        fi
    fi

    echo -e "${RED}✗ 失敗${NC}"
    echo "  期待 HTTP $expected_code，實際 $http_code"
    if [ -n "$check_contains" ]; then
        echo "  期待包含: $check_contains"
        echo "  實際回應: $body" | head -c 200
    fi
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
}

echo "=================================="
echo "Pixmicat 完整功能測試"
echo "=================================="
echo ""

# 1. 首頁功能測試
echo "【1. 首頁功能】"
test_api "首頁載入" "GET" "/" "" "200" "<!DOCTYPE html>"

# API 更新需要先有一個討論串，暫時跳過
echo "測試: API 更新檢查（需要先創建討論串）"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo -e "${YELLOW}⊘ 跳過${NC} (需要先創建討論串)"
echo ""

# 2. 文章發文測試
echo "【2. 文章發文功能】"

# 生成隨機字串作為內容以避免重複
TIMESTAMP=$(date +%s)
RANDOM_STR="test_$TIMESTAMP"

# 測試純文字發文 - 使用 multipart/form-data
echo "測試: 發文 - 純文字文章"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/post" \
    -F "name=" \
    -F "email=" \
    -F "sub=" \
    -F "hp_website=spammer" \
    -F "hp_url=foo@foo.bar" \
    -F "hp_company=DO NOT FIX THIS" \
    -F "hp_comment=EID OG SMAPS" \
    -F "bvUFbdrIC=測試使用者" \
    -F "ObHGyhdTR=test@example.com" \
    -F "SJBgiFbhj=測試標題$TIMESTAMP" \
    -F "pOBvrtyJK=$RANDOM_STR" \
    -F "password=test123")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ] && echo "$body" | grep -q "success"; then
    echo -e "${GREEN}✓ 通過${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ 失敗${NC}"
    echo "  HTTP $http_code"
    echo "  回應: $body" | head -c 300
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# 等待一下避免限速
sleep 2

# 測試管理員登入
echo ""
echo "【3. 管理功能】"
ADMIN_HASH=$(echo -n "test123456pixmicat-admin-salt" | shasum -a 256 | cut -d' ' -f1)

test_api "管理員登入 - 正確密碼" "POST" "/admin/api/login" \
    "{\"password\":\"test123456\"}" \
    "200" "success"

# 獲取 session token
sleep 1
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"password\":\"test123456\"}")
SESSION_TOKEN=$(echo "$SESSION_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$SESSION_TOKEN" ]; then
    echo -e "${GREEN}✓ 管理 Session 獲取成功${NC}"

    # 測試設定管理
    test_api "讀取設定" "GET" "/admin/api/config" "" "200" "banCheck"

    # 測試反垃圾設定
    test_api "讀取反垃圾設定" "GET" "/admin/api/anti-spam" "" "200" "banCheck"

    # 測試統計數據
    test_api "統計數據" "GET" "/admin/api/stats" "" "200" "totalPosts"

    # 測試匯出功能
    test_api "匯出文章" "GET" "/admin/api/export" "" "200" "exportedAt"

    echo ""
    echo "【4. 分類功能】"
    test_api "分類頁面" "GET" "/category/test" "" "200" "category"

    echo ""
    echo "【5. 搜尋功能】"
    test_api "搜尋 API" "GET" "/api/search?q=test" "" "200" "success"

    echo ""
    echo "【6. 討論串功能】"
    # 需要先創建一個討論串
    sleep 1
    echo "測試: 創建測試討論串"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    THREAD_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/post" \
        -F "name=" \
        -F "email=" \
        -F "sub=" \
        -F "hp_website=spammer" \
        -F "hp_url=foo@foo.bar" \
        -F "hp_company=DO NOT FIX THIS" \
        -F "hp_comment=EID OG SMAPS" \
        -F "bvUFbdrIC=測試" \
        -F "ObHGyhdTR=" \
        -F "SJBgiFbhj=討論串測試$TIMESTAMP" \
        -F "pOBvrtyJK=這是測試討論串$TIMESTAMP" \
        -F "password=test123")

    THREAD_HTTP=$(echo "$THREAD_RESPONSE" | tail -n1)
    THREAD_BODY=$(echo "$THREAD_RESPONSE" | head -n-1)

    if [ "$THREAD_HTTP" = "200" ] && echo "$THREAD_BODY" | grep -q "success"; then
        echo -e "${GREEN}✓ 討論串創建成功${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        # 提取 no
        THREAD_NO=$(echo "$THREAD_BODY" | grep -o '"no":[0-9]*' | head -1 | cut -d':' -f2)
        if [ -n "$THREAD_NO" ]; then
            test_api "單一討論串頁面" "GET" "/res/$THREAD_NO.htm" "" "200" "<!DOCTYPE html>"
            test_api "討論串回應 API" "GET" "/api/thread/$THREAD_NO" "" "200" "posts"
        fi
    else
        echo -e "${RED}✗ 討論串創建失敗${NC}"
        echo "  HTTP $THREAD_HTTP"
        echo "  回應: $THREAD_BODY" | head -c 200
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi

    echo ""
    echo "【7. 其他 API】"
    test_api "版本資訊" "GET" "/api/version" "" "200" "version"
    test_api "目錄 API" "GET" "/api/catalog" "" "200" "threads"

    # 測試管理頁面
    echo ""
    echo "【8. 管理頁面】"
    test_api "管理後台首頁" "GET" "/admin" "" "200" "<!DOCTYPE html>"
    test_api "管理登入頁面" "GET" "/admin/login" "" "200" "<!DOCTYPE html>"
fi

echo ""
echo "=================================="
echo "測試結果總結"
echo "=================================="
echo -e "總測試數: $TOTAL_TESTS"
echo -e "${GREEN}通過: $PASSED_TESTS${NC}"
echo -e "${RED}失敗: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ 所有測試通過！${NC}"
    exit 0
else
    echo -e "${RED}✗ 有 $FAILED_TESTS 個測試失敗${NC}"
    exit 1
fi
