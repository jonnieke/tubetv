import { describe, expect, it } from 'vitest';
import { videoPath, videoStructuredData } from './seo';

describe('video discovery metadata', () => {
  const video = {
    id: 'a video',
    title: 'Nairobi Story',
    thumbnail: 'https://example.com/thumb.jpg',
    views: 2,
    duration: '1:00',
    isPremium: false,
    author: 'TubeTV',
    category: 'Originals',
    contentRating: 'PG' as const,
  };

  it('creates a stable encoded watch path', () => {
    expect(videoPath(video.id)).toBe('/watch/a%20video');
  });

  it('emits VideoObject structured data', () => {
    const schema = videoStructuredData(video);
    expect(schema['@type']).toBe('VideoObject');
    expect(schema.isFamilyFriendly).toBe(true);
  });

  it('emits TVEpisode structured data for micro-dramas', () => {
    const drama = {
      ...video,
      category: 'Micro Dramas',
      seriesFormat: 'micro-drama' as const,
      seriesTitle: 'Nairobi Secrets',
      episode: 3,
      season: 1,
    };
    const schema = videoStructuredData(drama);
    expect(schema['@type']).toBe('TVEpisode');
    expect((schema as any).episodeNumber).toBe(3);
    expect((schema as any).partOfSeries?.name).toBe('Nairobi Secrets');
  });
});
