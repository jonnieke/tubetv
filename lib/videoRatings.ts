
const KEY = 'tube_video_ratings';

export type Rating = 'like' | 'dislike' | null;
type RatingsMap = Record<string, 'like' | 'dislike'>;

const load = (): RatingsMap => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
};

const persist = (m: RatingsMap) => {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch {}
};

export const getRating = (videoId: string): Rating =>
  load()[videoId] ?? null;

/** Toggle: same rating again = remove. Returns the new rating. */
export const toggleRating = (videoId: string, rating: 'like' | 'dislike'): Rating => {
  const m = load();
  if (m[videoId] === rating) {
    delete m[videoId];
    persist(m);
    return null;
  }
  m[videoId] = rating;
  persist(m);
  return rating;
};

export const getLikedIds = (): string[] =>
  Object.entries(load()).filter(([, r]) => r === 'like').map(([id]) => id);
