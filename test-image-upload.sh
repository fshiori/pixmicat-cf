#!/bin/bash

# Pixmicat 圖片上傳與縮圖功能測試

BASE_URL="https://pixmicat.dcard.dev"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=================================="
echo "Pixmicat 圖片功能測試"
echo "=================================="
echo ""

# 準備測試圖片（1x1 紅色 PNG）
TEST_IMAGE="/tmp/test_upload.png"

# 創建 1x1 紅色 PNG (base64 編碼的 1x1 PNG)
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > "$TEST_IMAGE"

if [ ! -f "$TEST_IMAGE" ]; then
    echo -e "${RED}✗ 無法創建測試圖片${NC}"
    exit 1
fi

echo "測試圖片: $TEST_IMAGE"
file "$TEST_IMAGE"
echo ""

# ==================== 1. 測試圖片上傳 ====================
echo "【1. 測試圖片上傳】"

# 上傳帶圖片的新文章
response=$(curl -s -X POST "$BASE_URL/api/post" \
  -F "hp_website=spammer" \
  -F "hp_url=foo@foo.bar" \
  -F "hp_company=DO NOT FIX THIS" \
  -F "hp_comment=EID OG SMAPS" \
  -F "hp_reply=" \
  -F "bvUFbdrIC=測試圖片" \
  -F "ObHGyhdTR=" \
  -F "SJBgiFbhj=圖片上傳測試" \
  -F "pOBvrtyJK=這是圖片測試" \
  -F "password=" \
  -F "category=general" \
  -F "resto=0" \
  -F "continual_post=1" \
  -F "file=@$TEST_IMAGE" \
  2>&1)

echo "回應: $response" | head -c 500

if echo "$response" | grep -q '"success":true'; then
    POST_NO=$(echo "$response" | grep -o '"no":[0-9]*' | head -1 | cut -d: -f2)
    echo -e "\n${GREEN}✓ 圖片上傳成功${NC}"
    echo "文章編號: $POST_NO"
else
    echo -e "\n${RED}✗ 圖片上傳失敗${NC}"
    if echo "$response" | grep -q "請等待"; then
        echo -e "${YELLOW}⏳ 速率限制，無法測試${NC}"
        # 使用現有文章
        POST_NO=$(curl -s "$BASE_URL/api/threads" | grep -o '"no":[0-9]*' | head -1 | cut -d: -f2)
        echo "使用現有文章: $POST_NO"
    else
        exit 1
    fi
fi

echo ""

# ==================== 2. 檢查圖片 URL ====================
echo "【2. 檢查圖片 URL】"

if [ -n "$POST_NO" ]; then
    # 取得文章詳情
    response=$(curl -s "$BASE_URL/api/thread/$POST_NO")
    echo "$response" | jq '.data.posts[0]' 2>/dev/null || echo "$response" | head -c 500

    # 檢查是否有圖片相關欄位
    has_tim=$(echo "$response" | grep -o '"tim":"[^"]*"' | wc -l)
    has_ext=$(echo "$response" | grep -o '"ext":"[^"]*"' | wc -l)
    has_md5=$(echo "$response" | grep -o '"md5":"[^"]*"' | wc -l)

    echo ""
    echo "圖片欄位檢查:"
    echo "  tim: $has_tim"
    echo "  ext: $has_ext"
    echo "  md5: $has_md5"

    if [ "$has_tim" -gt 0 ] && [ "$has_ext" -gt 0 ]; then
        echo -e "${GREEN}✓ 圖片欄位存在${NC}"

        # 提取圖片資訊
        TIM=$(echo "$response" | grep -o '"tim":"[^"]*"' | head -1 | cut -d: -f2 | tr -d '"')
        EXT=$(echo "$response" | grep -o '"ext":"[^"]*"' | head -1 | cut -d: -f2 | tr -d '"')
        IMG_W=$(echo "$response" | grep -o '"w":[0-9]*' | head -1 | cut -d: -f2)
        IMG_H=$(echo "$response" | grep -o '"h":[0-9]*' | head -1 | cut -d: -f2)

        echo "圖片資訊:"
        echo "  檔名: $TIM$EXT"
        echo "  尺寸: ${IMG_W}x${IMG_H}"

        if [ -n "$TIM" ] && [ -n "$EXT" ]; then
            # ==================== 3. 測試原始圖片 URL ====================
            echo ""
            echo "【3. 測試原始圖片 URL】"

            IMG_URL="$BASE_URL/img/$TIM$EXT"
            echo "圖片 URL: $IMG_URL"

            STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$IMG_URL")
            echo "HTTP 狀態: $STATUS"

            if [ "$STATUS" = "200" ]; then
                echo -e "${GREEN}✓ 原始圖片可訪問${NC}"

                # 下載圖片
                curl -s "$IMG_URL" -o /tmp/downloaded_image.png
                if [ -f "/tmp/downloaded_image.png" ]; then
                    SIZE=$(wc -c < /tmp/downloaded_image.png)
                    echo "下載大小: $SIZE bytes"
                    echo -e "${GREEN}✓ 圖片下載成功${NC}"
                fi
            else
                echo -e "${RED}✗ 圖片不可訪問${NC}"
            fi

            # ==================== 4. 測試縮圖 URL ====================
            echo ""
            echo "【4. 測試縮圖 URL】"

            # Cloudflare Image Resizing 格式
            THUMB_URL="$BASE_URL/cdn-cgi/image/width=100,height=100,quality=75,format=auto,fit=cover/img/$TIM$EXT"
            echo "縮圖 URL: $THUMB_URL"

            STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$THUMB_URL")
            echo "HTTP 狀態: $STATUS"

            if [ "$STATUS" = "200" ]; then
                echo -e "${GREEN}✓ 縮圖可訪問${NC}"

                # 下載縮圖
                curl -s "$THUMB_URL" -o /tmp/downloaded_thumb.jpg
                if [ -f "/tmp/downloaded_thumb.jpg" ]; then
                    SIZE=$(wc -c < /tmp/downloaded_thumb.jpg)
                    echo "下載大小: $SIZE bytes"
                    echo -e "${GREEN}✓ 縮圖下載成功${NC}"
                fi
            else
                echo -e "${YELLOW}⚠ 縮圖不可訪問（可能需要配置 Cloudflare Image Resizing）${NC}"
            fi

            # ==================== 5. 測試不同尺寸的縮圖 ====================
            echo ""
            echo "【5. 測試不同尺寸縮圖】"

            SIZES=("200x200" "150x150" "80x80")
            for SIZE in "${SIZES[@]}"; do
                WIDTH=$(echo $SIZE | cut -dx -f1)
                HEIGHT=$(echo $SIZE | cut -dx -f2)

                THUMB_URL="$BASE_URL/cdn-cgi/image/width=${WIDTH},height=${HEIGHT},quality=75,format=auto,fit=cover/img/$TIM$EXT"
                STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$THUMB_URL")

                if [ "$STATUS" = "200" ]; then
                    echo -e "  ${GREEN}✓${NC} ${SIZE} - HTTP $STATUS"
                else
                    echo -e "  ${RED}✗${NC} ${SIZE} - HTTP $STATUS"
                fi
            done

        fi
    else
        echo -e "${YELLOW}⚠ 文章沒有圖片${NC}"
    fi
fi

echo ""
echo "=================================="
echo "測試完成"
echo "=================================="

# 清理
rm -f /tmp/test_upload.png /tmp/downloaded_image.png /tmp/downloaded_thumb.jpg
