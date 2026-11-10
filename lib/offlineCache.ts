import { Video } from '../types';
import { getStoredPass, resolveAuthorizedPlaybackUrl } from './subscriptions';
import { isVideoLocked } from './monetization';

const OFFLINE_CACHE_NAME = 'tubetv-offline-media-v1';
const OFFLINE_META_KEY = 'tubetv_offline_videos_v1';

export interface OfflineSavedVideo {
  videoId: string;
  title: string;
  seriesTitle?: string;
  episode?: number;
  thumbnail: string;
  cachedAt: number;
  expiresAt: number;
  requiresPass: boolean;
  estimatedSizeMb: number;
}

export function getOfflineSavedVideos(): Record<string, OfflineSavedVideo> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(OFFLINE_META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, OfflineSavedVideo>;
    const now = Date.now();
    const pass = getStoredPass();
    const valid: Record<string, OfflineSavedVideo> = {};

    for (const [id, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry.expiresAt !== 'number' || entry.expiresAt <= now) {
        continue;
      }
      // If episode requires an active pass, ensure pass is still valid on this device
      if (entry.requiresPass && (!pass || pass.expiresAt <= now)) {
        continue;
      }
      valid[id] = entry;
    }
    return valid;
  } catch {
    return {};
  }
}

export function isVideoSavedOffline(videoId: string): boolean {
  const all = getOfflineSavedVideos();
  return Boolean(all[videoId]);
}

function persistOfflineIndex(records: Record<string, OfflineSavedVideo>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OFFLINE_META_KEY, JSON.stringify(records));
    window.dispatchEvent(new CustomEvent('tubetv:offline-updated', { detail: records }));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Caches a video's thumbnail, manifest (.m3u8), and initial media segments into CacheStorage
 * for low-data/offline commute viewing. Premium episodes require an active TubeTV pass and
 * automatically expire when the pass expires.
 */
export async function saveVideoForOfflineCommute(video: Video): Promise<OfflineSavedVideo> {
  if (typeof window === 'undefined') {
    throw new Error('Offline caching is only available in browser environments.');
  }

  const requiresPass = isVideoLocked(video, false);
  const storedPass = getStoredPass();
  if (requiresPass && (!storedPass || storedPass.expiresAt <= Date.now())) {
    throw new Error('An active TubeTV Pass is required to save premium episodes offline.');
  }

  const auth = await resolveAuthorizedPlaybackUrl(video.id, video.url, requiresPass);
  if (auth.locked || !auth.url) {
    throw new Error('Could not authorize this episode for offline caching.');
  }

  const urlsToCache: string[] = [];
  if (video.thumbnail) urlsToCache.push(video.thumbnail);
  urlsToCache.push(auth.url);

  if ('caches' in window) {
    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      await Promise.allSettled(
        urlsToCache.map(async (targetUrl) => {
          const response = await fetch(targetUrl, { mode: 'cors', credentials: 'omit' });
          if (response.ok) {
            await cache.put(targetUrl, response.clone());
            // If HLS master playlist, also warm the first variant playlist
            if (/\.m3u8(\?|$)/i.test(targetUrl)) {
              const text = await response.text();
              const lines = text
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l && !l.startsWith('#'));
              const firstVariant = lines[0];
              if (firstVariant) {
                const variantUrl = new URL(firstVariant, targetUrl).toString();
                const varRes = await fetch(variantUrl, { mode: 'cors', credentials: 'omit' });
                if (varRes.ok) {
                  await cache.put(variantUrl, varRes.clone());
                }
              }
            }
          }
        }),
      );
    } catch {
      // Best-effort CacheStorage pre-warming
    }
  }

  const expiresAt = requiresPass && storedPass
    ? storedPass.expiresAt
    : Date.now() + 7 * 24 * 3600 * 1000;

  const entry: OfflineSavedVideo = {
    videoId: video.id,
    title: video.title,
    seriesTitle: video.seriesTitle,
    episode: video.episode,
    thumbnail: video.thumbnail,
    cachedAt: Date.now(),
    expiresAt,
    requiresPass,
    estimatedSizeMb: video.seriesFormat === 'micro-drama' ? 4.2 : 14.5,
  };

  const current = getOfflineSavedVideos();
  current[video.id] = entry;
  persistOfflineIndex(current);
  return entry;
}

export async function removeOfflineVideo(videoId: string): Promise<void> {
  const current = getOfflineSavedVideos();
  delete current[videoId];
  persistOfflineIndex(current);
}

export async function clearAllOfflineVideos(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(OFFLINE_META_KEY);
    if ('caches' in window) {
      await caches.delete(OFFLINE_CACHE_NAME);
    }
    window.dispatchEvent(new CustomEvent('tubetv:offline-updated', { detail: {} }));
  } catch {
    // Ignore errors
  }
}
