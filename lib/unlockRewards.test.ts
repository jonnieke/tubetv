import { beforeEach, describe, expect, it } from 'vitest';
import {
  AD_UNLOCK_DURATION_SECONDS,
  getRemainingAdUnlocksToday,
  getRemainingShareUnlocksToday,
  getRewardUnlockedVideoIds,
  getSeriesUnlockPolicy,
  getSeriesUnlockStatus,
  grantAdUnlock,
  grantShareUnlock,
} from './unlockRewards';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('unlockRewards (30s Non-Skippable Ads & Tiered Series Caps)', () => {
  beforeEach(() => {
    const storage = createMemoryStorage();
    (globalThis as unknown as { window?: unknown }).window = {
      localStorage: storage,
      dispatchEvent: () => true,
    };
  });

  it('uses 30-second non-skippable ad duration', () => {
    expect(AD_UNLOCK_DURATION_SECONDS).toBe(30);
  });

  it('enforces 1 share + 1 ad cap for series with 5 episodes or fewer', () => {
    const policy = getSeriesUnlockPolicy(5);
    expect(policy.maxShareUnlocks).toBe(1);
    expect(policy.totalAdUnlocks).toBe(1);

    expect(grantShareUnlock('short-ep3', 'short-show', 5).unlocked).toBe(true);
    expect(grantShareUnlock('short-ep4', 'short-show', 5).unlocked).toBe(false);

    expect(grantAdUnlock('short-ep4', 'short-show', 5).unlocked).toBe(true);
    expect(grantAdUnlock('short-ep5', 'short-show', 5).unlocked).toBe(false);
  });

  it('enforces 2 shares + 2 single ads for 6–10 episode series', () => {
    const policy = getSeriesUnlockPolicy(8);
    expect(policy.maxShareUnlocks).toBe(2);
    expect(policy.totalAdUnlocks).toBe(2);
    expect(policy.maxDoubleAdUnlocks).toBe(0);

    expect(getRemainingAdUnlocksToday('mid-show', 8)).toBe(2);
    expect(getRemainingShareUnlocksToday('mid-show', 8)).toBe(2);
  });

  it('allows 2 shares + 2 single ads + 1 extra double-ad (2x30s) unlock for >10 episode series', () => {
    const series = 'big-show';
    expect(getSeriesUnlockStatus(series, 20).nextAdCost).toBe(1);
    expect(grantAdUnlock('ep-3', series, 20).adsRequired).toBe(1);

    expect(getSeriesUnlockStatus(series, 20).nextAdCost).toBe(1);
    expect(grantAdUnlock('ep-4', series, 20).adsRequired).toBe(1);

    // 3rd ad-unlocked episode requires 2 consecutive 30s non-skippable ads
    expect(getSeriesUnlockStatus(series, 20).nextAdCost).toBe(2);
    const third = grantAdUnlock('ep-5', series, 20);
    expect(third.unlocked).toBe(true);
    expect(third.adsRequired).toBe(2);
    expect(third.remainingToday).toBe(0);

    // 4th ad unlock is blocked -> must buy Pass
    expect(grantAdUnlock('ep-6', series, 20).unlocked).toBe(false);
    expect(getRewardUnlockedVideoIds()).toContain('ep-5');
  });
});
