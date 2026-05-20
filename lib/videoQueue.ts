
const KEY = 'tube_video_queue';

export interface QueueItem {
  id: string;
  title: string;
  thumbnail?: string;
  author: string;
  duration: string;
}

const load = (): QueueItem[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};

const persist = (q: QueueItem[]): void => {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch {}
};

export const getQueue = (): QueueItem[] => load();
export const getQueueLength = (): number => load().length;
export const isInQueue = (id: string): boolean => load().some(q => q.id === id);

export const addToQueue = (item: QueueItem): void => {
  const q = load().filter(i => i.id !== item.id);
  persist([...q, item]);
  window.dispatchEvent(new Event('tube-queue-changed'));
};

export const removeFromQueue = (id: string): void => {
  persist(load().filter(i => i.id !== id));
  window.dispatchEvent(new Event('tube-queue-changed'));
};

/** Remove and return the first item */
export const shiftQueue = (): QueueItem | null => {
  const q = load();
  if (!q.length) return null;
  const [next, ...rest] = q;
  persist(rest);
  window.dispatchEvent(new Event('tube-queue-changed'));
  return next;
};

export const clearQueue = (): void => {
  persist([]);
  window.dispatchEvent(new Event('tube-queue-changed'));
};

export const moveUp = (id: string): void => {
  const q = load();
  const idx = q.findIndex(i => i.id === id);
  if (idx <= 0) return;
  [q[idx - 1], q[idx]] = [q[idx], q[idx - 1]];
  persist(q);
  window.dispatchEvent(new Event('tube-queue-changed'));
};

export const moveDown = (id: string): void => {
  const q = load();
  const idx = q.findIndex(i => i.id === id);
  if (idx < 0 || idx >= q.length - 1) return;
  [q[idx], q[idx + 1]] = [q[idx + 1], q[idx]];
  persist(q);
  window.dispatchEvent(new Event('tube-queue-changed'));
};
