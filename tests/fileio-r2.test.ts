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
    const url = fileio.getThumbnailUrl(tim);

    expect(url).toBe(`/thumb/${tim}s.jpg`);
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

  it('should attempt CF Image Resizing in production environment', async () => {
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

    // Mock fetch 成功
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['resized']),
    } as any);

    const largeImage = new ArrayBuffer(1000);
    await prodFileio.resizeImage(largeImage, 250, 250);

    // 應該嘗試使用 CF Image Resizing
    expect(mockR2.put).toHaveBeenCalled();
  });
});
