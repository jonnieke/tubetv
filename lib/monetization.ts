import type { Video } from '../types';
import { isMicroDrama } from './series';

export function isContentFree(video: Video): boolean {
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

  // If explicitly classified as Free, never locked
  if (video.accessTier === 'free') return false;

  // MODEL 1: Micro Dramas
  // Opening teaser episodes (default: 1 & 2) are free cliffhanger hooks.
  // Cliffhanger episodes (episode 3+) require M-Pesa pass/unlock.
  if (isMicroDrama(video) || video.category === 'Micro Dramas' || video.seriesFormat === 'micro-drama') {
    const freeCount = typeof video.freeEpisodes === 'number' && Number.isFinite(video.freeEpisodes)
      ? video.freeEpisodes
      : 2;
    const currentEpisodeNumber = Number(video.episode) || 1;

    if (currentEpisodeNumber <= freeCount) {
      return false; // Free teaser episode
    }
    return true; // Locked cliffhanger
  }

  // MODEL 2: Other Shows (Movies, Series, Originals, Lifestyle, etc.)
  // Free content is open to all; Premium requires a pass.
  return video.accessTier === 'premium' || Boolean(video.isPremium);
}

