/**
 * Hybrid free-tier unlock rewards for Micro Drama cliffhangers:
 *  - Non-skippable 30-second sponsor ads
 *  - WhatsApp cliffhanger shares
 *
 * Tiered per-series caps prevent viewers from watching short series entirely for free:
 *  - <= 5 episodes:   1 WhatsApp share + 1 single-ad unlock (30s)
 *  - 6–10 episodes:   2 WhatsApp shares + 2 single-ad unlocks (30s each)
 *  - > 10 episodes:   2 WhatsApp shares + 2 single-ad unlocks + 1 extra episode requiring 2 non-skippable 30s ads (60s)
 *
 * Unlocks last 24 hours on this device and dispatch `tubetv:unlocks-updated`
 * so playback gates update immediately without page reload.
 */

export const MAX_DAILY_AD_UNLOCKS = 3;
export const MAX_DAILY_SHARE_UNLOCKS = 2;
export const REWARD_UNLOCK_TTL_MS = 24 * 60 * 60 * 1000;
export const AD_UNLOCK_DURATION_SECONDS = 30;

const STORAGE_KEY = 'tubetv_reward_unlocks_v1';

export interface SeriesUnlockPolicy {
  maxShareUnlocks: number;
  maxSingleAdUnlocks: number;
  maxDoubleAdUnlocks: number;
  totalAdUnlocks: number;
}

export interface SeriesUnlockStatus {
  remainingShares: number;
  remainingAdUnlocks: number;
  /** Number of non-skippable 30s ads required for the next ad-unlocked episode (0 if exhausted). */
  nextAdCost: 0 | 1 | 2;
  policy: SeriesUnlockPolicy;
}

interface StoredUnlockEntry {
  videoId: string;
  seriesKey?: string;
  source: 'ad' | 'share' | 'streak';
  adsWatched?: number;
  rewardToken?: string;
  grantedAt: number;
  expiresAt: number;
}

interface StoredUnlockState {
  entries: StoredUnlockEntry[];
}

export function getSeriesUnlockPolicy(totalSeriesEpisodes?: number): SeriesUnlockPolicy {
  if (typeof totalSeriesEpisodes === 'number' && Number.isFinite(totalSeriesEpisodes) && totalSeriesEpisodes > 0) {
    if (totalSeriesEpisodes <= 5) {
      return {
        maxShareUnlocks: 1,
        maxSingleAdUnlocks: 1,
        maxDoubleAdUnlocks: 0,
        totalAdUnlocks: 1,
      };
    }
    if (totalSeriesEpisodes <= 10) {
      return {
        maxShareUnlocks: 2,
        maxSingleAdUnlocks: 2,
        maxDoubleAdUnlocks: 0,
        totalAdUnlocks: 2,
      };
    }
    return {
      maxShareUnlocks: 2,
      maxSingleAdUnlocks: 2,
      maxDoubleAdUnlocks: 1,
      totalAdUnlocks: 3,
    };
  }
  // Safe default when series count is unknown (treated as 6–10 episode tier)
  return {
    maxShareUnlocks: 2,
    maxSingleAdUnlocks: 2,
    maxDoubleAdUnlocks: 0,
    totalAdUnlocks: 2,
  };
}

function readState(): StoredUnlockState {
  if (typeof window === 'undefined') return { entries: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw) as Partial<StoredUnlockState>;
    const now = Date.now();
    const valid = Array.isArray(parsed.entries)
      ? parsed.entries.filter(
          (entry): entry is StoredUnlockEntry =>
            Boolean(
              entry &&
                typeof entry.videoId === 'string' &&
                typeof entry.expiresAt === 'number' &&
                entry.expiresAt > now,
            ),
        )
      : [];
    return { entries: valid };
  } catch {
    return { entries: [] };
  }
}

function writeState(state: StoredUnlockState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('tubetv:unlocks-updated'));
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

function countGrantedLast24h(
  entries: StoredUnlockEntry[],
  source: 'ad' | 'share',
  seriesKey?: string,
): number {
  const cutoff = Date.now() - REWARD_UNLOCK_TTL_MS;
  return entries.filter((e) => {
    if (e.source !== source || e.grantedAt < cutoff) return false;
    if (seriesKey && e.seriesKey) {
      return e.seriesKey === seriesKey;
    }
    return true;
  }).length;
}

export function getSeriesUnlockStatus(
  seriesKey?: string,
  totalSeriesEpisodes?: number,
): SeriesUnlockStatus {
  const { entries } = readState();
  const policy = getSeriesUnlockPolicy(totalSeriesEpisodes);
  const usedShares = countGrantedLast24h(entries, 'share', seriesKey);
  const usedAds = countGrantedLast24h(entries, 'ad', seriesKey);

  const remainingShares = Math.max(0, policy.maxShareUnlocks - usedShares);
  const remainingAdUnlocks = Math.max(0, policy.totalAdUnlocks - usedAds);

  let nextAdCost: 0 | 1 | 2 = 0;
  if (remainingAdUnlocks > 0) {
    nextAdCost = usedAds < policy.maxSingleAdUnlocks ? 1 : 2;
  }

  return {
    remainingShares,
    remainingAdUnlocks,
    nextAdCost,
    policy,
  };
}

