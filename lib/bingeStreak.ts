import { grantBonusUnlock } from './unlockRewards';

export interface BingeStreakState {
  currentStreak: number;
  longestStreak: number;
  lastCheckInDate: string | null; // YYYY-MM-DD in local time
  bonusUnlockCredits: number;
}

const STREAK_STORAGE_KEY = 'tubetv_binge_streak_v1';

export function formatLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayKey(now: Date = new Date()): string {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() - 1);
  return formatLocalDateKey(d);
}

const DEFAULT_STATE: BingeStreakState = {
  currentStreak: 0,
  longestStreak: 0,
  lastCheckInDate: null,
  bonusUnlockCredits: 0,
};

export function getBingeStreakState(): BingeStreakState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE };
  try {
    const raw = window.localStorage.getItem(STREAK_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<BingeStreakState>;
    return {
      currentStreak: Number.isFinite(parsed.currentStreak) ? Math.max(0, Number(parsed.currentStreak)) : 0,
      longestStreak: Number.isFinite(parsed.longestStreak) ? Math.max(0, Number(parsed.longestStreak)) : 0,
      lastCheckInDate: typeof parsed.lastCheckInDate === 'string' ? parsed.lastCheckInDate : null,
      bonusUnlockCredits: Number.isFinite(parsed.bonusUnlockCredits)
        ? Math.max(0, Number(parsed.bonusUnlockCredits))
        : 0,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveBingeStreakState(state: BingeStreakState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('tubetv:streak-updated', { detail: state }));
  } catch {
    // Ignore storage errors
  }
}

export function canCheckInToday(now: Date = new Date()): boolean {
  const state = getBingeStreakState();
  return state.lastCheckInDate !== formatLocalDateKey(now);
}

export function claimDailyCheckIn(now: Date = new Date()): {
  claimed: boolean;
  creditsEarned: number;
  state: BingeStreakState;
} {
  const current = getBingeStreakState();
  const today = formatLocalDateKey(now);
  if (current.lastCheckInDate === today) {
    return { claimed: false, creditsEarned: 0, state: current };
  }

  const yesterday = getYesterdayKey(now);
  const nextStreak = current.lastCheckInDate === yesterday ? current.currentStreak + 1 : 1;
  // Milestone bonus: Day 3, Day 7, Day 14... earn +2 free episode credits; regular days earn +1
  const creditsEarned = nextStreak % 7 === 0 || nextStreak === 3 ? 2 : 1;

  const nextState: BingeStreakState = {
    currentStreak: nextStreak,
    longestStreak: Math.max(current.longestStreak, nextStreak),
    lastCheckInDate: today,
    bonusUnlockCredits: current.bonusUnlockCredits + creditsEarned,
  };

  saveBingeStreakState(nextState);
  return { claimed: true, creditsEarned, state: nextState };
}

export function spendBonusCreditToUnlock(videoId: string): {
  unlocked: boolean;
  state: BingeStreakState;
} {
  const current = getBingeStreakState();
  if (!videoId || current.bonusUnlockCredits <= 0) {
    return { unlocked: false, state: current };
  }
  const res = grantBonusUnlock(videoId);
  if (!res.unlocked) {
    return { unlocked: false, state: current };
  }
  const nextState: BingeStreakState = {
    ...current,
    bonusUnlockCredits: Math.max(0, current.bonusUnlockCredits - 1),
  };
  saveBingeStreakState(nextState);
  return { unlocked: true, state: nextState };
}
