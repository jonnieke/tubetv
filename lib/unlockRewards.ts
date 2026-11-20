/**
 * Hybrid free-tier unlock rewards for Micro Drama cliffhangers:
 *  - Watch a 15s sponsor ad to unlock 1 episode (capped at 2 per 24h)
 *  - Share a cliffhanger on WhatsApp to unlock 1 episode (capped at 2 per 24h)
 *
 * Unlocks last 24 hours on this device and dispatch `tubetv:unlocks-updated`
 * so playback gates update immediately without page reload.
 */

export const MAX_DAILY_AD_UNLOCKS = 2;
export const MAX_DAILY_SHARE_UNLOCKS = 2;
export const REWARD_UNLOCK_TTL_MS = 24 * 60 * 60 * 1000;
export const AD_UNLOCK_DURATION_SECONDS = 15;

const STORAGE_KEY = 'tubetv_reward_unlocks_v1';

interface StoredUnlockEntry {
  videoId: string;
  source: 'ad' | 'share' | 'streak';
  grantedAt: number;
  expiresAt: number;
}

interface StoredUnlockState {
  entries: StoredUnlockEntry[];
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
            Boolean(entry && typeof entry.videoId === 'string' && typeof entry.expiresAt === 'number' && entry.expiresAt > now),
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

function countGrantedLast24h(entries: StoredUnlockEntry[], source: 'ad' | 'share'): number {
  const cutoff = Date.now() - REWARD_UNLOCK_TTL_MS;
  return entries.filter((e) => e.source === source && e.grantedAt >= cutoff).length;
}

export function getRewardUnlockedVideoIds(): string[] {
  const { entries } = readState();
  return Array.from(new Set(entries.map((e) => e.videoId)));
}

export function getRemainingAdUnlocksToday(): number {
  const { entries } = readState();
  return Math.max(0, MAX_DAILY_AD_UNLOCKS - countGrantedLast24h(entries, 'ad'));
}

export function getRemainingShareUnlocksToday(): number {
  const { entries } = readState();
  return Math.max(0, MAX_DAILY_SHARE_UNLOCKS - countGrantedLast24h(entries, 'share'));
}

export function grantAdUnlock(videoId: string): {
  unlocked: boolean;
  remainingToday: number;
  unlockedIds: string[];
} {
  const state = readState();
  if (state.entries.some((e) => e.videoId === videoId)) {
    return {
      unlocked: true,
      remainingToday: Math.max(0, MAX_DAILY_AD_UNLOCKS - countGrantedLast24h(state.entries, 'ad')),
      unlockedIds: Array.from(new Set(state.entries.map((e) => e.videoId))),
    };
  }
  const used = countGrantedLast24h(state.entries, 'ad');
  if (used >= MAX_DAILY_AD_UNLOCKS) {
    return {
      unlocked: false,
      remainingToday: 0,
      unlockedIds: Array.from(new Set(state.entries.map((e) => e.videoId))),
    };
  }
  const now = Date.now();
  const nextEntries: StoredUnlockEntry[] = [
    ...state.entries,
    { videoId, source: 'ad', grantedAt: now, expiresAt: now + REWARD_UNLOCK_TTL_MS },
  ];
  writeState({ entries: nextEntries });
  return {
    unlocked: true,
    remainingToday: Math.max(0, MAX_DAILY_AD_UNLOCKS - (used + 1)),
    unlockedIds: Array.from(new Set(nextEntries.map((e) => e.videoId))),
  };
}

export function grantShareUnlock(videoId: string): {
  unlocked: boolean;
  remainingToday: number;
  unlockedIds: string[];
} {
  const state = readState();
  if (state.entries.some((e) => e.videoId === videoId)) {
    return {
      unlocked: true,
      remainingToday: Math.max(0, MAX_DAILY_SHARE_UNLOCKS - countGrantedLast24h(state.entries, 'share')),
      unlockedIds: Array.from(new Set(state.entries.map((e) => e.videoId))),
    };
  }
  const used = countGrantedLast24h(state.entries, 'share');
  if (used >= MAX_DAILY_SHARE_UNLOCKS) {
    return {
      unlocked: false,
      remainingToday: 0,
      unlockedIds: Array.from(new Set(state.entries.map((e) => e.videoId))),
    };
  }
  const now = Date.now();
  const nextEntries: StoredUnlockEntry[] = [
    ...state.entries,
    { videoId, source: 'share', grantedAt: now, expiresAt: now + REWARD_UNLOCK_TTL_MS },
  ];
  writeState({ entries: nextEntries });
  return {
    unlocked: true,
    remainingToday: Math.max(0, MAX_DAILY_SHARE_UNLOCKS - (used + 1)),
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
