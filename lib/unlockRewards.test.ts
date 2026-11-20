import { beforeEach, describe, expect, it } from 'vitest';
import {
  getRemainingAdUnlocksToday,
  getRemainingShareUnlocksToday,
  getRewardUnlockedVideoIds,
  grantAdUnlock,
  grantShareUnlock,
  MAX_DAILY_AD_UNLOCKS,
  MAX_DAILY_SHARE_UNLOCKS,
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

describe('unlockRewards (Ad & WhatsApp Share unlocks)', () => {
  beforeEach(() => {
    const storage = createMemoryStorage();
    (globalThis as unknown as { window?: unknown }).window = {
      localStorage: storage,
      dispatchEvent: () => true,
    };
  });

  it('grants ad unlocks up to the daily cap and tracks unlocked video IDs', () => {
    expect(getRemainingAdUnlocksToday()).toBe(MAX_DAILY_AD_UNLOCKS);

    const first = grantAdUnlock('ep-3');
    expect(first.unlocked).toBe(true);
    expect(first.remainingToday).toBe(MAX_DAILY_AD_UNLOCKS - 1);
    expect(getRewardUnlockedVideoIds()).toContain('ep-3');

    const second = grantAdUnlock('ep-4');
    expect(second.unlocked).toBe(true);
    expect(second.remainingToday).toBe(0);

    const third = grantAdUnlock('ep-5');
    expect(third.unlocked).toBe(false);
    expect(third.remainingToday).toBe(0);
    expect(getRewardUnlockedVideoIds()).not.toContain('ep-5');
  });

  it('grants WhatsApp share unlocks independently of ad unlocks', () => {
    expect(getRemainingShareUnlocksToday()).toBe(MAX_DAILY_SHARE_UNLOCKS);

    const shared = grantShareUnlock('ep-6');
    expect(shared.unlocked).toBe(true);
    expect(shared.remainingToday).toBe(MAX_DAILY_SHARE_UNLOCKS - 1);
    expect(getRewardUnlockedVideoIds()).toContain('ep-6');
  });
});
