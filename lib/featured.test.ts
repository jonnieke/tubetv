import { describe, expect, it } from 'vitest';
import type { Video } from '../types';
import { featuredMovies, featuredMicroDramas } from './featured';

const movie = (id: string, uploadDate: string, views: number, extra: Partial<Video> = {}): Video => ({
  id, title: id, category: 'Movies', author: 'Studio', thumbnail: '/art.jpg', duration: '90m', views, isPremium: false, uploadDate, ...extra,
});

const micro = (id: string, seriesId: string, episode: number, views: number, extra: Partial<Video> = {}): Video => ({
  id,
  title: `${seriesId} Ep ${episode}`,
  seriesTitle: seriesId,
  seriesId,
  episode,
  season: 1,
  category: 'Micro Dramas',
  seriesFormat: 'micro-drama',
  author: 'Studio',
  thumbnail: `/art-${id}.jpg`,
  duration: '2m 10s',
  views,
  isPremium: false,
  ...extra,
});

describe('micro drama hero spotlight', () => {
  it('selects earliest episode per series and orders by views', () => {
    const videos = [
      micro('roommates-ep2', 'series-roommates', 2, 500000),
      micro('roommates-ep1', 'series-roommates', 1, 1000000),
      micro('secret-ep2', 'series-secret', 2, 200000),
      micro('secret-ep1', 'series-secret', 1, 800000),
      micro('matatu-ep1', 'series-matatu', 1, 600000),
      movie('feature-film', '2026-01-01', 9999999),
    ];

    const featured = featuredMicroDramas(videos, 3);
    expect(featured.map(v => v.id)).toEqual(['roommates-ep1', 'secret-ep1', 'matatu-ep1']);
  });

  it('does not duplicate multiple episodes from the same series in hero banners', () => {
    const videos = [
      micro('roommates-ep3', 'series-roommates', 3, 300000),
      micro('roommates-ep2', 'series-roommates', 2, 400000),
      micro('roommates-ep1', 'series-roommates', 1, 500000),
      micro('matatu-ep1', 'series-matatu', 1, 200000),
    ];

    const featured = featuredMicroDramas(videos, 5);
    const seriesKeys = featured.map(v => v.seriesId);
    expect(new Set(seriesKeys).size).toBe(featured.length);
    expect(featured.find(v => v.seriesId === 'series-roommates')?.episode).toBe(1);
  });

  it('backfills with top content when fewer micro dramas than limit exist', () => {
    const videos = [
      micro('drama-1', 'series-1', 1, 1000),
      movie('film-top', '2026-01-01', 5000),
      movie('film-low', '2026-01-01', 500),
    ];

    const featured = featuredMicroDramas(videos, 3);
    expect(featured.map(v => v.id)).toEqual(['drama-1', 'film-top', 'film-low']);
  });
});

describe('movie spotlight', () => {
  it('uses three recent or edited movies and two high-view movies without duplicates', () => {
    const videos = [
      movie('old-hit', '2025-01-01', 10000), movie('old-hit-2', '2025-01-02', 9000),
      movie('recent-1', '2026-09-28', 10), movie('recent-2', '2026-09-27', 20),
      movie('recent-3', '2026-09-26', 30), movie('old-edited', '2025-01-03', 1, { editorialUpdatedAt: '2026-09-29' }),
      movie('show', '2026-09-30', 99999, { category: 'Series', seriesTitle: 'Show' }),
    ];
    expect(featuredMovies(videos).map(video => video.id)).toEqual(['old-edited', 'recent-1', 'recent-2', 'old-hit', 'old-hit-2']);
  });
  it('does not fabricate slides when fewer than five movies are published', () => {
    expect(featuredMovies([movie('only', '2026-01-01', 0)])).toHaveLength(1);
  });
});
