/**
 * Daily free Shorts cap + in-feed sponsor ad cadence for non-subscribers.
 *  - Free viewers get 12 unique Shorts per day (keeps TikTok/WhatsApp discovery frictionless
 *    while preventing unlimited free bandwidth exploitation).
 *  - Every 5th unique free Short triggers an in-feed Sponsor Ad break (when ads are live).
 *  - Active TubeTV Pass holders enjoy unlimited, 100% ad-free Shorts.
 */

export const MAX_DAILY_FREE_SHORTS = 12;
export const SHORTS_AD_INTERVAL = 5;
export const MAX_FREE_SHORT_DURATION_SECONDS = 90;

const STORAGE_KEY = 'tubetv_free_shorts_daily_v1';

interface DailyShortsRecord {
  date: string; // YYYY-MM-DD local date
  videoIds: string[];
}

function getTodayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readDailyRecord(now: Date = new Date()): DailyShortsRecord {
  const today = getTodayKey(now);
  if (typeof window === 'undefined') return { date: today, videoIds: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: today, videoIds: [] };
    const parsed = JSON.parse(raw) as Partial<DailyShortsRecord>;
    if (parsed.date !== today || !Array.isArray(parsed.videoIds)) {
      return { date: today, videoIds: [] };
    }
    const cleanIds = Array.from(
      new Set(parsed.videoIds.filter((id): id is string => typeof id === 'string' && id.length > 0)),
    );
    return { date: today, videoIds: cleanIds };
  } catch {
    return { date: today, videoIds: [] };
  }
}

function writeDailyRecord(record: DailyShortsRecord): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore private-mode storage restrictions
  }
}

export function getFreeShortsStatus(now: Date = new Date()): {
  watchedToday: number;
  remainingToday: number;
  limitReached: boolean;
} {
  const rec = readDailyRecord(now);
  const watchedToday = rec.videoIds.length;
  const remainingToday = Math.max(0, MAX_DAILY_FREE_SHORTS - watchedToday);
  return {
    watchedToday,
    remainingToday,
    limitReached: watchedToday >= MAX_DAILY_FREE_SHORTS,
  };
}

/**
 * Registers a Short view for a non-subscriber.
 * Re-watching an already-counted Short today does not consume another slot.
 */
export function recordFreeShortView(
  shortId: string,
  now: Date = new Date(),
): {
  allowed: boolean;
  watchedToday: number;
  remainingToday: number;
  shouldShowSponsorAd: boolean;
} {
  const rec = readDailyRecord(now);
  if (!shortId) {
    return {
      allowed: rec.videoIds.length < MAX_DAILY_FREE_SHORTS,
      watchedToday: rec.videoIds.length,
      remainingToday: Math.max(0, MAX_DAILY_FREE_SHORTS - rec.videoIds.length),
      shouldShowSponsorAd: false,
    };
  }

  // Already watched today -> allow replay without burning another slot
  if (rec.videoIds.includes(shortId)) {
    return {
      allowed: true,
      watchedToday: rec.videoIds.length,
      remainingToday: Math.max(0, MAX_DAILY_FREE_SHORTS - rec.videoIds.length),
      shouldShowSponsorAd: false,
    };
  }

  if (rec.videoIds.length >= MAX_DAILY_FREE_SHORTS) {
    return {
      allowed: false,
      watchedToday: rec.videoIds.length,
      remainingToday: 0,
      shouldShowSponsorAd: false,
    };
  }

  const nextIds = [...rec.videoIds, shortId];
  writeDailyRecord({ date: rec.date, videoIds: nextIds });
  const watchedToday = nextIds.length;
  return {
    allowed: true,
    watchedToday,
    remainingToday: Math.max(0, MAX_DAILY_FREE_SHORTS - watchedToday),
    shouldShowSponsorAd: watchedToday > 0 && watchedToday % SHORTS_AD_INTERVAL === 0,
  };
}
