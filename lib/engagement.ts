import { supabase, isSupabaseConfigured } from './supabase';
import { getOrCreateDeviceId } from './subscriptions';

export type EpisodeReaction = 'fire' | 'shock' | 'cry' | 'heart';

export interface EpisodeComment {
  id: string;
  videoId: string;
  authorName: string;
  body: string;
  reaction?: EpisodeReaction;
  createdAt: string;
}

const LIKED_STORAGE_KEY = 'tubetv_liked_videos_v1';
const COMMENTS_STORAGE_PREFIX = 'tubetv_ep_comments_v1:';
const DISPLAY_NAME_KEY = 'tubetv_viewer_handle_v1';

export function getSavedViewerHandle(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(DISPLAY_NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveViewerHandle(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISPLAY_NAME_KEY, name.trim().slice(0, 32));
  } catch {
    // Ignore storage errors
  }
}

export function readLocalLikedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LIKED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalLikedIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore
  }
}

function readLocalComments(videoId: string): EpisodeComment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${COMMENTS_STORAGE_PREFIX}${videoId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalComments(videoId: string, comments: EpisodeComment[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${COMMENTS_STORAGE_PREFIX}${videoId}`, JSON.stringify(comments.slice(0, 50)));
  } catch {
    // Ignore
  }
}

export async function fetchEpisodeEngagement(
  videoId: string,
): Promise<{ likeCount: number; isLiked: boolean; comments: EpisodeComment[] }> {
  const localLiked = readLocalLikedIds().includes(videoId);
  const localComments = readLocalComments(videoId);

  if (!isSupabaseConfigured || !videoId) {
    return {
      likeCount: localLiked ? 1 : 0,
      isLiked: localLiked,
      comments: localComments,
    };
  }

  try {
    const deviceId = getOrCreateDeviceId();
    const [likesCountRes, myLikeRes, commentsRes] = await Promise.all([
      supabase
        .from('episode_likes')
        .select('id', { count: 'exact', head: true })
        .eq('video_id', videoId),
      supabase
        .from('episode_likes')
        .select('id')
        .eq('video_id', videoId)
        .eq('device_id', deviceId)
        .maybeSingle(),
      supabase
        .from('episode_comments')
        .select('id, video_id, author_name, body, reaction, created_at')
        .eq('video_id', videoId)
        .order('created_at', { ascending: false })
        .limit(40),
    ]);

    const hasRemoteLikes = !likesCountRes.error;
    const remoteLikeCount = hasRemoteLikes ? likesCountRes.count ?? 0 : localLiked ? 1 : 0;
    const isLiked = !myLikeRes.error ? Boolean(myLikeRes.data) || localLiked : localLiked;

    const remoteComments: EpisodeComment[] =
      !commentsRes.error && Array.isArray(commentsRes.data)
        ? commentsRes.data.map((row: Record<string, unknown>) => ({
            id: String(row.id || ''),
            videoId: String(row.video_id || videoId),
            authorName: String(row.author_name || 'Viewer'),
            body: String(row.body || ''),
            reaction: (row.reaction as EpisodeReaction | undefined) || undefined,
            createdAt: String(row.created_at || new Date().toISOString()),
          }))
        : localComments;

    return {
      likeCount: Math.max(remoteLikeCount, isLiked ? 1 : 0),
      isLiked,
      comments: remoteComments.length > 0 ? remoteComments : localComments,
    };
  } catch {
    return {
      likeCount: localLiked ? 1 : 0,
      isLiked: localLiked,
      comments: localComments,
    };
  }
}

export async function toggleEpisodeLike(videoId: string, nextLiked: boolean): Promise<void> {
  const current = readLocalLikedIds();
  const updated = nextLiked
    ? Array.from(new Set([...current, videoId]))
    : current.filter((id) => id !== videoId);
  writeLocalLikedIds(updated);

  if (!isSupabaseConfigured || !videoId) return;

  try {
    const deviceId = getOrCreateDeviceId();
    if (nextLiked) {
      await supabase
        .from('episode_likes')
        .upsert({ video_id: videoId, device_id: deviceId }, { onConflict: 'video_id,device_id' });
    } else {
      await supabase
        .from('episode_likes')
        .delete()
        .eq('video_id', videoId)
        .eq('device_id', deviceId);
    }
  } catch {
    // Keep optimistic local state if table is not yet deployed
  }
}

export async function postEpisodeComment(params: {
  videoId: string;
  seriesId?: string;
  authorName: string;
  body: string;
  reaction?: EpisodeReaction;
}): Promise<EpisodeComment | null> {
  const cleanBody = params.body.trim().slice(0, 280);
  if (!cleanBody) return null;
  const cleanAuthor = params.authorName.trim().slice(0, 32) || 'TubeTV Fan';
  saveViewerHandle(cleanAuthor);

  const optimistic: EpisodeComment = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    videoId: params.videoId,
    authorName: cleanAuthor,
    body: cleanBody,
    reaction: params.reaction,
    createdAt: new Date().toISOString(),
  };

  const existingLocal = readLocalComments(params.videoId);
  writeLocalComments(params.videoId, [optimistic, ...existingLocal]);

  if (!isSupabaseConfigured) {
    return optimistic;
  }

  try {
    const deviceId = getOrCreateDeviceId();
    const { data, error } = await supabase
      .from('episode_comments')
      .insert({
        video_id: params.videoId,
        series_id: params.seriesId || null,
        device_id: deviceId,
        author_name: cleanAuthor,
        body: cleanBody,
        reaction: params.reaction || null,
      })
      .select('id, video_id, author_name, body, reaction, created_at')
      .single();

    if (!error && data) {
      return {
        id: String(data.id),
        videoId: String(data.video_id),
        authorName: String(data.author_name),
        body: String(data.body),
        reaction: (data.reaction as EpisodeReaction | undefined) || undefined,
        createdAt: String(data.created_at),
      };
    }
  } catch {
    // Fallback to optimistic local comment
  }

  return optimistic;
}
