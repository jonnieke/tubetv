import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_DAILY_FREE_SHORTS,
  SHORTS_AD_INTERVAL,
  getFreeShortsStatus,
  recordFreeShortView,
} from './shortsLimit';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
}

describe('shortsLimit (Daily Free Shorts Cap & In-Feed Sponsor Ad Cadence)', () => {
  beforeEach(() => {
    (globalThis as unknown as { window?: unknown }).window = {
      localStorage: createMemoryStorage(),
    };
  });

  it('allows up to 12 unique free Shorts per day and blocks the 13th', () => {
    const adTriggers: number[] = [];
    for (let i = 1; i <= MAX_DAILY_FREE_SHORTS; i++) {
      const res = recordFreeShortView(`short-${i}`);
      expect(res.allowed).toBe(true);
      expect(res.watchedToday).toBe(i);
      if (res.shouldShowSponsorAd) adTriggers.push(i);
    }

    // Ad breaks trigger on 5th and 10th unique Short
    expect(adTriggers).toEqual([SHORTS_AD_INTERVAL, SHORTS_AD_INTERVAL * 2]);

    // Replaying an already-watched Short is still allowed
    expect(recordFreeShortView('short-1').allowed).toBe(true);

    // 13th new Short is blocked -> prompts KSh 10 Daily Pass
    const blocked = recordFreeShortView('short-13');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remainingToday).toBe(0);
    expect(getFreeShortsStatus().limitReached).toBe(true);
  });
});
