import { beforeEach, describe, expect, it } from 'vitest';
import {
  canCheckInToday,
  claimDailyCheckIn,
  getBingeStreakState,
  spendBonusCreditToUnlock,
} from './bingeStreak';
import { getRewardUnlockedVideoIds } from './unlockRewards';

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

describe('Daily Binge Streak & Check-In Rewards', () => {
  beforeEach(() => {
    const storage = createMemoryStorage();
    (globalThis as unknown as { window?: unknown }).window = {
      localStorage: storage,
      dispatchEvent: () => true,
    };
  });

  it('increments streak across consecutive days and awards +2 milestone credits on Day 3', () => {
    const day1 = new Date('2026-11-21T10:00:00');
    const day2 = new Date('2026-11-22T10:00:00');
    const day3 = new Date('2026-11-23T10:00:00');

    expect(canCheckInToday(day1)).toBe(true);
    const r1 = claimDailyCheckIn(day1);
    expect(r1.claimed).toBe(true);
    expect(r1.creditsEarned).toBe(1);
    expect(r1.state.currentStreak).toBe(1);
    expect(canCheckInToday(day1)).toBe(false);

    // Duplicate same-day check-in does not double-award
    expect(claimDailyCheckIn(day1).claimed).toBe(false);

    const r2 = claimDailyCheckIn(day2);
    expect(r2.state.currentStreak).toBe(2);
    expect(r2.creditsEarned).toBe(1);

    // Day 3 milestone grants +2 bonus credits
    const r3 = claimDailyCheckIn(day3);
    expect(r3.state.currentStreak).toBe(3);
    expect(r3.creditsEarned).toBe(2);
    expect(r3.state.bonusUnlockCredits).toBe(4);
  });

  it('spends 1 bonus credit to unlock a cliffhanger episode', () => {
    claimDailyCheckIn(new Date('2026-11-21T10:00:00'));
    expect(getBingeStreakState().bonusUnlockCredits).toBe(1);

    const spent = spendBonusCreditToUnlock('ep-3-cliffhanger');
    expect(spent.unlocked).toBe(true);
    expect(spent.state.bonusUnlockCredits).toBe(0);
    expect(getRewardUnlockedVideoIds()).toContain('ep-3-cliffhanger');
  });
});
