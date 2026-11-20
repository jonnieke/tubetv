import { describe, expect, it } from 'vitest';
import { buildForYouFeedItems } from './ForYouFeed';
import type { Video } from '../types';

const base: Video = {
  id: 'v-1',
  title: 'Episode 1',
  thumbnail: 'thumb.jpg',
  views: 100,
  duration: '1m 30s',
  isPremium: true,
  author: 'Studio KE',
  category: 'Micro Dramas',
  seriesFormat: 'micro-drama',
};

describe('ForYouFeed series hook builder', () => {
  it('groups episodes by series, selects Episode 1 as opener, and sorts by total views', () => {
    const videos: Video[] = [
      { ...base, id: 'a-ep2', seriesId: 's-a', seriesTitle: 'Kilimani Secret', episode: 2, views: 500 },
      { ...base, id: 'a-ep1', seriesId: 's-a', seriesTitle: 'Kilimani Secret', episode: 1, views: 400 },
      { ...base, id: 'b-ep1', seriesId: 's-b', seriesTitle: 'Nairobi Heir', episode: 1, views: 1200 },
      { ...base, id: 'b-ep2', seriesId: 's-b', seriesTitle: 'Nairobi Heir', episode: 2, views: 800 },
      { ...base, id: 'movie-1', category: 'Movies', seriesFormat: 'standard', seriesTitle: undefined, episode: undefined, views: 9999 },
    ];

    const hooks = buildForYouFeedItems(videos);
    expect(hooks).toHaveLength(2);
    expect(hooks[0].opener.id).toBe('b-ep1');
    expect(hooks[0].episodeCount).toBe(2);
    expect(hooks[0].totalViews).toBe(2000);
    expect(hooks[1].opener.id).toBe('a-ep1');
    expect(hooks[1].episodeCount).toBe(2);
    expect(hooks[1].totalViews).toBe(900);
  });
});
