
const KEY = 'tube_watch_history';
const MAX = 100;

export interface HistoryRecord {
  videoId: string;
  title: string;
  thumbnail: string;
  author: string;
  duration: string;
  category: string;
  watchedAt: number;
  completed: boolean;
}

const load = (): HistoryRecord[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};

const persist = (h: HistoryRecord[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(h)); } catch {}
};

export const recordHistory = (
  video: Pick<HistoryRecord, 'videoId' | 'title' | 'thumbnail' | 'author' | 'duration' | 'category'>,
  completed: boolean,
): void => {
  const rest = load().filter(r => r.videoId !== video.videoId);
  rest.unshift({ ...video, watchedAt: Date.now(), completed });
  persist(rest.slice(0, MAX));
};

export const getHistory = (): HistoryRecord[] => load();

export const clearHistory = (): void => persist([]);

export const removeFromHistory = (videoId: string): void =>
  persist(load().filter(r => r.videoId !== videoId));

/** Top categories by watch count (max 3), for smart recommendations. */
export const getCategoryAffinities = (): string[] => {
  const counts: Record<string, number> = {};
  load().forEach(r => {
    if (r.category) counts[r.category] = (counts[r.category] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);
};

/** Set of all video IDs the user has started or completed. */
export const getWatchedIds = (): Set<string> =>
  new Set(load().map(r => r.videoId));
