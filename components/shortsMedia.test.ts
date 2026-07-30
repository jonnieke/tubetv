import { describe, expect, it } from 'vitest';
import { MOCK_SHORTS } from '../constants';

describe('Shorts media contract', () => {
  it('keeps thumbnails and playable sources separate', () => {
    for (const short of MOCK_SHORTS) {
      expect(short.thumbnail).toMatch(/^https:\/\//);
      expect(short.thumbnail).not.toMatch(/\.(mp4|m3u8)(\?|$)/i);
      expect(short.videoUrl).toMatch(/^https:\/\//);
      expect(short.videoUrl).toMatch(/\.(mp4|m3u8)(\?|$)/i);
    }
  });

  it('labels demo engagement honestly', () => {
    for (const short of MOCK_SHORTS) {
      expect(short.likes).toBe(0);
      expect(short.comments).toBe(0);
    }
  });
});
