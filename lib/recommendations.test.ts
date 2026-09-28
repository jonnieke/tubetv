import { describe, expect, it } from 'vitest';
import type { Video } from '../types';
import { recommendVideos } from './recommendations';

const video = (id: string, overrides: Partial<Video> = {}): Video => ({
  id, title: id, category: 'Movies', author: 'TubeTV', thumbnail: '', duration: '5:00', views: 0, isPremium: false, ...overrides,
});
const progress = (completed: boolean) => ({ positionSeconds: 60, durationSeconds: 120, completed });

describe('viewer recommendations', () => {
  it('resumes unfinished videos and advances a completed micro drama to the next episode', () => {
    const library = [
      video('ep1', { seriesId: 'story', seriesFormat: 'micro-drama', episode: 1 }),
      video('ep2', { seriesId: 'story', seriesFormat: 'micro-drama', episode: 2 }),
      video('film'),
    ];
    const result = recommendVideos(library, { ep1: progress(true), film: progress(false) }, []);
    expect(result.continueWatching.map(item => item.id)).toEqual(['ep2', 'film']);
    expect(result.forYou.map(item => item.id)).not.toContain('ep1');
  });

  it('uses watch-list and viewing interests without resurfacing saved or watched titles', () => {
    const library = [
      video('saved', { genre: 'Drama', tags: ['Nairobi'] }),
      video('match', { genre: 'Drama', tags: ['Nairobi'] }),
      video('less-close', { genre: 'Comedy' }),
    ];
    expect(recommendVideos(library, {}, ['saved']).forYou.map(item => item.id)).toEqual(['match', 'less-close']);
    expect(recommendVideos(library, { saved: progress(true) }, []).forYou.map(item => item.id)).toEqual(['match', 'less-close']);
  });

  it('keeps cold-start carousels separate and never includes unpublished catalogue items', () => {
    const library = [video('visible'), video('another')];
    expect(recommendVideos(library, {}, []).forYou).toEqual([]);
    expect(recommendVideos(library, { hidden: progress(false) }, ['hidden']).forYou).toEqual([]);
  });

  it('shows a series only once in discovery', () => {
    const library = [video('saved', { category: 'Series' }), video('one', { category: 'Series', seriesId: 'new', episode: 1 }), video('two', { category: 'Series', seriesId: 'new', episode: 2 })];
    expect(recommendVideos(library, {}, ['saved']).forYou.map(item => item.id)).toEqual(['one']);
  });
});
