import { describe, expect, it } from 'vitest';
import type { Video } from '../types';
import { featuredMovies } from './featured';

const movie = (id: string, uploadDate: string, views: number, extra: Partial<Video> = {}): Video => ({
  id, title: id, category: 'Movies', author: 'Studio', thumbnail: '/art.jpg', duration: '90m', views, isPremium: false, uploadDate, ...extra,
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
