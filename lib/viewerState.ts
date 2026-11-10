import { supabase, isSupabaseConfigured } from './supabase';
import { isLocalAuthUserId } from './localAuth';
import { getStoredPass } from './subscriptions';

export interface PlaybackPreferences {
  autoplay: boolean;
  captions: boolean;
  quality: 'auto' | '1080p' | '720p' | '480p' | '360p';
  dataSaver: boolean;
  maximumRating: 'GE' | 'PG' | '16';
}

export interface WatchProgress {
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
}

export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
  autoplay: true,
  captions: false,
  quality: 'auto',
  dataSaver: false,
  maximumRating: '16',
};

const preferenceKey = (userId?: string) => `tube_preferences_${userId || 'guest'}`;
const watchListKey = (userId?: string) => `tube_watch_later_${userId || 'guest'}`;
const progressKey = (userId?: string) => `tube_watch_progress_${userId || 'guest'}`;

function readLocal<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local persistence is best-effort when storage is unavailable.
  }
}

export function clearViewerLocalData(userId?: string) {
  try {
    if (typeof localStorage === 'undefined') return;
    const keysToRemove = [
      preferenceKey(userId),
      watchListKey(userId),
      progressKey(userId),
      'tube_watch_later',
    ];
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // Best-effort cleanup
  }
}

export async function loadPreferences(userId?: string): Promise<PlaybackPreferences> {
  const local = readLocal(preferenceKey(userId), DEFAULT_PLAYBACK_PREFERENCES);
  const normalizedLocal: PlaybackPreferences = {
    ...DEFAULT_PLAYBACK_PREFERENCES,
    ...local,
    maximumRating: ['GE', 'PG', '16'].includes(local?.maximumRating) ? local.maximumRating : '16',
  };
  if (!userId || isLocalAuthUserId(userId) || !isSupabaseConfigured) return normalizedLocal;
  try {
    const { data } = await supabase.from('viewer_preferences').select('*').eq('user_id', userId).maybeSingle();
    if (!data) return normalizedLocal;
    const preferences: PlaybackPreferences = {
      autoplay: Boolean(data.autoplay),
      captions: Boolean(data.captions),
      quality: data.quality || 'auto',
      dataSaver: Boolean(data.data_saver),
      maximumRating: ['GE', 'PG', '16'].includes(data.maximum_rating) ? data.maximum_rating : '16',
    };
    writeLocal(preferenceKey(userId), preferences);
    return preferences;
  } catch {
    return normalizedLocal;
  }
}

export async function savePreferences(userId: string | undefined, preferences: PlaybackPreferences) {
  writeLocal(preferenceKey(userId), preferences);
  if (!userId || isLocalAuthUserId(userId) || !isSupabaseConfigured) return;
  try {
    const { error } = await supabase.from('viewer_preferences').upsert({
      maximum_rating: preferences.maximumRating,
      user_id: userId,
      autoplay: preferences.autoplay,
      captions: preferences.captions,
      quality: preferences.quality,
      data_saver: preferences.dataSaver,
    });
    if (error) console.warn('Could not sync preferences:', error.message);
  } catch {
    // Keep local preference if network fails
  }
}

export async function loadWatchList(userId?: string): Promise<string[]> {
  const legacy = readLocal<string[]>('tube_watch_later', []);
  const local = readLocal<string[]>(watchListKey(userId), legacy);
  if (!userId || isLocalAuthUserId(userId) || !isSupabaseConfigured) return local;
  try {
    const { data, error } = await supabase.from('watch_later').select('video_id').eq('user_id', userId);
    if (error || !data) return local;
    const remote = data.map((row) => row.video_id);
    const merged = Array.from(new Set([...local, ...remote]));
    writeLocal(watchListKey(userId), merged);
    if (merged.length > remote.length) {
      await supabase.from('watch_later').upsert(merged.map((videoId) => ({ user_id: userId, video_id: videoId })));
    }
    return merged;
  } catch {
    return local;
  }
}

let passSyncTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePassCloudSync(lastWatchedVideoId?: string) {
  if (!isSupabaseConfigured || typeof window === 'undefined') return;
  const pass = getStoredPass();
  if (!pass?.token) return;

  if (passSyncTimer) clearTimeout(passSyncTimer);
  passSyncTimer = setTimeout(() => {
    const progress = readLocal<Record<string, WatchProgress>>(progressKey(undefined), {});
    const watchLater = readLocal<string[]>(watchListKey(undefined), []);
    void supabase.functions
      .invoke('mpesa-stk-push', {
        body: {
          action: 'sync_state',
          passToken: pass.token,
          progress,
          watchLater,
          lastWatchedVideoId,
        },
        headers: { 'X-Pass-Token': pass.token },
      })
      .catch(() => {});
  }, 1500);
}

export async function setWatchLater(userId: string | undefined, videoId: string, saved: boolean) {
  const current = readLocal<string[]>(watchListKey(userId), []);
  const next = saved ? Array.from(new Set([...current, videoId])) : current.filter((id) => id !== videoId);
  writeLocal(watchListKey(userId), next);
  if (!userId || isLocalAuthUserId(userId)) {
    schedulePassCloudSync();
    return;
  }
  if (!isSupabaseConfigured) return;
  try {
    const query = supabase.from('watch_later');
    const { error } = saved
      ? await query.upsert({ user_id: userId, video_id: videoId })
      : await query.delete().eq('user_id', userId).eq('video_id', videoId);
    if (error) console.warn('Could not sync watch list:', error.message);
  } catch {
    // Keep local state if offline
  }
}

export async function loadProgress(userId?: string): Promise<Record<string, WatchProgress>> {
  const local = readLocal<Record<string, WatchProgress>>(progressKey(userId), {});
  if (!userId || isLocalAuthUserId(userId) || !isSupabaseConfigured) return local;
  try {
    const { data, error } = await supabase
      .from('watch_progress')
      .select('video_id, position_seconds, duration_seconds, completed')
      .eq('user_id', userId);
    if (error || !data) return local;
    const remote = Object.fromEntries(
      data.map((row) => [
        row.video_id,
        {
          positionSeconds: Number(row.position_seconds),
          durationSeconds: Number(row.duration_seconds),
          completed: Boolean(row.completed),
        },
      ]),
    );
    const merged = { ...local, ...remote };
    writeLocal(progressKey(userId), merged);
    return merged;
  } catch {
    return local;
  }
}

export async function saveProgress(
  userId: string | undefined,
  videoId: string,
  progress: WatchProgress,
) {
  const current = readLocal<Record<string, WatchProgress>>(progressKey(userId), {});
  writeLocal(progressKey(userId), { ...current, [videoId]: progress });
  if (!userId || isLocalAuthUserId(userId)) {
    schedulePassCloudSync(videoId);
    return;
  }
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase.from('watch_progress').upsert({
      user_id: userId,
      video_id: videoId,
      position_seconds: progress.positionSeconds,
      duration_seconds: progress.durationSeconds,
      completed: progress.completed,
      updated_at: new Date().toISOString(),
    });
    if (error) console.warn('Could not sync watch progress:', error.message);
  } catch {
    // Keep local progress if offline
  }
}
