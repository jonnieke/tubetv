import type { Video } from '../types';
import { isMicroDrama, seriesKey } from './series';

const editorialDate = (video: Video) => Date.parse(video.editorialUpdatedAt || video.uploadDate || '') || 0;
const byFreshness = (a: Video, b: Video) => editorialDate(b) - editorialDate(a) || b.views - a.views || a.id.localeCompare(b.id);
const byViews = (a: Video, b: Video) => b.views - a.views || byFreshness(a, b);
const byPinnedThenViews = (a: Video, b: Video) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || byViews(a, b);

function blendPinnedFreshAndPopular(candidates: Video[], limit: number): Video[] {
  if (candidates.length <= limit) {
    return [...candidates].sort(byPinnedThenViews);
  }
  const picked: Video[] = [];
  const pickedIds = new Set<string>();
  const add = (item: Video) => {
    if (picked.length >= limit || pickedIds.has(item.id)) return;
    pickedIds.add(item.id);
    picked.push(item);
  };

  // 1. Admin-pinned Hero titles always take priority
  for (const item of [...candidates].filter((v) => v.featured).sort(byViews)) {
    add(item);
  }

  // 2. Reserve up to 2 slots for fresh launches (with real timestamps) so new 0-view shows get day-one spotlight
  const datedCandidates = candidates.filter((v) => !pickedIds.has(v.id) && editorialDate(v) > 0).sort(byFreshness);
  const freshBudget = Math.min(2, Math.max(0, limit - picked.length));
  const freshPicks = datedCandidates.slice(0, freshBudget);

  // 3. Fill primary popular slots first, then append reserved fresh launches so both hits and new drops appear
  const popularSlots = Math.max(0, limit - picked.length - freshPicks.length);
  const freshIds = new Set(freshPicks.map((v) => v.id));
  for (const item of candidates.filter((v) => !pickedIds.has(v.id) && !freshIds.has(v.id)).sort(byViews)) {
    if (picked.length >= limit - freshPicks.length && popularSlots >= 0) break;
    add(item);
  }
  for (const item of freshPicks) {
    add(item);
  }
  for (const item of [...candidates].sort(byViews)) {
    add(item);
  }
  return picked.slice(0, limit);
}

/**
 * Featured micro drama banners for the hero section sliding banner.
 * Selects premier micro drama series (1 representative episode per series, ideally Episode 1),
 * prioritizing admin-pinned titles and blending proven hits with brand-new launches.
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
    const latestTs = episodes.reduce((max, ep) => Math.max(max, editorialDate(ep)), 0);
    const totalViews = episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
    const anyPinned = episodes.some((ep) => Boolean(ep.featured));
    if (episodes[0]) {
      seriesRepresenting.push({
        ...episodes[0],
        views: Math.max(episodes[0].views || 0, totalViews),
        ...(anyPinned ? { featured: true } : {}),
        ...(latestTs > editorialDate(episodes[0]) ? { editorialUpdatedAt: new Date(latestTs).toISOString() } : {}),
      });
    }
  }

  const allMicroCandidates = [...seriesRepresenting, ...standalone];

  if (allMicroCandidates.length >= limit) {
    return blendPinnedFreshAndPopular(allMicroCandidates, limit);
  }

  const orderedMicro = [...allMicroCandidates].sort(byPinnedThenViews);

  // Complement with top movies or other series if fewer micro-dramas are available
  const existingIds = new Set(orderedMicro.map((v) => v.id));
  const representedSeriesKeys = new Set(
    orderedMicro.map((v) => seriesKey(v)).filter((k): k is string => Boolean(k))
  );

  const fallback: Video[] = [];
  const sortedRemaining = videos.filter((v) => !existingIds.has(v.id)).sort(byPinnedThenViews);

  for (const candidate of sortedRemaining) {
    if (orderedMicro.length + fallback.length >= limit) break;
    const sKey = seriesKey(candidate);
    if (sKey) {
      if (representedSeriesKeys.has(sKey)) continue;
      representedSeriesKeys.add(sKey);
    }
    fallback.push(candidate);
  }

  return [...orderedMicro, ...fallback];
}

/**
 * Featured long-format Movies & Series spotlight for /movies, deduplicating series
 * and blending admin-pinned titles, proven hits, and fresh releases.
 */
export function featuredLongFormat(videos: Video[], limit = 6): Video[] {
  const seriesMap = new Map<string, Video[]>();
  const standalone: Video[] = [];

  for (const video of videos) {
    const key = seriesKey(video);
    if (key) {
      const existing = seriesMap.get(key) || [];
      existing.push(video);
      seriesMap.set(key, existing);
    } else {
      standalone.push(video);
    }
  }

  const candidates: Video[] = [...standalone];
  for (const episodes of seriesMap.values()) {
    episodes.sort((a, b) => (a.season || 1) - (b.season || 1) || (a.episode || 1) - (b.episode || 1));
    const anyPinned = episodes.some((ep) => Boolean(ep.featured));
    const totalViews = episodes.reduce((sum, ep) => sum + (ep.views || 0), 0);
    if (episodes[0]) {
      candidates.push({
        ...episodes[0],
        views: Math.max(episodes[0].views || 0, totalViews),
        ...(anyPinned ? { featured: true } : {}),
      });
    }
  }

  return blendPinnedFreshAndPopular(candidates, limit);
}

/** Keep the spotlight film-only, with predictable room for both fresh and proven titles. */
export function featuredMovies(videos: Video[], limit = 5): Video[] {
  const movies = videos.filter(video => ['Movies', 'Originals'].includes(video.category) && !seriesKey(video));
  const fresh = [...movies].sort(byFreshness).slice(0, Math.ceil(limit * 0.6));
  const selected = new Set(fresh.map(video => video.id));
  const popular = movies.filter(video => !selected.has(video.id)).sort(byViews).slice(0, limit - fresh.length);
  return [...fresh, ...popular];
}
