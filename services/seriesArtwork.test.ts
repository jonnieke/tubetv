import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadSeriesPoster } from './seriesArtwork';

const mock = vi.hoisted(() => ({
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { storage: { from: () => mock } },
}));

const file = (type: string, size: number) => ({ type, size }) as File;

beforeEach(() => {
  mock.upload.mockReset().mockResolvedValue({ error: null });
  mock.getPublicUrl.mockReset().mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/poster.jpg' } });
});

describe('series poster uploads', () => {
  it('rejects unsafe formats and oversized files before transmission', async () => {
    await expect(uploadSeriesPoster(file('image/svg+xml', 100))).rejects.toThrow('JPG, PNG or WebP');
    await expect(uploadSeriesPoster(file('image/png', 6 * 1024 * 1024))).rejects.toThrow('under 5 MB');
    expect(mock.upload).not.toHaveBeenCalled();
  });
  it('uploads an immutable public image and returns its URL', async () => {
    await expect(uploadSeriesPoster(file('image/webp', 100))).resolves.toBe('https://cdn.example.com/poster.jpg');
    expect(mock.upload).toHaveBeenCalledWith(expect.stringMatching(/\.webp$/), expect.anything(), {
      contentType: 'image/webp', cacheControl: '31536000', upsert: false,
    });
  });
});
