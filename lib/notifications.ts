
import { Video } from '../types';

export interface TubeNotification {
  id: string;
  type: 'creator_upload' | 'trending' | 'system';
  title: string;
  body: string;
  thumbnail?: string;
  videoId?: string;
  creatorName?: string;
  createdAt: number;
  read: boolean;
}

const KEY = 'tube_notifications';
const SUBS_KEY = 'tube_creator_subscriptions';

const load = (): TubeNotification[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};

const persist = (n: TubeNotification[]): void => {
  try { localStorage.setItem(KEY, JSON.stringify(n)); } catch {}
};

export const getNotifications = (): TubeNotification[] =>
  load().sort((a, b) => b.createdAt - a.createdAt);

export const getUnreadCount = (): number => load().filter(n => !n.read).length;

export const markAllRead = (): void => {
  persist(load().map(n => ({ ...n, read: true })));
};

export const markRead = (id: string): void => {
  persist(load().map(n => n.id === id ? { ...n, read: true } : n));
};

export const clearAll = (): void => persist([]);

/** Merge new notifications in without duplicating existing ids */
const upsert = (incoming: TubeNotification[]): void => {
  const existing = load();
  const existingIds = new Set(existing.map(n => n.id));
  const fresh = incoming.filter(n => !existingIds.has(n.id));
  // keep last 50
  persist([...fresh, ...existing].slice(0, 50));
};

/**
 * Call once when app boots / videos load.
 * Generates unread notifications for:
 *  - top 3 videos from each subscribed creator (creator_upload)
 *  - top 3 trending videos overall (trending)
 */
export const generateNotifications = (videos: Video[]): void => {
  const notifications: TubeNotification[] = [];
  const now = Date.now();

  // Creator upload notifications
  let subs: Record<string, boolean> = {};
  try { subs = JSON.parse(localStorage.getItem(SUBS_KEY) || '{}'); } catch {}
  const followedNames = Object.keys(subs).filter(k => subs[k]);

  followedNames.forEach(creator => {
    const creatorVids = videos
      .filter(v => v.author === creator)
      .sort((a, b) => b.views - a.views)
      .slice(0, 2);

    creatorVids.forEach((v, i) => {
      notifications.push({
        id: `creator_${v.id}`,
        type: 'creator_upload',
        title: creator,
        body: v.title,
        thumbnail: v.thumbnail,
        videoId: v.id,
        creatorName: creator,
        // stagger times so they sort nicely
        createdAt: now - i * 3600_000,
        read: false,
      });
    });
  });

  // Trending notifications — top 3 most-viewed videos
  const trending = [...videos]
    .filter(v => v.author !== 'Tube Creator')
    .sort((a, b) => b.views - a.views)
    .slice(0, 3);

  trending.forEach((v, i) => {
    notifications.push({
      id: `trending_${v.id}`,
      type: 'trending',
      title: '🔥 Trending now',
      body: v.title,
      thumbnail: v.thumbnail,
      videoId: v.id,
      createdAt: now - (followedNames.length * 2 + i) * 3600_000,
      read: false,
    });
  });

  upsert(notifications);
};

/** Relative time label */
export const timeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
