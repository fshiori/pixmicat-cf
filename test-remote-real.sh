#!/bin/bash

# Pixmicat Cloudflare Workers - 遠端真實功能測試
# 只測試實際存在的 API 端點

BASE_URL="https://pixmicat.dcard.dev"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

RED='\033[0;31m'
GREEN='\033[0;32m'
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
            echo -e "${GREEN}✓ 通過${NC} (HTTP $http_code)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        fi
    fi

    echo -e "${RED}✗ 失敗${NC}"
    echo "  期待 HTTP $expected_code，實際 $http_code"
    if [ -n "$check_contains" ]; then
        echo "  期待包含: $check_contains"
    fi
    echo "  回應: $body" | head -c 200
    echo ""
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
}

echo "=================================="
echo "Pixmicat 遠端真實功能測試"
echo "=================================="
echo ""

# 1. 基礎頁面
echo "【1. 基礎頁面載入】"
test_api "首頁" "GET" "/" "" "200" "<!DOCTYPE html>"
test_api "管理後台" "GET" "/admin" "" "200" "<!DOCTYPE html>"
echo ""

# 2. 文章相關 API
echo "【2. 文章 API】"
test_api "文章列表" "GET" "/api/threads" "" "200" "success"
test_api "單一討論串" "GET" "/api/thread/1" "" "200" "success"
echo ""

# 3. 討論串頁面
echo "【3. 討論串頁面】"
test_api "討論串頁面" "GET" "/res/1.htm" "" "200" "<!DOCTYPE html>"
echo ""

# 4. 搜尋和分類
echo "【4. 搜尋與分類】"
test_api "搜尋 API" "GET" "/api/search?q=test" "" "200" "success"
test_api "分類 API" "GET" "/api/category/general" "" "200" "success"
test_api "分類頁面" "GET" "/category/general" "" "200" "<!DOCTYPE html>"
echo ""

# 5. RSS
echo "【5. RSS 功能】"
test_api "RSS (xml)" "GET" "/rss.xml" "" "200" "<"
test_api "RSS (api)" "GET" "/api/rss" "" "200" "success"
echo ""

# 6. 更新檢查（需要有效的討論串編號）
echo "【6. Ajax 更新】"
test_api "更新檢查" "GET" "/api/update?thread=1&time=0" "" "200" "success"
echo ""

# 7. 圖片相關（跳過，因為需要實際圖片）
echo "【7. 圖片功能】"
echo "  ⊘ 跳過圖片測試（需要實際圖片文件）"
echo ""

# 8. 管理功能
echo "【8. 管理功能】"
echo "  ⊘ 跳過管理員登入測試（需要正確密碼）"
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
    echo ""
    echo "結論："
    echo "  ✓ 基礎頁面載入正常"
    echo "  ✓ API 端點正常運作"
    echo "  ✓ 討論串功能正常"
    echo "  ✓ 搜尋和分類功能正常"
    echo "  ✓ RSS 功能正常"
    echo "  ✓ Ajax 更新功能正常"
    echo ""
    echo "注意：管理員功能需要實際密碼才能完整測試"
    exit 0
else
    echo -e "${RED}✗ 有 $FAILED_TESTS 個測試失敗${NC}"
    exit 1
fi
