import type { Video } from '../types';

export const isMicroDrama = (video: Video) => video.seriesFormat === 'micro-drama' || video.category === 'Micro Dramas';
export const seriesKey = (video: Video) => video.seriesId || (video.seriesTitle?.trim() ? `${isMicroDrama(video) ? 'micro' : 'series'}:${video.seriesTitle.trim().toLowerCase()}` : undefined);
export const seriesSlug = (value: string | Video): string => {
  const raw = typeof value === 'string' ? value : value.seriesTitle || value.title || '';
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};
export const compareEpisodes = (a: Video, b: Video) =>
  (a.season || 1) - (b.season || 1) || (a.episode || 1) - (b.episode || 1) || a.id.localeCompare(b.id);

export function nextEpisode(videos: Video[], currentId: string): Video | undefined {
  const current = videos.find(video => video.id === currentId);
  if (!current || !seriesKey(current)) return undefined;
  const episodes = videos.filter(video => seriesKey(video) === seriesKey(current)).sort(compareEpisodes);
  return episodes[episodes.findIndex(video => video.id === currentId) + 1];
}
