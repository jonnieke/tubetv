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
    expect(schema.thumbnailUrl).toEqual(['https://example.com/thumb.jpg']);
  });

  it('prefers seriesPosterUrl and seriesSynopsis for rich series previews', () => {
    const seriesVideo = {
      ...video,
      seriesTitle: 'The Dead Stay Dumb',
      seriesPosterUrl: 'https://vz-0fe79b1a-8ad.b-cdn.net/11b427fb-7a70-43ed-9f58-028053c8e75d/thumbnail.jpg',
      episodeSynopsis: 'A gritty thriller in Nairobi.',
    };
    const schema = videoStructuredData(seriesVideo);
    expect(schema.name).toBe('The Dead Stay Dumb');
    expect(schema.description).toBe('A gritty thriller in Nairobi.');
    expect(schema.thumbnailUrl).toEqual(['https://vz-0fe79b1a-8ad.b-cdn.net/11b427fb-7a70-43ed-9f58-028053c8e75d/thumbnail.jpg']);
  });
});
