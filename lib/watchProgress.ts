const KEY = 'tube_watch_progress';
const MAX_ENTRIES = 50;

export interface WatchRecord {
  videoId: string;
  position: number;  // seconds watched
  duration: number;  // total seconds
  percent: number;   // 0–100
  watchedAt: number; // Date.now()
}

type ProgressMap = Record<string, WatchRecord>;

const load = (): ProgressMap => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
};

const persist = (map: ProgressMap) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch { }
};

export const getProgress = (videoId: string): WatchRecord | null =>
  load()[videoId] ?? null;

export const saveProgress = (videoId: string, position: number, duration: number): void => {
  if (!duration || duration < 1) return;
  const percent = Math.round((position / duration) * 100);
  // Don't save if < 2% (accidental scrub) or > 95% (completed)
  if (percent < 2 || percent > 95) return;

  const map = load();
  map[videoId] = { videoId, position, duration, percent, watchedAt: Date.now() };

  // Trim to MAX_ENTRIES (keep most recently watched)
  const entries = Object.values(map).sort((a, b) => b.watchedAt - a.watchedAt);
  const trimmed: ProgressMap = {};
  entries.slice(0, MAX_ENTRIES).forEach(e => { trimmed[e.videoId] = e; });
  persist(trimmed);
};

/** All in-progress records (5% – 95%), sorted newest first. */
export const getAllProgress = (): WatchRecord[] =>
  Object.values(load())
    .filter(r => r.percent >= 5 && r.percent <= 95)
    .sort((a, b) => b.watchedAt - a.watchedAt);

export const clearProgress = (videoId: string): void => {
  const map = load();
  delete map[videoId];
  persist(map);
};
