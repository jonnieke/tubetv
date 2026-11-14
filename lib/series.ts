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

/** Generates an upcoming release schedule for the next `count` episodes using series release settings or weekly batches of 5. */
export function buildComingSoonSchedule(episodes: Video[], count = 60, now = Date.now()): ComingSoonSlot[] {
  if (!episodes.length || count <= 0) return [];
  const sorted = [...episodes].sort(compareEpisodes);
  const last = sorted[sorted.length - 1];
  const lastSeason = last.season || 1;
  const lastEpisode = last.episode || sorted.length;
  const slots: ComingSoonSlot[] = [];

  const configured = [...sorted].reverse().find(ep => ep.nextReleaseDate || ep.releaseCadenceDays || ep.releaseBatchSize);
  const batchSize = Math.max(1, Math.min(50, Math.floor(configured?.releaseBatchSize || 5)));
  const cadenceDays = Math.max(1, Math.min(90, Math.floor(configured?.releaseCadenceDays || 7)));

  const parsedAnchor = configured?.nextReleaseDate && /^\d{4}-\d{2}-\d{2}$/.test(configured.nextReleaseDate)
    ? new Date(`${configured.nextReleaseDate}T00:00:00`)
    : null;
  const hasValidAnchor = parsedAnchor !== null && Number.isFinite(parsedAnchor.getTime());

  const baseDate = hasValidAnchor ? parsedAnchor! : new Date(now);
  baseDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < count; i++) {
    const batchIndex = Math.floor(i / batchSize) + (hasValidAnchor ? 0 : 1);
    const release = new Date(baseDate.getTime() + batchIndex * cadenceDays * 24 * 60 * 60 * 1000);
    slots.push({
      season: lastSeason,
      episode: lastEpisode + i + 1,
      releaseDate: release.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' }),
    });
  }
  return slots;
}
