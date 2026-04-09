# 測試指南

## 測試框架

本專案使用 **Vitest** 作為測試框架，搭配 **happy-dom** 模擬瀏覽器環境。

## 安裝依賴

```bash
npm install
```

## 執行測試

### 執行所有測試（監聽模式）

```bash
npm test
```

### 執行所有測試（單次）

```bash
npm run test:run
```

### 執行測試並生成覆蓋率報告

```bash
npm run test:coverage
```

覆蓋率報告會生成在 `coverage/` 目錄中。

## 測試結構

```
tests/
├── setup.ts           # 測試環境設定
├── types.ts           # 測試類型定義
├── utils.ts           # 測試工具函數
├── pio-d1.test.ts     # PIO D1 測試
├── fileio-r2.test.ts  # FileIO R2 測試
├── utils.test.ts      # 工具函數測試
├── api.test.ts        # API 路由測試
└── integration.test.ts # 整合測試
```

## 測試覆蓋範圍

### ✅ 已測試功能

- **PIOD1**
  - 準備資料庫
  - 取得文章
  - 取得討論串
  - 創建文章
  - 刪除文章
  - 取得討論串列表

- **FileIOR2**
  - 初始化
  - 取得圖片
  - 刪除圖片
  - 驗證圖片格式
  - 讀取圖片尺寸
  - 計算 MD5 雜湊

- **工具函數**
  - HTML 轉義
  - 自動連結 URL
  - 引用系統
  - 格式化檔案大小
  - 格式化日期
  - 生成 Tripcode
  - Sage 檢測

- **API 路由**
  - 取得討論串列表
  - 創建文章
  - 刪除文章
  - 搜尋文章
  - RSS 輸出
  - 圖片路由
  - 管理員路由

- **整合測試**
  - 完整發文流程
  - 完整上傳圖片流程
  - 完整搜尋流程
  - 完整管理流程
  - 完整 RSS 流程
  - Spam 防護
  - 分類瀏覽
  - 分頁功能

## 撰寫新測試

### 1. 單元測試範例

```typescript
import { describe, it, expect } from 'vitest';

describe('MyFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

### 2. 整合測試範例

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockEnv } from './utils';

describe('Integration Test', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = createMockEnv();
  });

  it('should complete a workflow', async () => {
    // 測試完整流程
  });
});
```

## 測試目標

- **單元測試覆蓋率**: 目標 > 80%
- **整合測試**: 覆蓋主要使用者流程
- **效能測試**: 確保關鍵操作 < 100ms

## 持續整合

測試會在 CI/CD 流程中自動執行：

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm run test:run
```

## 常見問題

### Q: 測試失敗怎麼辦？

A: 檢查測試日誌，確認是哪個測試失敗。如果是環境問題，嘗試重新安裝依賴：

```bash
rm -rf node_modules package-lock.json
npm install
```

### Q: 如何模擬 Cloudflare Workers 環境？

A: 使用 `tests/setup.ts` 中定義的模擬環境，或使用 `createMockEnv()` 工具函數。

### Q: 如何測試非同步函數？

A: 使用 `async/await`：

```typescript
it('should handle async', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

## 資源

- [Vitest 文件](https://vitest.dev/)
- [Cloudflare Workers 測試指南](https://developers.cloudflare.com/workers/testing/)
- [happy-dom 文件](https://github.com/capricorn86/happy-dom)
