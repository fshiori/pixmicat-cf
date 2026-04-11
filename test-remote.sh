#!/bin/bash

# Pixmicat Cloudflare Workers - 遠端功能測試
# 測試所有基礎 API 端點（不涉及發文）

BASE_URL="https://pixmicat.dcard.dev"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" 2>&1)
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
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
    fi
    echo "  回應: $body" | head -c 300
    echo ""
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
}

echo "=================================="
echo "Pixmicat 遠端功能測試"
echo "=================================="
echo ""

# 1. 基礎頁面
echo "【1. 基礎頁面載入】"
test_api "首頁" "GET" "/" "" "200" "<!DOCTYPE html>"
test_api "管理登入頁" "GET" "/admin/login" "" "200" "<!DOCTYPE html>"
test_api "管理後台" "GET" "/admin" "" "200" "<!DOCTYPE html>"
echo ""

# 2. API 端點
echo "【2. API 端點】"
test_api "版本資訊" "GET" "/api/version" "" "200" "version"
test_api "目錄 API" "GET" "/api/catalog" "" "200" "threads"
test_api "搜尋 API" "GET" "/api/search?q=test" "" "200" "success"
echo ""

# 3. 討論串相關
echo "【3. 討論串功能】"
test_api "單一討論串頁面" "GET" "/res/1.htm" "" "200" "<!DOCTYPE html>"
test_api "討論串 API" "GET" "/api/thread/1" "" "200" "posts"
echo ""

# 4. 分類功能
echo "【4. 分類功能】"
test_api "分類頁面" "GET" "/category/test" "" "200" "<!DOCTYPE html>"
echo ""

# 5. 更新檢查
echo "【5. Ajax 更新】"
test_api "更新檢查（無新文章）" "GET" "/api/update?last=0&threads=1" "" "200" "success"
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