export function getRewardUnlockedVideoIds(): string[] {
  const { entries } = readState();
  return Array.from(new Set(entries.map((e) => e.videoId)));
}

export function getRewardUnlockSource(videoId: string): 'ad' | 'share' | 'streak' | null {
  if (!videoId) return null;
  const { entries } = readState();
  const match = entries.find((e) => e.videoId === videoId);
  return match ? match.source : null;
}

export function getRewardUnlockToken(videoId: string): string | null {
  if (!videoId) return null;
  const { entries } = readState();
  const match = entries.find((e) => e.videoId === videoId && typeof e.rewardToken === 'string' && e.rewardToken.length > 0);
  return match?.rewardToken || null;
}

export function attachRewardUnlockToken(videoId: string, rewardToken: string, expiresAt?: number): void {
  if (!videoId || !rewardToken) return;
  const state = readState();
  let updated = false;
  const nextEntries = state.entries.map((entry) => {
    if (entry.videoId !== videoId) return entry;
    updated = true;
    return {
      ...entry,
      rewardToken,
      ...(typeof expiresAt === 'number' && Number.isFinite(expiresAt) ? { expiresAt } : {}),
    };
  });
  if (updated) {
    writeState({ entries: nextEntries });
  }
}

export function getRemainingAdUnlocksToday(seriesKey?: string, totalSeriesEpisodes?: number): number {
  return getSeriesUnlockStatus(seriesKey, totalSeriesEpisodes).remainingAdUnlocks;
}

export function getRemainingShareUnlocksToday(seriesKey?: string, totalSeriesEpisodes?: number): number {
  return getSeriesUnlockStatus(seriesKey, totalSeriesEpisodes).remainingShares;
}

export function grantAdUnlock(
  videoId: string,
  seriesKey?: string,
  totalSeriesEpisodes?: number,
): {
  unlocked: boolean;
  remainingToday: number;
  adsRequired: number;
  unlockedIds: string[];
} {
  const state = readState();
  const status = getSeriesUnlockStatus(seriesKey, totalSeriesEpisodes);
  if (state.entries.some((e) => e.videoId === videoId)) {
    return {
      unlocked: true,
      remainingToday: status.remainingAdUnlocks,
      adsRequired: status.nextAdCost || 1,
      unlockedIds: Array.from(new Set(state.entries.map((e) => e.videoId))),
    };
  }
  if (status.remainingAdUnlocks <= 0 || status.nextAdCost === 0) {
    return {
      unlocked: false,
      remainingToday: 0,
      adsRequired: 0,
      unlockedIds: Array.from(new Set(state.entries.map((e) => e.videoId))),
    };
  }
  const now = Date.now();
  const nextEntries: StoredUnlockEntry[] = [
    ...state.entries,
    {
      videoId,
      seriesKey,
      source: 'ad',
      adsWatched: status.nextAdCost,
      grantedAt: now,
      expiresAt: now + REWARD_UNLOCK_TTL_MS,
    },
  ];
  writeState({ entries: nextEntries });
  return {
    unlocked: true,
    remainingToday: Math.max(0, status.remainingAdUnlocks - 1),
    adsRequired: status.nextAdCost,
    unlockedIds: Array.from(new Set(nextEntries.map((e) => e.videoId))),
  };
}

export function grantShareUnlock(
  videoId: string,
  seriesKey?: string,
  totalSeriesEpisodes?: number,
): {
  unlocked: boolean;
  remainingToday: number;
  unlockedIds: string[];
} {
  const state = readState();
  const status = getSeriesUnlockStatus(seriesKey, totalSeriesEpisodes);
  if (state.entries.some((e) => e.videoId === videoId)) {
    return {
      unlocked: true,
      remainingToday: status.remainingShares,
      unlockedIds: Array.from(new Set(state.entries.map((e) => e.videoId))),
    };
  }
  if (status.remainingShares <= 0) {
    return {
      unlocked: false,
      remainingToday: 0,
      unlockedIds: Array.from(new Set(state.entries.map((e) => e.videoId))),
    };
  }
  const now = Date.now();
  const nextEntries: StoredUnlockEntry[] = [
    ...state.entries,
    {
      videoId,
      seriesKey,
      source: 'share',
      grantedAt: now,
      expiresAt: now + REWARD_UNLOCK_TTL_MS,
    },
  ];
  writeState({ entries: nextEntries });
  return {
    unlocked: true,
    remainingToday: Math.max(0, status.remainingShares - 1),
    unlockedIds: Array.from(new Set(nextEntries.map((e) => e.videoId))),
  };
}

export function grantBonusUnlock(videoId: string): {
  unlocked: boolean;
  unlockedIds: string[];
} {
  const state = readState();
  if (state.entries.some((e) => e.videoId === videoId)) {
    return {
      unlocked: true,
      unlockedIds: Array.from(new Set(state.entries.map((e) => e.videoId))),
    };
  }
  const now = Date.now();
  const nextEntries: StoredUnlockEntry[] = [
    ...state.entries,
    { videoId, source: 'streak', grantedAt: now, expiresAt: now + REWARD_UNLOCK_TTL_MS },
  ];
  writeState({ entries: nextEntries });
  return {
    unlocked: true,
    unlockedIds: Array.from(new Set(nextEntries.map((e) => e.videoId))),
  };
}
