import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileIOR2 } from '../src/lib/fileio-r2';

describe('FileIOR2 - saveThumbnail', () => {
  let mockR2: any;
  let fileio: FileIOR2;

  beforeEach(() => {
    // 創建模擬 R2 bucket
    mockR2 = {
      put: vi.fn().mockResolvedValue({ success: true }),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue({ success: true }),
      list: vi.fn().mockResolvedValue({ objects: [] }),
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
    const url = fileio.getThumbnailUrl(tim);

    expect(url).toBe(`/thumb/${tim}s.jpg`);
  });
});
