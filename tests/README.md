# 測試指南

本專案使用 **Vitest** 進行單元測試和 E2E 測試。

## 測試結構

```
tests/
├── setup.ts                    # 測試環境設定
├── types.ts                    # 測試類型定義
├── utils.ts                    # 測試輔助函數
├── anti-spam.test.ts          # AntiSpamSystem 單元測試
├── admin.test.ts              # AdminSystem 單元測試
├── field-trap.test.ts         # FieldTrap 單元測試
├── pio-d1.test.ts             # PIOD1 單元測試
├── fileio-r2.test.ts          # FileIOR2 單元測試
├── utils.test.ts              # 工具函數單元測試
├── api.test.ts                # API 測試
├── integration.test.ts        # 整合測試
├── e2e-post.test.ts           # E2E 測試 - 發文流程
└── e2e-admin.test.ts          # E2E 測試 - 管理功能
```

## 安裝依賴

```bash
npm install --save-dev vitest happy-dom
```

## 運行測試

### 運行所有測試

```bash
npm test
```

### 運行特定測試文件

```bash
npm test -- tests/anti-spam.test.ts
```

### 運行特定測試套件

```bash
npm test -- -t "AntiSpamSystem"
```

### 監看模式

```bash
npm test -- --watch
```

### 生成覆蓋率報告

```bash
npm test -- --coverage
```

覆蓋率報告會生成在 `coverage/` 目錄：
- `coverage/index.html` - HTML 報告
- `coverage/coverage-final.json` - JSON 報告

## 測試類型

### 1. 單元測試

測試個別函數和類別的功能：

- **anti-spam.test.ts** - 反垃圾系統
  - 配置管理
  - 限制文字檢查
  - 檔案 MD5 檢查
  - IP 模式封鎖
  - DNSBL 檢查

- **admin.test.ts** - 管理系統
  - 密碼驗證
  - Session 管理
  - Cap 驗證
  - IP 封鎖

- **field-trap.test.ts** - Field Trap
  - 隨機欄位名稱生成
  - Honeypot 驗證
  - Bot 檢測

### 2. E2E 測試

測試完整的使用者流程：

- **e2e-post.test.ts** - 發文流程
  - 創建新討論串
  - 回應討論串
  - Tripcode 生成
  - 內文處理
  - 檔案上傳
  - 錯誤處理

- **e2e-admin.test.ts** - 管理功能
  - 管理員登入
  - Session 驗證
  - IP 封鎖管理
  - 反垃圾設定
  - 文章管理
  - 配置管理

## 測試原則

### 1. 隔離性

每個測試應該獨立運行，不依賴其他測試：

```typescript
beforeEach(() => {
  // 重置模擬環境
  mockEnv = createMockEnv();
});
```

### 2. 可重複性

測試應該每次運行都得到相同結果：

```typescript
it('應該返回一致的結果', () => {
  const result1 = generateFieldTrapNames();
  const result2 = generateFieldTrapNames();

  expect(result1.name).not.toBe(result2.name); // 隨機性
});
```

### 3. 清晰的命名

測試名稱應該清楚描述測試的行為：

```typescript
it('應該檢測 spam 關鍵字', () => { });
it('應該拒絕填充 honeypot 的 bot', () => { });
```

### 4. 測試覆蓋

每個功能都應該有：
- ✅ 正常情況測試
- ✅ 錯誤情況測試
- ✅ 邊界情況測試

## Mock 策略

### Cloudflare Workers API

使用 `vi.fn()` 模擬：

```typescript
mockEnv = {
  DB: {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(() => Promise.resolve(mockData)),
        run: vi.fn(() => Promise.resolve({ meta: {} })),
      })),
    })),
  },
  KV: {
    get: vi.fn(() => Promise.resolve('value')),
    put: vi.fn(),
  },
};
```

### Request/Response

使用標準 Web API：

```typescript
const mockRequest = {
  headers: {
    get: vi.fn((header) => {
      if (header === 'CF-Connecting-IP') return '192.168.1.1';
      return null;
    }),
  },
} as any;
```

## CI/CD 整合

### GitHub Actions

```yaml
- name: Run tests
  run: npm test

- name: Generate coverage
  run: npm test -- --coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/coverage-final.json
```

## 調試測試

### 使用 console.log

```typescript
it('調試測試', () => {
  const result = someFunction();
  console.log('Result:', result); // 會顯示在測試輸出中
  expect(result).toBe(true);
});
```

### 只運行一個測試

```typescript
it.only('只運行這個測試', () => {
  // ...
});
```

### 跳過測試

```typescript
it.skip('暫時跳過這個測試', () => {
  // ...
});
```

## 測試覆蓋率目標

- **語句覆蓋率**: > 80%
- **分支覆蓋率**: > 75%
- **函數覆蓋率**: > 80%
- **行覆蓋率**: > 80%

## 常見問題

### Q: 測試失敗並顯示 "Cannot find module"

**A:** 確保已安裝所有依賴：

```bash
npm install
```

### Q: 模擬的函數沒有被調用

**A:** 確保正確設置 mock：

```typescript
(mockEnv.DB.prepare as any).mockReturnValue({
  bind: vi.fn(() => ({ /* ... */ })),
});
```

### Q: 測試超時

**A:** 增加測試超時時間：

```typescript
it('慢速測試', { timeout: 10000 }, async () => {
  // ...
});
```

## 貢獻測試

添加新功能時，請同時添加：

1. **單元測試** - 測試個別函數
2. **E2E 測試** - 測試完整流程
3. **邊界情況** - 測試錯誤處理

範例：

```typescript
describe('新功能', () => {
  it('應該正常工作', () => { });
  it('應該處理錯誤', () => { });
  it('應該處理邊界情況', () => { });
});
```
