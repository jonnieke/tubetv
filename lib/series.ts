import type { Video } from '../types';
import { isFreeMicroDramaEpisode } from '../supabase/functions/_shared/episodeAccess';

export const isMicroDrama = (video: Video) => video.seriesFormat === 'micro-drama' || video.category === 'Micro Dramas';
export const seriesKey = (video: Video) => video.seriesId || (video.seriesTitle?.trim() ? `${isMicroDrama(video) ? 'micro' : 'series'}:${video.seriesTitle.trim().toLowerCase()}` : undefined);
export const isMovie = (video: Video) => !isMicroDrama(video) && !seriesKey(video);
export const compareEpisodes = (a: Video, b: Video) =>
  (a.season || 1) - (b.season || 1) || (a.episode || 1) - (b.episode || 1) || a.id.localeCompare(b.id);

export function nextEpisode(videos: Video[], currentId: string): Video | undefined {
  const current = videos.find(video => video.id === currentId);
  if (!current || !seriesKey(current)) return undefined;
  const episodes = videos.filter(video => seriesKey(video) === seriesKey(current)).sort(compareEpisodes);
  return episodes[episodes.findIndex(video => video.id === currentId) + 1];
}

/**
 * Determines whether a video or episode is available for free preview.
 * By default, TubeTV content is premium (without showing a badge).
 * Only selected free episodes/videos display the "FREE" badge.
 */
export function isFreeVideo(video: Video): boolean {
  if (isMicroDrama(video)) {
    return isFreeMicroDramaEpisode(video.episode);
  }
  return video.isPremium === false;
}
