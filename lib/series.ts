import type { Video } from '../types';

export const NEW_WINDOW_DAYS = 30;
const NEW_WINDOW_MS = NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

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

export function isNewEpisode(video: Video, now = Date.now()): boolean {
  const rawDate = video.uploadDate || video.editorialUpdatedAt;
  if (!rawDate) return false;
  const ts = Date.parse(rawDate);
  if (!Number.isFinite(ts)) return false;
  const age = now - ts;
  return age >= 0 && age <= NEW_WINDOW_MS;
}

export function getSeriesEntryEpisode(episodes: Video[], now = Date.now()) {
  const sorted = [...episodes].sort(compareEpisodes);
  const newEpisodes = sorted.filter((ep) => isNewEpisode(ep, now));
  const hasNewBatch = newEpisodes.length > 0;
  const entryEpisode =
    newEpisodes.length > 0 && newEpisodes.length < sorted.length
      ? newEpisodes[0]
      : sorted[0];
  return {
    entryEpisode,
    firstEpisode: sorted[0],
    newEpisodes,
    hasNewBatch,
  };
}

export interface ComingSoonSlot {
  season: number;
  episode: number;
  releaseDate: string;
}

/** Generates a clean upcoming release schedule (batches of 5 episodes per week) for the next `count` episodes. */
export function buildComingSoonSchedule(episodes: Video[], count = 60, now = Date.now()): ComingSoonSlot[] {
  if (!episodes.length || count <= 0) return [];
  const sorted = [...episodes].sort(compareEpisodes);
  const last = sorted[sorted.length - 1];
  const lastSeason = last.season || 1;
  const lastEpisode = last.episode || sorted.length;
  const slots: ComingSoonSlot[] = [];
  const batchSize = 5;
  const baseDate = new Date(now);
  baseDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    const batchIndex = Math.floor(i / batchSize) + 1;
    const release = new Date(baseDate.getTime() + batchIndex * 7 * 24 * 60 * 60 * 1000);
    slots.push({
      season: lastSeason,
      episode: lastEpisode + i + 1,
      releaseDate: release.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' }),
    });
  }
  return slots;
}
