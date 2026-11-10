import type { Video } from '../types';

export const LONG_FORMAT_PREVIEW_SECONDS = 30;

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

export function isContentFree(video: Video): boolean {
  const currentEpisodeNumber = getEpisodeNumber(video);
  if (currentEpisodeNumber !== undefined) {
    const freeCount = typeof video.freeEpisodes === 'number' && Number.isFinite(video.freeEpisodes)
      ? video.freeEpisodes
      : 2;
    return currentEpisodeNumber <= freeCount;
  }

  if (video.accessTier === 'free') return true;
  if (video.accessTier === 'premium') return false;
  return video.isPremium === false;
}

export function isVideoLocked(
  video: Video,
  hasActiveSubscription: boolean,
  unlockedVideoIds: string[] = []
): boolean {
  // Subscribers have unlimited access to all content
  if (hasActiveSubscription) return false;

  // Unlocked specifically in this session / device
  if (unlockedVideoIds.includes(video.id)) return false;

  const currentEpisodeNumber = getEpisodeNumber(video);

  // ENFORCED: Any episodic content (Micro Dramas, Series, or episodic shorts)
  // Opening teaser episodes (1 & 2) are free hooks; Episode 3+ (after episode 2) triggers paywall.
  if (currentEpisodeNumber !== undefined) {
    const freeCount = typeof video.freeEpisodes === 'number' && Number.isFinite(video.freeEpisodes)
      ? video.freeEpisodes
      : 2;
    return currentEpisodeNumber > freeCount;
  }

  // Standalone non-episodic content (Movies, Specials):
  if (video.accessTier === 'free') return false;
  return video.accessTier === 'premium' || Boolean(video.isPremium);
}

