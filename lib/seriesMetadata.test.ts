import { afterEach, describe, expect, it, vi } from 'vitest';
import { bunnyVideoToVideo, type BunnyVideoItem } from '../services/bunnyService';

afterEach(() => vi.unstubAllGlobals());
describe('published series metadata', () => {
  it('maps shared and episodic synopses while ignoring unsaved admin drafts', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ episode: { title: 'Unsaved title', seriesSynopsis: 'Unsaved synopsis' } }) });
    const item = {
      guid: 'episode', title: 'Published title', length: 120, metaTags: [
        { property: 'category', value: 'Micro Dramas' },
        { property: 'seriesId', value: 'series-1' },
        { property: 'seriesTitle', value: 'Published series' },
        { property: 'seriesSynopsis', value: 'Shared story premise' },
        { property: 'episodeSynopsis', value: 'This episode only' },
        { property: 'season', value: '1' }, { property: 'episode', value: '2' },
      ],
    } as BunnyVideoItem;
    expect(bunnyVideoToVideo(item)).toMatchObject({ title: 'Published title', seriesId: 'series-1', seriesFormat: 'micro-drama', seriesSynopsis: 'Shared story premise', episodeSynopsis: 'This episode only', season: 1, episode: 2 });
  });
  it('keeps old descriptions as episode summaries for existing series', () => {
    expect(bunnyVideoToVideo({ guid: 'old', title: 'Legacy', metaTags: [{ property: 'description', value: 'Legacy description' }] } as BunnyVideoItem).episodeSynopsis).toBe('Legacy description');
  });
});
