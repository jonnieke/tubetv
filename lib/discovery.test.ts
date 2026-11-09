import { describe, expect, it } from 'vitest';
import { ViewState, type Video } from '../types';
import { filterDiscoveryVideos } from './discovery';

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
});
