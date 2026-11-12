import type { Video } from '../types';
import { isMicroDrama, seriesKey } from './series';

const editorialDate = (video: Video) => Date.parse(video.editorialUpdatedAt || video.uploadDate || '') || 0;
const byFreshness = (a: Video, b: Video) => editorialDate(b) - editorialDate(a) || b.views - a.views || a.id.localeCompare(b.id);
const byViews = (a: Video, b: Video) => b.views - a.views || byFreshness(a, b);

/**
 * Featured micro drama banners for the hero section sliding banner.
 * Selects premier micro drama series (1 representative episode per series, ideally Episode 1).
 */
export function featuredMicroDramas(videos: Video[], limit = 5): Video[] {
  const microVideos = videos.filter((video) => isMicroDrama(video));

  const seriesMap = new Map<string, Video[]>();
  const standalone: Video[] = [];

  for (const video of microVideos) {
    const key = seriesKey(video);
    if (key) {
      const existing = seriesMap.get(key) || [];
      existing.push(video);
      seriesMap.set(key, existing);
    } else {
      standalone.push(video);
    }
  }

  const seriesRepresenting: Video[] = [];
  for (const episodes of seriesMap.values()) {
    episodes.sort((a, b) => (a.season || 1) - (b.season || 1) || (a.episode || 1) - (b.episode || 1));
    if (episodes[0]) seriesRepresenting.push(episodes[0]);
  }

  const allMicroCandidates = [...seriesRepresenting, ...standalone].sort(byViews);

  if (allMicroCandidates.length >= limit) {
    return allMicroCandidates.slice(0, limit);
  }

  // Complement with top movies or other series if fewer micro-dramas are available
  const existingIds = new Set(allMicroCandidates.map((v) => v.id));
  const representedSeriesKeys = new Set(
    allMicroCandidates.map((v) => seriesKey(v)).filter((k): k is string => Boolean(k))
  );

  const fallback: Video[] = [];
  const sortedRemaining = videos.filter((v) => !existingIds.has(v.id)).sort(byViews);

  for (const candidate of sortedRemaining) {
    if (allMicroCandidates.length + fallback.length >= limit) break;
    const sKey = seriesKey(candidate);
    if (sKey) {
      if (representedSeriesKeys.has(sKey)) continue;
      representedSeriesKeys.add(sKey);
    }
    fallback.push(candidate);
  }

  return [...allMicroCandidates, ...fallback];
}

/** Keep the spotlight film-only, with predictable room for both fresh and proven titles. */
export function featuredMovies(videos: Video[], limit = 5): Video[] {
  const movies = videos.filter(video => ['Movies', 'Originals'].includes(video.category) && !seriesKey(video));
  const fresh = [...movies].sort(byFreshness).slice(0, Math.ceil(limit * 0.6));
  const selected = new Set(fresh.map(video => video.id));
  const popular = movies.filter(video => !selected.has(video.id)).sort(byViews).slice(0, limit - fresh.length);
  return [...fresh, ...popular];
}
