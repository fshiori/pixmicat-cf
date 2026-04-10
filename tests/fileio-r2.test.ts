import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileIOR2 } from '../src/lib/fileio-r2';

describe('FileIOR2 - saveThumbnail', () => {
  let mockR2: any;
  let mockEnv: any;
  let fileio: FileIOR2;

  beforeEach(() => {
    // 創建模擬 R2 bucket
    mockR2 = {
      put: vi.fn().mockResolvedValue({ success: true }),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue({ success: true }),
      list: vi.fn().mockResolvedValue({ objects: [] }),
    };

    // 創建模擬 Env
    mockEnv = {
      ENVIRONMENT: 'local',
      CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
    };

    fileio = new FileIOR2(mockR2, mockEnv);
  });

  it('should save thumbnail with correct key format', async () => {
    const tim = '1234567890';
    const thumbnailData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG header

    await fileio.saveThumbnail(thumbnailData as any, tim);

    expect(mockR2.put).toHaveBeenCalledWith(
      `${tim}s.jpg`,
      thumbnailData
    );
  });

  it('should save thumbnail with Blob', async () => {
    const tim = '1234567890';
    const blob = new Blob(['test data'], { type: 'image/jpeg' });

    await fileio.saveThumbnail(blob as any, tim);

    expect(mockR2.put).toHaveBeenCalledWith(
      `${tim}s.jpg`,
      blob
    );
  });

  it('should generate correct thumbnail URL', () => {
    const tim = '1234567890';
    const ext = '.jpg';
    const url = fileio.getThumbnailUrl(tim, ext);

    expect(url).toBe('/cdn-cgi/image/width=250,height=250,quality=75,format=auto,fit=cover/img/1234567890.jpg');
  });

  it('should use original image in local environment when resize needed', async () => {
    // 創建一個大於縮圖尺寸的模擬圖片
    const largeImage = new ArrayBuffer(1000);
    const maxWidth = 250;
    const maxHeight = 250;

    // Mock getImageDimensions 返回大尺寸
    vi.spyOn(fileio as any, 'getImageDimensions').mockResolvedValue({
      width: 1920,
      height: 1080,
    });

    const result = await fileio.resizeImage(largeImage, maxWidth, maxHeight);

    // 在本地環境中應該返回原圖
    expect(result).toBeInstanceOf(Blob);
    expect(mockR2.put).not.toHaveBeenCalled(); // 不應該嘗試使用 CF Image Resizing
  });

  it('should not attempt CF Image Resizing in production environment (using URL transformation)', async () => {
    // 創建生產環境的 fileio
    const prodEnv = {
      ENVIRONMENT: 'production',
      CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
      DB: {} as any,
      STORAGE: mockR2,
      KV: {} as any,
    };
    const prodFileio = new FileIOR2(mockR2, prodEnv);

    // Mock getImageDimensions 返回大尺寸
    vi.spyOn(prodFileio as any, 'getImageDimensions').mockResolvedValue({
      width: 1920,
      height: 1080,
    });

    const largeImage = new ArrayBuffer(1000);
    const result = await prodFileio.resizeImage(largeImage, 250, 250);

    // 現在使用 URL 轉換方式，不需要預處理
    expect(result).toBeInstanceOf(Blob);
    expect(mockR2.put).not.toHaveBeenCalled(); // 不應該再調用 put
    
    // 檢查 getThumbnailUrl 返回 CF Image Resizing URL
    const thumbUrl = prodFileio.getThumbnailUrl('123', '.jpg', 250, 250);
    expect(thumbUrl).toContain('/cdn-cgi/image/');
  });
});
