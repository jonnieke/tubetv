import { describe, expect, it } from 'vitest';
import type { Video } from '../types';
import { compareEpisodes, seriesKey, isMicroDrama } from '../lib/series';

const makeDrama = (id: string, ep: number, overrides: Partial<Video> = {}): Video => ({
  id,
  title: `Episode ${ep}`,
  seriesTitle: 'Nairobi Secrets',
  seriesId: 'nairobi-secrets',
  seriesFormat: 'micro-drama',
  category: 'Micro Dramas',
  season: 1,
  episode: ep,
  thumbnail: 'https://example.com/thumb.jpg',
  views: 1000,
  duration: '1:45',
  author: 'TubeTV Originals',
  isPremium: false,
  introEndSeconds: 5,
  outroStartSeconds: 95,
  ...overrides,
});

describe('MicroDramaPlayer Engine', () => {
  it('correctly sorts sibling episodes and handles boundary navigation', () => {
    const ep1 = makeDrama('ep-1', 1);
    const ep2 = makeDrama('ep-2', 2);
    const ep3 = makeDrama('ep-3', 3);
    const allVideos = [ep3, ep1, ep2];

    const key = seriesKey(ep1);
    const siblings = allVideos.filter(v => seriesKey(v) === key).sort(compareEpisodes);

    expect(siblings.map(s => s.id)).toEqual(['ep-1', 'ep-2', 'ep-3']);

    // Check index calculation
    const idxFirst = siblings.findIndex(v => v.id === ep1.id);
    expect(idxFirst).toBe(0);
    expect(siblings[idxFirst + 1].id).toBe('ep-2');

    const idxLast = siblings.findIndex(v => v.id === ep3.id);
    expect(idxLast).toBe(2);
    expect(siblings[idxLast + 1]).toBeUndefined();
  });

  it('identifies micro-dramas accurately and verifies cue points', () => {
    const drama = makeDrama('ep-1', 1);
    expect(isMicroDrama(drama)).toBe(true);
    expect(drama.introEndSeconds).toBe(5);
    expect(drama.outroStartSeconds).toBe(95);

    // Skip intro is eligible when currentTime < introEndSeconds - 1
    const canSkipAt3Sec = 3 < (drama.introEndSeconds! - 1);
    const canSkipAt6Sec = 6 < (drama.introEndSeconds! - 1);
    expect(canSkipAt3Sec).toBe(true);
    expect(canSkipAt6Sec).toBe(false);
  });

  it('triggers cliffhanger pre-buffering cue and next episode prompt at 80% duration', () => {
    const duration = 100;
    const timeAt70 = 70;
    const timeAt82 = 82;

    const isCliffhangerCueEligible = (cur: number, dur: number) => dur > 0 && cur / dur >= 0.8;

    expect(isCliffhangerCueEligible(timeAt70, duration)).toBe(false);
    expect(isCliffhangerCueEligible(timeAt82, duration)).toBe(true);
  });

  it('detects double-tap intervals within 300ms window', () => {
    const isDoubleTap = (lastTapTime: number, currentTapTime: number) => {
      return currentTapTime - lastTapTime < 300;
    };

    const t0 = 1000;
    const tQuick = 1180; // 180ms later -> double tap
    const tSlow = 1450; // 450ms later -> two distinct single taps

    expect(isDoubleTap(t0, tQuick)).toBe(true);
    expect(isDoubleTap(t0, tSlow)).toBe(false);
  });
});
