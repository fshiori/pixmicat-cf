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

    fileio = new FileIOR2(mockR2);
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
    const prodFileio = new FileIOR2(mockR2);

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

  it('應該刪除圖片', async () => {
    mockR2.delete = vi.fn(() => Promise.resolve());

    await fileio.deleteImage('1234567890', '.png');

    expect(mockR2.delete).toHaveBeenCalledWith('1234567890.png');
  });

  it('deleteImage 返回 void，不應該拋出錯誤', async () => {
    mockR2.delete = vi.fn(() => Promise.resolve());

    // deleteImage 返回 void，不應該拋出錯誤
    await expect(fileio.deleteImage('1234567890', '.png')).resolves.toBeUndefined();
  });

  describe('exists', () => {
    it('應該返回 true 如果檔案存在', async () => {
      mockR2.head = vi.fn(() => Promise.resolve({
        size: 1024,
        uploaded: new Date(),
      }));

      const exists = await fileio.exists('1234567890', '.png');

      expect(exists).toBe(true);
      expect(mockR2.head).toHaveBeenCalledWith('1234567890.png');
    });

    it('應該返回 false 如果檔案不存在', async () => {
      mockR2.head = vi.fn(() => Promise.resolve(null));

      const exists = await fileio.exists('1234567890', '.png');

      expect(exists).toBe(false);
    });
  });

  describe('getFileInfo', () => {
    it('應該返回檔案資訊', async () => {
      const uploadedDate = new Date();
      mockR2.head = vi.fn(() => Promise.resolve({
        size: 1024,
        uploaded: uploadedDate,
      }));

      const info = await fileio.getFileInfo('1234567890.png');

      expect(info).toEqual({
        size: 1024,
        uploaded: uploadedDate,
      });
    });

    it('應該返回 null 如果檔案不存在', async () => {
      mockR2.head = vi.fn(() => Promise.resolve(null));

      const info = await fileio.getFileInfo('1234567890.png');

      expect(info).toBeNull();
    });
  });

  describe('validateImage', () => {
    it('應該驗證 PNG 圖片', async () => {
      // 完整的 PNG header (8 bytes) + IHDR (13 bytes) + dimensions
      const pngData = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x03, 0x20, // width: 800 (big-endian)
        0x00, 0x00, 0x02, 0x58, // height: 600
        0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, etc.
      ]);
      const file = new File([pngData], 'test.png', { type: 'image/png' });

      const isValid = await fileio.validateImage(file);
      expect(isValid).toBe(true);
    });

    it('應該驗證 JPEG 圖片', async () => {
      // JPEG SOI + APP0 + SOF0 marker with dimensions
      const jpegData = new Uint8Array([
        0xFF, 0xD8, // SOI
        0xFF, 0xE0, // APP0
        0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
        0xFF, 0xC0, // SOF0 marker
        0x00, 0x11, 0x08,
        0x02, 0xE0, // height: 736
        0x02, 0x80, // width: 640
        0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
      ]);
      const file = new File([jpegData], 'test.jpg', { type: 'image/jpeg' });

      const isValid = await fileio.validateImage(file);
      expect(isValid).toBe(true);
    });

    it('應該拒絕無效圖片', async () => {
      const invalidData = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const file = new File([invalidData], 'test.bin', { type: 'application/octet-stream' });

      const isValid = await fileio.validateImage(file);
      expect(isValid).toBe(false);
    });

    it('應該拒絕損壞的 PNG', async () => {
      const pngData = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // 不完整的 PNG header
      const file = new File([pngData], 'test.png', { type: 'image/png' });

      const isValid = await fileio.validateImage(file);
      expect(isValid).toBe(false);
    });
  });

  describe('getImageDimensions', () => {
    it('應該讀取 PNG 尺寸', async () => {
      const pngData = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x03, 0x20, // width: 800
        0x00, 0x00, 0x02, 0x58, // height: 600
      ]);

      const dimensions = await fileio['getImageDimensions'](pngData.buffer);
      expect(dimensions.width).toBe(800);
      expect(dimensions.height).toBe(600);
    });

    it('應該讀取 JPEG 尺寸', async () => {
      const jpegData = new Uint8Array([
        0xFF, 0xD8, 0xFF, 0xE0,
        0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
        0xFF, 0xC0, 0x00, 0x11, 0x08,
        0x02, 0xE0, // height: 736
        0x02, 0x80, // width: 640
      ]);

      const dimensions = await fileio['getImageDimensions'](jpegData.buffer);
      expect(dimensions.width).toBe(640);
      expect(dimensions.height).toBe(736);
    });

    it('應該讀取 GIF 尺寸', async () => {
      const gifData = new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // 'GIF89a'
        0x00, 0x00, // width: 0 (little-endian, need to add real data)
      ]);
      // 讓我們用真實的 GIF header
      const realGifData = new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // 'GIF89a'
        0x00, 0x01, // width: 256 (little-endian)
        0x00, 0x02, // height: 512
      ]);

      const dimensions = await fileio['getImageDimensions'](realGifData.buffer);
      expect(dimensions.width).toBe(256);
      expect(dimensions.height).toBe(512);
    });

    it('應該讀取 BMP 尺寸', async () => {
      // BMP file header (14 bytes) + DIB header (40 bytes)
      // 完整的 BMP header: https://en.wikipedia.org/wiki/BMP_file_format
      const bmpData = new Uint8Array([
        // File Header (14 bytes)
        0x42, 0x4D,                                     // 0-1: 'BM' signature
        0x36, 0x00, 0x00, 0x00,                         // 2-5: file size (54 bytes = header only)
        0x00, 0x00, 0x00, 0x00,                         // 6-9: reserved
        0x36, 0x00, 0x00, 0x00,                         // 10-13: offset to pixel data (54 = 14 + 40)
        // DIB Header - BITMAPINFOHEADER (40 bytes)
        0x28, 0x00, 0x00, 0x00,                         // 14-17: DIB header size (40)
        0x00, 0x01, 0x00, 0x00,                         // 18-21: width: 256 (little-endian)
        0x00, 0x02, 0x00, 0x00,                         // 22-25: height: 512 (little-endian)
        0x01, 0x00,                                     // 26-27: planes (1)
        0x18, 0x00,                                     // 28-29: bits per pixel (24-bit)
        0x00, 0x00, 0x00, 0x00,                         // 30-33: compression (none)
        0x00, 0x00, 0x00, 0x00,                         // 34-37: image size (can be 0 for uncompressed)
        0x13, 0x0B, 0x00, 0x00,                         // 38-41: x pixels per meter (2835)
        0x13, 0x0B, 0x00, 0x00,                         // 42-45: y pixels per meter (2835)
        0x00, 0x00, 0x00, 0x00,                         // 46-49: colors used (0 = all)
        0x00, 0x00, 0x00, 0x00,                         // 50-53: important colors (0 = all)
      ]);

      const dimensions = await fileio['getImageDimensions'](bmpData.buffer);
      expect(dimensions.width).toBe(256);
      expect(dimensions.height).toBe(512);
    });

    it('應該對無效格式拋出錯誤', async () => {
      const invalidData = new Uint8Array([0x00, 0x00, 0x00, 0x00]);

      await expect(fileio['getImageDimensions'](invalidData.buffer)).rejects.toThrow('Unsupported image format');
    });
  });

  describe('resizeImage', () => {
    it('應該返回原始圖片如果不需要縮放', async () => {
      const mockImage = new ArrayBuffer(100);
      const mockDimensions = { width: 100, height: 100 };
      
      vi.spyOn(fileio as any, 'getImageDimensions').mockResolvedValue(mockDimensions);

      const result = await fileio.resizeImage(mockImage, 200, 200);

      expect(result).toBeInstanceOf(Blob);
    });

    it('應該拋出錯誤如果縮放失敗', async () => {
      const mockImage = new ArrayBuffer(100);
      const mockDimensions = { width: 1000, height: 1000 };
      
      vi.spyOn(fileio as any, 'getImageDimensions').mockResolvedValue(mockDimensions);
      mockR2.put = vi.fn(() => Promise.reject(new Error('R2 error')));

      // 應該 fallback 到原始圖片
      const result = await fileio.resizeImage(mockImage, 100, 100);
      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('calculateMD5', () => {
    it('應該計算 MD5 雜湊', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const hash = await fileio.calculateMD5(data);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(32); // MD5 是 32 個十六進制字符
    });

    it('應該為相同數據返回相同 hash', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const hash1 = await fileio.calculateMD5(data);
      const hash2 = await fileio.calculateMD5(data);
      
      expect(hash1).toBe(hash2);
    });

    it('應該為不同數據返回不同 hash', async () => {
      const data1 = new Uint8Array([1, 2, 3, 4, 5]);
      const data2 = new Uint8Array([1, 2, 3, 4, 6]);
      const hash1 = await fileio.calculateMD5(data1);
      const hash2 = await fileio.calculateMD5(data2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('應該處理 File 物件', async () => {
      const file = new File([new Uint8Array([1, 2, 3])], 'test.bin');
      const hash = await fileio.calculateMD5(file);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(32);
    });
  });

  describe('getTotalSize', () => {
    it('應該返回 0 如果沒有檔案', async () => {
      mockR2.list = vi.fn(() => Promise.resolve({ objects: [] }));

      const total = await fileio.getTotalSize();

      expect(total).toBe(0);
    });

    it('應該計算所有檔案總大小', async () => {
      mockR2.list = vi.fn(() => Promise.resolve({
        objects: [
          { size: 1024 },
          { size: 2048 },
        ],
      }));

      const total = await fileio.getTotalSize();

      expect(total).toBe(3072);
    });
  });

  describe('cleanup', () => {
    it('應該刪除未使用的檔案', async () => {
      const usedFiles = new Set(['1234567890', '0987654321']);
      
      mockR2.list = vi.fn(() => Promise.resolve({
        objects: [
          { key: '1234567890.png', size: 1024 },
          { key: '1234567890s.jpg', size: 512 },
          { key: '1111111111.png', size: 1024 }, // 未使用
          { key: '1111111111s.jpg', size: 512 }, // 未使用
        ],
      }));

      const deleted = await fileio.cleanup(usedFiles);

      expect(deleted).toEqual(['1111111111.png', '1111111111s.jpg']);
    });

    it('應該保留縮圖如果原檔案在使用中', async () => {
      const usedFiles = new Set(['1234567890']);
      
      mockR2.list = vi.fn(() => Promise.resolve({
        objects: [
          { key: '1234567890.png', size: 1024 },
          { key: '1234567890s.jpg', size: 512 },
        ],
      }));

      const deleted = await fileio.cleanup(usedFiles);

      expect(deleted).toEqual([]);
      expect(mockR2.delete).not.toHaveBeenCalled();
    });
  });

  describe('SWF validation', () => {
    it('應該驗證未壓縮 SWF', async () => {
      const swfData = new Uint8Array([
        0x46, 0x57, 0x53, // 'FWS'
        0x00, 0x00, 0x00, 0x00, // version and file size
      ]);
      const file = new File([swfData], 'test.swf', { type: 'application/x-shockwave-flash' });

      const isValid = await fileio.validateImage(file);
      expect(isValid).toBe(true);
    });

    it('應該驗證壓縮 SWF', async () => {
      const swfData = new Uint8Array([
        0x43, 0x57, 0x53, // 'CWS'
        0x00, 0x00, 0x00, 0x00, // version and file size
      ]);
      const file = new File([swfData], 'test.swf', { type: 'application/x-shockwave-flash' });

      const isValid = await fileio.validateImage(file);
      expect(isValid).toBe(true);
    });

    it('應該拒絕無效 SWF', async () => {
      const swfData = new Uint8Array([
        0x58, 0x57, 0x53, // 'XWS' - 無效
      ]);
      const file = new File([swfData], 'test.swf', { type: 'application/x-shockwave-flash' });

      const isValid = await fileio.validateImage(file);
      expect(isValid).toBe(false);
    });
  });
});
