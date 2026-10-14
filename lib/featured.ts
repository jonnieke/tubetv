import type { Video } from '../types';
import { seriesKey } from './series';

const editorialDate = (video: Video) => Date.parse(video.editorialUpdatedAt || video.uploadDate || '') || 0;
const byFreshness = (a: Video, b: Video) => editorialDate(b) - editorialDate(a) || b.views - a.views || a.id.localeCompare(b.id);
const byViews = (a: Video, b: Video) => b.views - a.views || byFreshness(a, b);

/** Keep the spotlight film-only, with predictable room for both fresh and proven titles. */
export function featuredMovies(videos: Video[], limit = 5): Video[] {
  const movies = videos.filter(video => ['Movies', 'Originals'].includes(video.category) && !seriesKey(video));
  const fresh = [...movies].sort(byFreshness).slice(0, Math.ceil(limit * 0.6));
  const selected = new Set(fresh.map(video => video.id));
  const popular = movies.filter(video => !selected.has(video.id)).sort(byViews).slice(0, limit - fresh.length);
  return [...fresh, ...popular];
}
