import type { Video } from '../types';

export const LONG_FORMAT_PREVIEW_SECONDS = 30;
/** Default free opening episodes while a series is building its catalogue (< 30 episodes). */
export const DEFAULT_FREE_EPISODES = 2;
/** Once a series reaches 30+ published episodes, automatically expand the free hook to 5 episodes. */
export const EXPANDED_FREE_EPISODES = 5;
export const EXPANDED_FREE_EPISODE_THRESHOLD = 30;

export function getFreeEpisodeCount(video: Video, totalSeriesEpisodes?: number): number {
  if (typeof video.freeEpisodes === 'number' && Number.isFinite(video.freeEpisodes) && video.freeEpisodes >= 0) {
    return video.freeEpisodes;
  }
  if (typeof totalSeriesEpisodes === 'number' && totalSeriesEpisodes >= EXPANDED_FREE_EPISODE_THRESHOLD) {
    return EXPANDED_FREE_EPISODES;
  }
  return DEFAULT_FREE_EPISODES;
}

export function isLongFormatVideo(video: Video): boolean {
  if (video.seriesFormat === 'micro-drama' || video.category === 'Micro Dramas') return false;
  if (video.isShort || video.category === 'Shorts') return false;
  return true;
}

export function getEpisodeNumber(video: Video): number | undefined {
  if (typeof video.episode === 'number' && Number.isFinite(video.episode) && video.episode > 0) {
    return video.episode;
  }
  if (typeof video.episode === 'string') {
    const parsed = parseInt(video.episode, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  const match = video.title.match(/(?:S\d+)?E(\d{1,3})/i) || video.title.match(/Episode\s*(\d{1,3})/i);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

export function isContentFree(video: Video, totalSeriesEpisodes?: number): boolean {
  // Shorts are free by default
  if (video.category === 'Shorts' || video.isShort) return true;

  const currentEpisodeNumber = getEpisodeNumber(video);
  if (currentEpisodeNumber !== undefined) {
    const freeCount = getFreeEpisodeCount(video, totalSeriesEpisodes);
    return currentEpisodeNumber <= freeCount;
  }

  // Standalone non-episodic content is free only if explicitly classified as free;
  // all other videos are premium by default.
  if (video.accessTier === 'free' || video.isPremium === false) return true;
  return false;
}

export function isVideoLocked(
  video: Video,
  hasActiveSubscription: boolean,
  unlockedVideoIds: string[] = [],
  totalSeriesEpisodes?: number
): boolean {
  // Subscribers have unlimited access to all content
  if (hasActiveSubscription) return false;

  // Unlocked specifically in this session / device (e.g. rewarded ad or WhatsApp share unlock)
  if (unlockedVideoIds.includes(video.id)) return false;

  // Shorts are free by default
  if (video.category === 'Shorts' || video.isShort) return false;

  const currentEpisodeNumber = getEpisodeNumber(video);

  // ENFORCED: Episodic content gives 2 free opening episodes until a series reaches 30 episodes,
  // then automatically expands to 5 free opening episodes (unless overridden by video.freeEpisodes).
  if (currentEpisodeNumber !== undefined) {
    const freeCount = getFreeEpisodeCount(video, totalSeriesEpisodes);
    return currentEpisodeNumber > freeCount;
  }

  // Standalone non-episodic content (Movies, Specials):
  // Free only if explicitly marked as free; all videos are premium by default.
  if (video.accessTier === 'free' || video.isPremium === false) return false;
  return true;
}

