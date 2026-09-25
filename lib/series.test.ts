import { describe, expect, it } from 'vitest';
import { nextEpisode, isMicroDrama, seriesKey } from './series';
import type { Video } from '../types';

const episode = (id: string, season: number, number: number, overrides: Partial<Video> = {}): Video => ({
  id, title: id, category: 'Micro Dramas', seriesTitle: 'A Nairobi Secret', season,
  episode: number, thumbnail: '', views: 0, duration: '2:00', author: 'TubeTV', isPremium: false, ...overrides,
});
describe('serialized drama playback', () => {
  it('orders episodes numerically and crosses seasons without jumping to other shows', () => {
    const videos = [episode('s2', 2, 1), episode('ten', 1, 10), episode('one', 1, 1), episode('two', 1, 2), episode('other', 1, 3, { seriesTitle: 'Other show' })];
    expect(nextEpisode(videos, 'one')?.id).toBe('two');
    expect(nextEpisode(videos, 'two')?.id).toBe('ten');
    expect(nextEpisode(videos, 'ten')?.id).toBe('s2');
    expect(nextEpisode(videos, 's2')).toBeUndefined();
  });
  it('does not loop standalones and separates same-name shows with explicit IDs', () => {
    expect(nextEpisode([episode('film', 1, 1, { seriesTitle: undefined })], 'film')).toBeUndefined();
    expect(seriesKey(episode('a', 1, 1, { seriesId: 'show-a' }))).not.toBe(seriesKey(episode('b', 1, 2, { seriesId: 'show-b' })));
  });
  it('supports legacy title grouping and explicit micro-drama classification', () => {
    expect(seriesKey(episode('a', 1, 1, { seriesTitle: '  A Nairobi Secret ' }))).toBe('a nairobi secret');
    expect(isMicroDrama(episode('a', 1, 1))).toBe(true);
    expect(isMicroDrama(episode('b', 1, 1, { category: 'Series' }))).toBe(false);
  });
});
