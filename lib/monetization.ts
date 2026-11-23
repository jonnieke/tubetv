import type { Video } from '../types';
import { MAX_FREE_SHORT_DURATION_SECONDS } from './shortsLimit';

export const LONG_FORMAT_PREVIEW_SECONDS = 30;
/** Default free opening episodes while a series is building its catalogue (< 30 episodes). */
export const DEFAULT_FREE_EPISODES = 2;
/** Once a series reaches 30+ published episodes, automatically expand the free hook to 5 episodes. */
export const EXPANDED_FREE_EPISODES = 5;
export const EXPANDED_FREE_EPISODE_THRESHOLD = 30;

function parseShortDurationSeconds(duration?: string | number): number {
  if (typeof duration === 'number' && Number.isFinite(duration)) return duration;
  if (typeof duration !== 'string' || !duration.trim()) return 0;
  const parts = duration.trim().split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function isFreeShortEligible(video: Video): boolean {
  if (video.category !== 'Shorts' && !video.isShort) return false;
  const durationSec = parseShortDurationSeconds(video.duration);
  // Enforce 90-second ceiling on free Shorts so long videos cannot exploit the free Shorts bucket
  if (durationSec > MAX_FREE_SHORT_DURATION_SECONDS) return false;
  return true;
}

export function getFreeEpisodeCount(video: Video, totalSeriesEpisodes?: number): number {
  if (typeof video.freeEpisodes === 'number' && Number.isFinite(video.freeEpisodes) && video.freeEpisodes >= 0) {
    return video.freeEpisodes;
  }
  const isMicroDramaCat = video.seriesFormat === 'micro-drama' || video.category === 'Micro Dramas';
  // Series & Movies are locked to Premium by default (0 free opening episodes).
  // Only Micro Dramas get 2 free opening episodes (expanding to 5 at 30+ episodes).
  if (!isMicroDramaCat && (video.category === 'Series' || video.category === 'Movies')) {
    return 0;
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
  // Shorts (<= 90s) are free by default
  if (isFreeShortEligible(video)) return true;

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

  // Shorts (<= 90s) are free by default
  if (isFreeShortEligible(video)) return false;

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

