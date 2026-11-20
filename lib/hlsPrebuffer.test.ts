import { describe, expect, it } from 'vitest';
import { extractFirstVariantUrl, extractWarmSegmentUrls } from './hlsPrebuffer';

describe('hlsPrebuffer', () => {
  it('extracts the first variant playlist URL relative to the master playlist', () => {
    const master = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=480x854',
      '480p/video.m3u8?token=abc',
      '#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=720x1280',
      '720p/video.m3u8?token=abc',
    ].join('\n');

    expect(extractFirstVariantUrl(master, 'https://cdn.example.com/vid-1/playlist.m3u8')).toBe(
      'https://cdn.example.com/vid-1/480p/video.m3u8?token=abc',
    );
  });

  it('extracts EXT-X-MAP init segment and only the first media segment to save mobile data', () => {
    const media = [
      '#EXTM3U',
      '#EXT-X-TARGETDURATION:4',
      '#EXT-X-MAP:URI="init.mp4"',
      '#EXTINF:4.0,',
      'seg0.m4s',
      '#EXTINF:4.0,',
      'seg1.m4s',
    ].join('\n');

    expect(extractWarmSegmentUrls(media, 'https://cdn.example.com/vid-1/480p/video.m3u8')).toEqual([
      'https://cdn.example.com/vid-1/480p/init.mp4',
      'https://cdn.example.com/vid-1/480p/seg0.m4s',
    ]);
  });
});
