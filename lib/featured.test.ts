import { describe, expect, it } from 'vitest';
import type { Video } from '../types';
import { featuredMovies, featuredMicroDramas, featuredLongFormat } from './featured';

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

  it('pins admin-featured shows first and reserves spotlight slots for brand-new 0-view launches', () => {
    const videos = [
      micro('hit-1', 'series-hit-1', 1, 90000, { uploadDate: '2026-01-01' }),
      micro('hit-2', 'series-hit-2', 1, 80000, { uploadDate: '2026-01-02' }),
      micro('hit-3', 'series-hit-3', 1, 70000, { uploadDate: '2026-01-03' }),
      micro('hit-4', 'series-hit-4', 1, 60000, { uploadDate: '2026-01-04' }),
      micro('hit-5', 'series-hit-5', 1, 50000, { uploadDate: '2026-01-05' }),
      micro('new-launch', 'series-new-launch', 1, 0, { uploadDate: '2026-11-25' }),
      micro('pinned-ep2', 'series-pinned', 2, 10, { uploadDate: '2026-02-01', featured: true }),
      micro('pinned-ep1', 'series-pinned', 1, 5, { uploadDate: '2026-02-01' }),
    ];

    const featured = featuredMicroDramas(videos, 5);
    expect(featured[0]?.id).toBe('pinned-ep1');
    expect(featured.map((v) => v.id)).toContain('new-launch');
    expect(featured).toHaveLength(5);
  });

  it('deduplicates series and honors pinned items in featuredLongFormat', () => {
    const videos = [
      movie('film-1', '2026-01-01', 5000),
      movie('series-ep1', '2026-02-01', 4000, { category: 'Series', seriesTitle: 'Nairobi Heat', episode: 1 }),
      movie('series-ep2', '2026-02-02', 4500, { category: 'Series', seriesTitle: 'Nairobi Heat', episode: 2 }),
      movie('pinned-film', '2026-01-15', 10, { featured: true }),
    ];
    const hero = featuredLongFormat(videos, 4);
    expect(hero[0]?.id).toBe('pinned-film');
    expect(hero.filter((v) => v.seriesTitle === 'Nairobi Heat')).toHaveLength(1);
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
