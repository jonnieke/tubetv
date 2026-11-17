import { describe, expect, it } from 'vitest';
import { ViewState, type Video } from '../types';
import { filterDiscoveryVideos, getLatestWithMoviesFirst, getTrendingVideos, organizeCatalogByDateAndGenre } from './discovery';

const video = (id: string, title: string, category: string, overrides: Partial<Video> = {}): Video => ({ id, title, category, author: 'TubeTV', thumbnail: '', duration: '5:00', views: 0, isPremium: false, ...overrides });
const library = [video('film', 'Love in Nairobi', 'Movies'), video('lesson', 'Iron deficiency', 'Education', { genre: 'Nutrition' }), video('child', 'Safari Song', 'Kids', { tags: ['Learning'] })];

describe('discovery filtering', () => {
  it('searches the complete catalogue regardless of the previous category chip', () => {
    expect(filterDiscoveryVideos(library, ViewState.HOME, 'Trending', 'Love').map(item => item.id)).toEqual(['film']);
    expect(filterDiscoveryVideos(library, ViewState.EDUCATION, 'CBC', 'Love').map(item => item.id)).toEqual(['film']);
  });
  it('opens category-wide content before optional subcategory filtering', () => {
    expect(filterDiscoveryVideos(library, ViewState.EDUCATION, 'All', '').map(item => item.id)).toEqual(['lesson']);
    expect(filterDiscoveryVideos(library, ViewState.KIDS, 'Learning', '').map(item => item.id)).toEqual(['child']);
    expect(filterDiscoveryVideos(library, ViewState.EDUCATION, 'CBC', '')).toEqual([]);
  });
  it('keeps real movie and series selection while allowing an originals overview', () => {
    const withSeries = [...library, video('series', 'A Story', 'Series')];
    expect(filterDiscoveryVideos(withSeries, ViewState.ORIGINALS, 'All', '').map(item => item.id)).toEqual(['film', 'series']);
    expect(filterDiscoveryVideos(withSeries, ViewState.ORIGINALS, 'Movies', '').map(item => item.id)).toEqual(['film']);
  });
  it('matches title metadata without inventing category content', () => {
    const withSeries = [...library, video('ep', 'Chapter One', 'Series', { seriesTitle: 'A Nairobi Secret' })];
    expect(filterDiscoveryVideos(withSeries, ViewState.HOME, 'Trending', 'nairobi secret').map(item => item.id)).toEqual(['ep']);
    expect(filterDiscoveryVideos(library, ViewState.FARMERS, 'All', '')).toEqual([]);
  });
  it('orders new releases by known upload date', () => {
    const dated = [video('old', 'Earlier', 'Movies', { uploadDate: '2026-01-01' }), video('new', 'Later', 'Movies', { uploadDate: '2026-08-01' })];
    expect(filterDiscoveryVideos(dated, ViewState.HOME, 'New Releases', '').map(item => item.id)).toEqual(['new', 'old']);
  });
  it('shows Most Watched in view order without an arbitrary view threshold', () => {
    const watched = [video('low', 'One view', 'Movies', { views: 1 }), video('high', 'Ten views', 'Movies', { views: 10 })];
    expect(filterDiscoveryVideos(watched, ViewState.HOME, 'Most Watched', '').map(item => item.id)).toEqual(['high', 'low']);
  });
  it('identifies and filters Kids content even when tagged under Micro Dramas or Series', () => {
    const mixed = [
      video('kid-micro', 'The Kingpin Demand', 'Micro Dramas', { tags: ['Kids', 'Animation'], genre: 'Animation' }),
      video('kid-song', 'Wimbo wa Miezi', 'Series', { genre: 'Kids' }),
      video('adult-film', 'Nairobi Night', 'Movies', { genre: 'Action' }),
    ];
    expect(filterDiscoveryVideos(mixed, ViewState.KIDS, 'All', '').map(item => item.id)).toEqual(['kid-micro', 'kid-song']);
    expect(filterDiscoveryVideos(mixed, ViewState.KIDS, 'Cartoons', '').map(item => item.id)).toEqual(['kid-micro']);
  });
  it('filters content by genre under ViewState.GENRES and ViewState.ORIGINALS', () => {
    const collection = [
      video('m1', 'Drama Movie', 'Movies', { genre: 'Drama' }),
      video('m2', 'Action Movie', 'Movies', { genre: 'Action' }),
      video('s1', 'Drama Series', 'Series', { genre: 'Drama' }),
    ];
    expect(filterDiscoveryVideos(collection, ViewState.GENRES, 'Drama', '').map(item => item.id)).toEqual(['m1', 's1']);
    expect(filterDiscoveryVideos(collection, ViewState.ORIGINALS, 'Drama', '').map(item => item.id)).toEqual(['m1', 's1']);
    expect(filterDiscoveryVideos(collection, ViewState.ORIGINALS, 'Action', '').map(item => item.id)).toEqual(['m2']);
  });
  it('orders Latest by platform ingest day descending, with movies first on the same day, excluding shorts', () => {
    const items = [
      video('short1', 'Quick Clip', 'Shorts', { uploadDate: '2026-11-16T10:00:00Z' }),
      video('series-same-day', 'Same Day Show', 'Series', { seriesTitle: 'Show A', uploadDate: '2026-11-14T12:00:00Z' }),
      video('movie-old', 'Older Film', 'Movies', { uploadDate: '2026-10-01T08:00:00Z' }),
      video('movie-same-day', 'Same Day Film', 'Movies', { uploadDate: '2026-11-14T09:00:00Z' }),
      video('series-newest-day', 'Newest Day Show', 'Series', { seriesTitle: 'Show B', uploadDate: '2026-11-15T08:00:00Z' }),
    ];
    expect(getLatestWithMoviesFirst(items).map(v => v.id)).toEqual([
      'series-newest-day',
      'movie-same-day',
      'series-same-day',
      'movie-old',
    ]);
  });
  it('organizes movies, series, and micro dramas by date and genre', () => {
    const movies = [
      video('m1', 'Zulu', 'Movies', { genre: 'Drama, Action', uploadDate: '2026-10-01', views: 50 }),
      video('m2', 'Alpha', 'Movies', { genre: 'Comedy', uploadDate: '2026-11-10', views: 10 }),
      video('m3', 'Beta', 'Movies', { genre: 'Drama', uploadDate: '2026-11-12', views: 20 }),
    ];
    const latestAll = organizeCatalogByDateAndGenre(movies, 'latest', 'All');
    expect(latestAll.filtered.map(v => v.id)).toEqual(['m3', 'm2', 'm1']);
    expect(latestAll.genres).toEqual(['Action', 'Comedy', 'Drama']);

    const dramaViews = organizeCatalogByDateAndGenre(movies, 'views', 'Drama');
    expect(dramaViews.filtered.map(v => v.id)).toEqual(['m1', 'm3']);
  });
  it('differentiates Trending Now from Top 10 by excluding Top 10 and ranking recent momentum', () => {
    const now = Date.parse('2026-11-16T00:00:00Z');
    const top10 = Array.from({ length: 10 }, (_, i) =>
      video(`top${i + 1}`, `Top ${i + 1}`, 'Movies', { views: 1000 - i * 10, uploadDate: '2026-01-01' }),
    );
    const rising = video('rising', 'Rising Hit', 'Movies', { views: 80, uploadDate: '2026-11-15' });
    const older = Array.from({ length: 5 }, (_, i) =>
      video(`old${i + 1}`, `Old ${i + 1}`, 'Movies', { views: 20, uploadDate: '2026-02-01' }),
    );
    const trending = getTrendingVideos([...top10, rising, ...older], 20, now);
    expect(trending[0].id).toBe('rising');
    expect(trending.some(v => v.id === 'top1')).toBe(false);
  });
  it('uses main series thumbnail (seriesPosterUrl or Ep 1) and deduplicates shows in Latest and Trending', () => {
    const items = [
      video('ep1', 'Lekuta Ep 1', 'Micro Dramas', {
        seriesTitle: 'Lekuta',
        season: 1,
        episode: 1,
        thumbnail: 'https://cdn.example.com/ep1.jpg',
        seriesPosterUrl: 'https://cdn.example.com/lekuta-main.jpg',
        uploadDate: '2026-11-10T08:00:00Z',
      }),
      video('ep2', 'Lekuta Ep 2', 'Micro Dramas', {
        seriesTitle: 'Lekuta',
        season: 1,
        episode: 2,
        thumbnail: 'https://cdn.example.com/ep2.jpg',
        uploadDate: '2026-11-17T08:00:00Z',
      }),
    ];
    const latest = getLatestWithMoviesFirst(items);
    expect(latest).toHaveLength(1);
    expect(latest[0].id).toBe('ep2');
    expect(latest[0].thumbnail).toBe('https://cdn.example.com/lekuta-main.jpg');

    const trending = getTrendingVideos(items);
    expect(trending).toHaveLength(1);
    expect(trending[0].thumbnail).toBe('https://cdn.example.com/lekuta-main.jpg');
  });
});
